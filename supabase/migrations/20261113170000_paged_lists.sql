-- Paged lists (2026-11-13): the dashboard tables that were cut up in the browser now page in the database.
-- Each function takes a page (limit, offset), checks the same role as the list it replaces, and returns the total for "Showing a-b of N".
-- Safe to run again (functions are replaced). Run it in the SQL Editor after 20261113160000_dashboard_speed.sql.

-- ─── Admins: one page, or just one person (p_user) for the edit/remove dialogs ───
create or replace function public.admin_list_admins_page(p_limit integer default 25, p_offset integer default 0, p_user uuid default null)
returns table (user_id uuid, email text, full_name text, role text, team_name text, created_at timestamptz, last_sign_in_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin();
  return query
  select a.user_id, u.email::text, coalesce(p.full_name, ''), a.role, a.team_name, a.created_at, u.last_sign_in_at, count(*) over ()
  from public.admins a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id
  where p_user is null or a.user_id = p_user
  order by (a.role = 'owner') desc, a.created_at, a.user_id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

-- ─── AI costs: this month's users, busiest first, one page of people (all their kind/model rows) ───
create or replace function public.admin_ai_users(p_limit integer default 25, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo';
begin
  perform public.require_admin();
  if not public.has_role(array['owner', 'admin']) then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb); end if;
  return (
    with per as (
      select l.user_id, count(*) as n from public.ai_usage_log l
      where l.created_at >= month_start and l.user_id is not null group by l.user_id
    ),
    pg as (select * from per order by n desc, user_id limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0))
    select jsonb_build_object(
      'total', (select count(*) from per),
      'rows', coalesce((select jsonb_agg(r) from (
        select l.user_id, coalesce(nullif(p.full_name, ''), u.email::text, '—') as name, u.email::text as email, l.kind, coalesce(l.model, '') as model,
               count(*) as calls, count(*) filter (where l.input_tokens is null) as untracked,
               coalesce(sum(l.input_tokens), 0) as input_tokens, coalesce(sum(l.audio_tokens), 0) as audio_tokens, coalesce(sum(l.output_tokens), 0) as output_tokens
        from pg join public.ai_usage_log l on l.user_id = pg.user_id and l.created_at >= month_start
        left join public.profiles p on p.id = l.user_id
        left join auth.users u on u.id = l.user_id
        group by 1, 2, 3, 4, 5
        order by (select n from pg x where x.user_id = l.user_id) desc, l.user_id
      ) r), '[]'::jsonb))
  );
end $$;

-- ─── User page: records and AI days, one page each ───
create or replace function public.admin_user_logs(p_user uuid, p_limit integer default 25, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.maintenance_logs where user_id = p_user),
    'rows', coalesce((select jsonb_agg(x) from (
      select l.title, l.service_date, l.cost, l.currency, l.source, l.status
      from public.maintenance_logs l where l.user_id = p_user
      order by l.created_at desc, l.id limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) x), '[]'::jsonb));
end $$;

create or replace function public.admin_user_ai_days(p_user uuid, p_limit integer default 25, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.voice_usage where user_id = p_user),
    'rows', coalesce((select jsonb_agg(x) from (
      select day, count, scans from public.voice_usage where user_id = p_user
      order by day desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) x), '[]'::jsonb));
end $$;

revoke execute on function public.admin_list_admins_page(integer, integer, uuid), public.admin_ai_users(integer, integer),
  public.admin_user_logs(uuid, integer, integer), public.admin_user_ai_days(uuid, integer, integer) from public, anon;
grant execute on function public.admin_list_admins_page(integer, integer, uuid), public.admin_ai_users(integer, integer),
  public.admin_user_logs(uuid, integer, integer), public.admin_user_ai_days(uuid, integer, integer) to authenticated;
