-- Subscription plans (2026-10-30). A plan is a named set of limits and feature switches, edited in the dashboard (/dashboard/plans).
-- No payments yet: everyone is on the plan marked "default" (Pro) until a payment gateway writes rows into user_plans.
-- entitlements (jsonb): a number is a limit (null = no plan limit, the built-in hard caps still apply), a boolean is a feature switch.
-- Keys (fixed list, mirrored in the app and dashboard): max_cars, max_logs, voice_per_day, scans_per_day,
-- receipt_photos, share_history, export, widgets.
-- At most 3 plans. Plan changes for one user go through admin_set_user_plan() only; users cannot write user_plans.

create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,19}$'),
  name_ar text not null check (length(name_ar) between 1 and 40),
  name_en text not null check (length(name_en) between 1 and 40),
  desc_ar text not null default '' check (length(desc_ar) <= 200),
  desc_en text not null default '' check (length(desc_en) <= 200),
  sort integer not null default 0,
  is_active boolean not null default true,   -- hidden from the app's plans list; users already on it keep it
  is_default boolean not null default false, -- what a user without their own plan gets
  entitlements jsonb not null default '{}' check (jsonb_typeof(entitlements) = 'object'),
  created_at timestamptz not null default now()
);

create table public.user_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete restrict,
  source text not null default 'admin' check (source in ('admin', 'store', 'paymob')),
  expires_at timestamptz,   -- empty = no end date; after it the user falls back to the default plan
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.user_plans enable row level security;

grant select, insert, update, delete on public.plans to authenticated;
grant select on public.user_plans to authenticated;  -- no write grants: only admin_set_user_plan() / the payment webhook write

create policy "read plans" on public.plans for select to authenticated using (is_active or public.is_admin());
create policy "admins insert plans" on public.plans for insert to authenticated with check (public.has_role(array['owner', 'admin']));
create policy "admins update plans" on public.plans for update to authenticated
  using (public.has_role(array['owner', 'admin'])) with check (public.has_role(array['owner', 'admin']));
create policy "admins delete plans" on public.plans for delete to authenticated using (public.has_role(array['owner', 'admin']));
create policy "own plan" on public.user_plans for select to authenticated using ((select auth.uid()) = user_id);

-- ─── Rules on plans: max 3, exactly one default ─────────────
create function public.plans_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.plans) >= 3 then
    raise exception 'plans_max' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    if old.is_default then raise exception 'plans_default_required' using errcode = 'P0001'; end if;
    return old;
  end if;
  if new.is_default then
    -- making this one the default retires the old default (depth 1 = the admin's own statement)
    if pg_trigger_depth() = 1 then
      update public.plans set is_default = false where is_default and id <> new.id;
    end if;
  elsif tg_op = 'UPDATE' and old.is_default and pg_trigger_depth() = 1 then
    raise exception 'plans_default_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.plans_rules() from public, anon, authenticated;
create trigger plans_rules_bi before insert or update on public.plans for each row execute function public.plans_rules();
create trigger plans_rules_bd before delete on public.plans for each row execute function public.plans_rules();
create trigger log_catalog_plans after insert or update or delete on public.plans for each row execute function public.log_catalog_change();

-- ─── Reading a user's plan ──────────────────────────────────
-- The entitlements that apply to p_user right now: their own unexpired plan, else the default plan.
-- Internal (triggers); the app uses my_entitlements() / my_limit() / my_feature().
create function public.plan_entitlements(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.entitlements from public.user_plans up join public.plans p on p.id = up.plan_id
      where up.user_id = p_user and (up.expires_at is null or up.expires_at > now())),
    (select entitlements from public.plans where is_default),
    '{}'::jsonb);
$$;
revoke execute on function public.plan_entitlements(uuid) from public, anon, authenticated;

create function public.my_entitlements() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select p.* from public.plans p
    where p.id = coalesce(
      (select up.plan_id from public.user_plans up where up.user_id = auth.uid() and (up.expires_at is null or up.expires_at > now())),
      (select id from public.plans where is_default))
  )
  select coalesce((select jsonb_build_object('plan_id', id, 'name_ar', name_ar, 'name_en', name_en, 'entitlements', entitlements,
           'expires_at', (select expires_at from public.user_plans where user_id = auth.uid())) from mine), '{}'::jsonb);
$$;

-- One limit for the caller (edge functions). Empty (null) = no plan limit.
create function public.my_limit(p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select (public.plan_entitlements(auth.uid()) ->> p_key)::integer;
$$;

-- One feature switch for the caller (RLS policies). Missing = off.
create function public.my_feature(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((public.plan_entitlements(auth.uid()) ->> p_key)::boolean, false);
$$;
revoke execute on function public.my_entitlements(), public.my_limit(text), public.my_feature(text) from public, anon;
grant execute on function public.my_entitlements(), public.my_limit(text), public.my_feature(text) to authenticated;

-- ─── Admin: give one user a plan (or take it away: p_plan null = back to the default plan) ──
create function public.admin_set_user_plan(p_user uuid, p_plan text, p_expires timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_plan is null then
    delete from public.user_plans where user_id = p_user;
  else
    insert into public.user_plans (user_id, plan_id, source, expires_at, updated_at)
    values (p_user, p_plan, 'admin', p_expires, now())
    on conflict (user_id) do update set plan_id = excluded.plan_id, source = 'admin', expires_at = excluded.expires_at, updated_at = now();
  end if;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'set_user_plan', p_user::text,
          jsonb_build_object('admin_email', (select email from auth.users where id = auth.uid()), 'plan', p_plan, 'expires_at', p_expires));
end $$;
revoke execute on function public.admin_set_user_plan(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_user_plan(uuid, text, timestamptz) to authenticated;

-- The user page in the dashboard shows the plan.
create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.require_pii_admin();
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'view_user', p_user::text,
          jsonb_build_object('admin_email', (select email from auth.users where id = auth.uid())));
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'full_name', p.full_name,
    'language', p.language,
    'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'provider', u.raw_app_meta_data ->> 'provider',
    'onboarding_completed', p.onboarding_completed,
    'logs_voice', (select count(*) from public.maintenance_logs where user_id = p.id and source = 'voice'),
    'logs_manual', (select count(*) from public.maintenance_logs where user_id = p.id and source = 'manual'),
    'corrections', (select count(*) from public.log_corrections where corrected_by = p.id),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('make', v.make, 'model', v.model, 'year', v.year,
        'odometer', v.current_odometer, 'unit', v.odometer_unit, 'primary', v.is_primary) order by v.created_at)
        from public.vehicles v where v.user_id = p.id), '[]'),
    'recent_logs', coalesce((select jsonb_agg(x) from (
        select l.title, l.service_date, l.cost, l.currency, l.source, l.status
        from public.maintenance_logs l where l.user_id = p.id order by l.created_at desc limit 10) x), '[]'),
    'ai_days', coalesce((select jsonb_agg(x) from (
        select day, count, scans from public.voice_usage where user_id = p.id order by day desc limit 14) x), '[]'),
    'plan_id', (select plan_id from public.user_plans where user_id = p.id),
    'plan_source', (select source from public.user_plans where user_id = p.id),
    'plan_expires_at', (select expires_at from public.user_plans where user_id = p.id)
  ) into r
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user;
  return r;
end $$;

-- ─── Enforcement ────────────────────────────────────────────
-- Row caps: the plan limit, never above the built-in hard cap (25 cars, 10000 logs). Errors with 54000 "limit reached".
create or replace function public.cap_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n bigint;
  cap integer := tg_argv[0]::integer;
  plan_cap integer := case when tg_argv[1] is null then null else (public.plan_entitlements(new.user_id) ->> tg_argv[1])::integer end;
begin
  cap := least(cap, coalesce(plan_cap, cap));
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= cap then
    raise exception 'limit reached' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger vehicles_cap on public.vehicles;
drop trigger maintenance_logs_cap on public.maintenance_logs;
create trigger vehicles_cap before insert on public.vehicles for each row execute function public.cap_rows(25, 'max_cars');
create trigger maintenance_logs_cap before insert on public.maintenance_logs for each row execute function public.cap_rows(10000, 'max_logs');

-- Sharing a car's history needs the share_history feature. (Was one "for all" policy; insert now has the extra check.)
drop policy "own shares" on public.vehicle_shares;
create policy "own shares read" on public.vehicle_shares for select to authenticated using ((select auth.uid()) = shared_by);
create policy "own shares insert" on public.vehicle_shares for insert to authenticated
  with check ((select auth.uid()) = shared_by and public.owns_vehicle(vehicle_id) and public.my_feature('share_history'));
create policy "own shares update" on public.vehicle_shares for update to authenticated
  using ((select auth.uid()) = shared_by) with check ((select auth.uid()) = shared_by and public.owns_vehicle(vehicle_id));
create policy "own shares delete" on public.vehicle_shares for delete to authenticated using ((select auth.uid()) = shared_by);

-- ─── Starting plans (placeholder numbers: edit them in the dashboard) ──
insert into public.plans (id, name_ar, name_en, desc_ar, desc_en, sort, is_default, entitlements) values
  ('basic', 'أساسي', 'Basic', 'للبداية', 'To get started', 1, false,
   '{"max_cars":2,"max_logs":200,"voice_per_day":5,"scans_per_day":3,"receipt_photos":true,"share_history":false,"export":false,"widgets":false}'),
  ('pro', 'برو', 'Pro', 'كل المزايا', 'Everything included', 2, true,
   '{"max_cars":null,"max_logs":null,"voice_per_day":null,"scans_per_day":null,"receipt_photos":true,"share_history":true,"export":true,"widgets":true}');
