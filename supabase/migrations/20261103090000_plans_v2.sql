-- Plans v2 (2026-11-03): the subscription experience redesign (decisions Q121).
-- Adds to plans: a "most popular" badge, monthly/yearly prices (empty = "coming soon"), free-trial days.
-- New tables: feature_locks (how a locked feature looks + its message), plan_interest (who tapped Subscribe before payments exist).
-- New: start_trial() (one trial per account), public read of active plans for the website, user_plans.source 'trial'.
-- Entitlement keys stay in jsonb; the list grew in the dashboard + app (year_insights, custom_reminders, sale_report,
-- family_garage, priority_support are switches only: the app has nothing behind them yet and ignores them).

alter table public.plans
  add column is_popular boolean not null default false,
  add column price_monthly integer check (price_monthly is null or price_monthly between 0 and 1000000),  -- EGP; 0 = free, empty = not priced yet
  add column price_yearly integer check (price_yearly is null or price_yearly between 0 and 10000000),
  add column trial_days integer not null default 0 check (trial_days between 0 and 90);

-- Only one plan carries the badge: setting it on one clears it on the others (depth 1 = the admin's own statement).
create function public.plans_popular() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_popular and pg_trigger_depth() = 1 then
    update public.plans set is_popular = false where is_popular and id <> new.id;
  end if;
  return new;
end $$;
revoke execute on function public.plans_popular() from public, anon, authenticated;
create trigger plans_popular_bi before insert or update on public.plans for each row execute function public.plans_popular();
create unique index plans_one_popular on public.plans (is_popular) where is_popular;

-- The website shows the active plans without a login. Nothing private is in these rows.
grant select on public.plans to anon;
create policy "public plans" on public.plans for select to anon using (is_active);

-- ─── Locked-feature rules (one row per feature key) ─────────
create table public.feature_locks (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,39}$'),   -- the entitlement key, e.g. share_history
  hidden boolean not null default false,                        -- false = show it locked with an upgrade sheet, true = hide it
  msg_ar text not null default '' check (length(msg_ar) <= 200),
  msg_en text not null default '' check (length(msg_en) <= 200)
);
alter table public.feature_locks enable row level security;
grant select, insert, update, delete on public.feature_locks to authenticated;
create policy "read locks" on public.feature_locks for select to authenticated using (true);
create policy "admins insert locks" on public.feature_locks for insert to authenticated with check (public.has_role(array['owner', 'admin']));
create policy "admins update locks" on public.feature_locks for update to authenticated
  using (public.has_role(array['owner', 'admin'])) with check (public.has_role(array['owner', 'admin']));
create policy "admins delete locks" on public.feature_locks for delete to authenticated using (public.has_role(array['owner', 'admin']));
create trigger log_catalog_feature_locks after insert or update or delete on public.feature_locks for each row execute function public.log_catalog_change();

-- ─── Who tapped Subscribe (no payments yet) ─────────────────
create table public.plan_interest (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.plan_interest enable row level security;
grant select, insert, update on public.plan_interest to authenticated;
create policy "own interest read" on public.plan_interest for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "own interest insert" on public.plan_interest for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own interest update" on public.plan_interest for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─── Trials ─────────────────────────────────────────────────
alter table public.user_plans drop constraint user_plans_source_check;
alter table public.user_plans add constraint user_plans_source_check check (source in ('admin', 'store', 'paymob', 'trial'));

-- One trial per account: starts the first active plan that has trial_days, only if the user has never had a plan row.
-- Returns the plan id, or null when there is no trial (none offered, or already used).
create function public.start_trial() returns text
language plpgsql security definer set search_path = '' as $$
declare p public.plans;
begin
  if auth.uid() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.user_plans where user_id = auth.uid()) then return null; end if;
  select * into p from public.plans where is_active and trial_days > 0 order by sort limit 1;
  if not found then return null; end if;
  insert into public.user_plans (user_id, plan_id, source, expires_at)
  values (auth.uid(), p.id, 'trial', now() + make_interval(days => p.trial_days));
  return p.id;
end $$;
revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- my_entitlements() also says whether the user's plan row came from a trial / whether a trial was already used.
create or replace function public.my_entitlements() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select p.* from public.plans p
    where p.id = coalesce(
      (select up.plan_id from public.user_plans up where up.user_id = auth.uid() and (up.expires_at is null or up.expires_at > now())),
      (select id from public.plans where is_default))
  )
  select coalesce((select jsonb_build_object('plan_id', id, 'name_ar', name_ar, 'name_en', name_en, 'entitlements', entitlements,
           'expires_at', (select expires_at from public.user_plans where user_id = auth.uid()),
           'source', (select source from public.user_plans where user_id = auth.uid() and (expires_at is null or expires_at > now())),
           'trial_used', exists (select 1 from public.user_plans where user_id = auth.uid())) from mine), '{}'::jsonb);
$$;

-- ─── Starting data ──────────────────────────────────────────
-- Pro carries the badge. Prices stay empty on purpose (= "coming soon" in the app and on the website) until the founder sets them.
update public.plans set price_monthly = 0, price_yearly = 0 where id = 'basic';
update public.plans set is_popular = true, desc_ar = 'التاريخ الكامل لسيارتك', desc_en = 'The full history for your car' where id = 'pro';
insert into public.plans (id, name_ar, name_en, desc_ar, desc_en, sort, entitlements) values
  ('max', 'ماكس', 'Max', 'لعدة سيارات وللبيع بإثبات', 'Many cars, and selling with proof', 3,
   '{"max_cars":null,"max_logs":null,"voice_per_day":null,"scans_per_day":null,"receipt_photos":true,"share_history":true,"export":true,"widgets":true}');
