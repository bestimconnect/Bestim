-- Release hardening, round 2 (2026-10-29). Written from the pre-production security review (docs/RELEASE-READINESS.md).
-- 1. Only owner / admin / support may open users' emails and records (viewer and content roles may not).
-- 2. A password change cancels the widget keys (a stolen phone's widget stops working).
-- 3. Per-account row caps, far above real use, so a scripted account cannot fill the database.
-- 4. Indexes for four foreign keys.

create function public.require_pii_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.admin_role(), '') not in ('owner', 'admin', 'support') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.require_pii_admin() from public, anon;
grant execute on function public.require_pii_admin() to authenticated;

create or replace function public.admin_user_list(p_search text, p_limit integer, p_offset integer)
returns table (id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz, vehicles bigint, logs bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin();
  return query
  with found as (
    select p.id, u.email::text as email, p.full_name, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
    -- position() instead of ilike so a "%" or "_" in the search box is just a character
    where coalesce(trim(p_search), '') = ''
       or position(lower(trim(p_search)) in lower(coalesce(u.email, ''))) > 0
       or position(lower(trim(p_search)) in lower(p.full_name)) > 0
  )
  select f.id, f.email, f.full_name, f.created_at, f.last_sign_in_at,
         (select count(*) from public.vehicles v where v.user_id = f.id),
         (select count(*) from public.maintenance_logs l where l.user_id = f.id),
         (select count(*) from found)
  from found f
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

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
        select day, count, scans from public.voice_usage where user_id = p.id order by day desc limit 14) x), '[]')
  ) into r
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user;
  return r;
end $$;

-- 2. widget keys die with the password
create function public.revoke_widget_keys_on_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    delete from public.widget_keys where user_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.revoke_widget_keys_on_password_change() from public, anon, authenticated;
create trigger widget_keys_password_change after update of encrypted_password on auth.users
  for each row execute function public.revoke_widget_keys_on_password_change();

-- 3. row caps
create function public.cap_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint; cap integer := tg_argv[0]::integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= cap then
    raise exception 'limit reached' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.cap_rows() from public, anon, authenticated;
create trigger vehicles_cap before insert on public.vehicles for each row execute function public.cap_rows(25);
create trigger maintenance_logs_cap before insert on public.maintenance_logs for each row execute function public.cap_rows(10000);
create trigger expenses_cap before insert on public.expenses for each row execute function public.cap_rows(10000);

-- 4. indexes
create index if not exists expenses_log_id_idx on public.expenses (log_id);
create index if not exists maintenance_logs_service_type_idx on public.maintenance_logs (service_type_id);
create index if not exists reminders_service_type_idx on public.reminders (service_type_id);
create index if not exists ai_usage_log_user_idx on public.ai_usage_log (user_id);
