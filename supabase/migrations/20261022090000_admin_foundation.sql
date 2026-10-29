-- Admin dashboard, phase 1 (bestim-landing /dashboard).
-- Who may use it: a row in public.admins. The first owner is added by hand in the SQL editor, never by the app:
--   insert into public.admins (user_id, role) select id, 'owner' from auth.users where email = '<owner email>';
-- Everything the dashboard reads goes through the functions below, and each one checks the caller first,
-- so a normal user (or a signed-out visitor) gets an error, not data.

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'content', 'support', 'viewer')),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No grants or policies: only admin_role() below reads this table.

create function public.admin_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.admins where user_id = auth.uid();
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Every admin function starts with this.
create function public.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;

-- ─── Audit log: who looked at or changed what ───────────────
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  detail jsonb
);
alter table public.admin_audit_log enable row level security;
grant select on public.admin_audit_log to authenticated;
create policy "Admins read the audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());
-- No insert grant: rows are written only by the admin functions.

-- ─── AI usage log: one row per call to an AI function ───────
create table public.ai_usage_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null, -- the history outlives a deleted account
  kind text not null check (kind in ('voice', 'scan')),
  ok boolean not null,
  ms integer check (ms >= 0)
);
create index ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
alter table public.ai_usage_log enable row level security;
grant select on public.ai_usage_log to authenticated;
create policy "Admins read AI usage" on public.ai_usage_log for select to authenticated using (public.is_admin());

-- The two Edge Functions call this after each AI call. A user calling it directly can only add noise under their own id.
create function public.log_ai_usage(p_kind text, p_ok boolean, p_ms integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_usage_log (user_id, kind, ok, ms)
  values (auth.uid(), p_kind, p_ok, least(greatest(p_ms, 0), 600000));
$$;
revoke execute on function public.log_ai_usage(text, boolean, integer) from public, anon;
grant execute on function public.log_ai_usage(text, boolean, integer) to authenticated;

-- ─── Connect demo requests: the policy that file was waiting for ───
grant select on public.connect_leads to authenticated;
create policy "Admins read demo requests" on public.connect_leads for select to authenticated using (public.is_admin());

-- ─── Overview numbers ───────────────────────────────────────
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'vehicles', (select count(*) from public.vehicles),
    'logs', (select count(*) from public.maintenance_logs),
    'logs_7d', (select count(*) from public.maintenance_logs where created_at > now() - interval '7 days'),
    'logs_voice', (select count(*) from public.maintenance_logs where source = 'voice'),
    'logs_manual', (select count(*) from public.maintenance_logs where source = 'manual'),
    'voice_7d', (select count(*) from public.ai_usage_log where kind = 'voice' and created_at > now() - interval '7 days'),
    'scan_7d', (select count(*) from public.ai_usage_log where kind = 'scan' and created_at > now() - interval '7 days'),
    'ai_failed_7d', (select count(*) from public.ai_usage_log where not ok and created_at > now() - interval '7 days'),
    'leads', (select count(*) from public.connect_leads),
    'leads_7d', (select count(*) from public.connect_leads where created_at > now() - interval '7 days')
  ) into r;
  return r;
end $$;

-- ─── Users ──────────────────────────────────────────────────
create function public.admin_user_list(p_search text, p_limit integer, p_offset integer)
returns table (id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz, vehicles bigint, logs bigint, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
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

-- One user's page. Opening it is itself written to the audit log (it shows personal data).
create function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.require_admin();
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

revoke execute on function
  public.admin_role(), public.is_admin(), public.require_admin(), public.admin_overview(),
  public.admin_user_list(text, integer, integer), public.admin_user_detail(uuid)
  from public, anon;
grant execute on function
  public.admin_role(), public.is_admin(), public.admin_overview(),
  public.admin_user_list(text, integer, integer), public.admin_user_detail(uuid)
  to authenticated;
