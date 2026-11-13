-- Dashboard speed (2026-11-13): indexes for the lists the dashboard sorts, a faster users list, a paged team list, and admin-check
-- policies that run once per query instead of once per row. Nothing here changes what anyone is allowed to see.
-- Safe to run again (indexes use "if not exists"; functions are replaced). Run it in the SQL Editor.

-- ─── Indexes: the lists are "newest first", so each gets an index on that column ───
create index if not exists profiles_created_idx on public.profiles (created_at desc, id);        -- users list, "new this week / month"
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc, id); -- Logs > audit
create index if not exists connect_leads_created_idx on public.connect_leads (created_at desc, id);     -- demo requests
create index if not exists maintenance_logs_user_created_idx on public.maintenance_logs (user_id, created_at desc); -- user page, counts per user
create index if not exists maintenance_logs_created_idx on public.maintenance_logs (created_at);       -- Overview "records in 7 days"
create index if not exists ai_usage_log_kind_created_idx on public.ai_usage_log (kind, created_at desc); -- Overview, AI costs
create index if not exists ai_usage_log_failed_idx on public.ai_usage_log (created_at desc) where not ok; -- "failed in 7 days"
create index if not exists ai_usage_log_user_created_idx on public.ai_usage_log (user_id, created_at);  -- AI costs by user
drop index if exists public.ai_usage_log_user_idx; -- covered by the one above
create index if not exists team_items_updated_idx on public.team_items (updated_at desc);             -- team lists
create index if not exists team_items_closed_idx on public.team_items (closed_at) where closed_at is not null;
create index if not exists team_items_due_idx on public.team_items (due_date) where kind = 'task' and due_date is not null;

-- ─── Admin policies: ask "is this an admin?" once per query, not once per row ───
drop policy if exists "Admins read the audit log" on public.admin_audit_log;
create policy "Admins read the audit log" on public.admin_audit_log for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins read AI usage" on public.ai_usage_log;
create policy "Admins read AI usage" on public.ai_usage_log for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins read demo requests" on public.connect_leads;
create policy "Admins read demo requests" on public.connect_leads for select to authenticated using ((select public.is_admin()));

-- ─── Users list: take the page first, then count cars and records for those 25 people only ───
-- Same columns as before. total is counted only up to 10,001 (the page shows "10,000+"), so a huge table never has to be counted.
drop function public.admin_user_list(text, integer, integer);
create function public.admin_user_list(p_search text, p_limit integer, p_offset integer)
returns table (id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz, vehicles bigint, logs bigint,
               plan_id text, suspended boolean, admin_role text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_search, '')));
begin
  perform public.require_pii_admin();
  return query
  with found as (
    select p.id, u.email::text as email, p.full_name, p.created_at, u.last_sign_in_at, (u.banned_until is not null and u.banned_until > now()) as suspended
    from public.profiles p join auth.users u on u.id = p.id
    -- position() instead of ilike so a "%" or "_" in the search box is just a character
    where q = '' or position(q in lower(coalesce(u.email, ''))) > 0 or position(q in lower(p.full_name)) > 0
  ),
  counted as (select count(*) as n from (select 1 from found limit 10001) c),
  pg as (select * from found f order by f.created_at desc, f.id limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0))
  select pg.id, pg.email, pg.full_name, pg.created_at, pg.last_sign_in_at,
         v.n, l.n,
         coalesce(up.plan_id, (select pl.id from public.plans pl where pl.is_default limit 1)),
         pg.suspended, a.role, (select c.n from counted c)
  from pg
  left join lateral (select count(*) as n from public.vehicles x where x.user_id = pg.id) v on true
  left join lateral (select count(*) as n from public.maintenance_logs x where x.user_id = pg.id) l on true
  left join public.user_plans up on up.user_id = pg.id and (up.expires_at is null or up.expires_at > now())
  left join public.admins a on a.user_id = pg.id
  order by pg.created_at desc, pg.id;
end $$;

-- ─── Team list, one page at a time: {rows, total}. The old team_list stays for the board. ───
create function public.team_list_page(p_kind text default null, p_filters jsonb default '{}', p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me text;
  q text := lower(trim(coalesce(p_filters ->> 'q', '')));
begin
  perform public.require_admin();
  select team_name into me from public.admins where user_id = (select auth.uid());
  return (
    with hit as (
      select i.num, i.kind, i.title, i.status, i.severity, i.priority, i.platform, i.area, i.owner, i.due_date,
             i.link_num, i.legacy_ref, i.created_at, i.updated_at, i.closed_at, i.id
      from public.team_items i
      where (p_kind is null or i.kind = p_kind)
        and (p_filters ->> 'status' is null or i.status = p_filters ->> 'status')
        and (p_filters ->> 'owner' is null or i.owner = p_filters ->> 'owner')
        and (p_filters ->> 'severity' is null or i.severity = p_filters ->> 'severity')
        and (p_filters ->> 'area' is null or i.area = p_filters ->> 'area')
        and (p_filters ->> 'platform' is null or i.platform = p_filters ->> 'platform')
        and (not coalesce((p_filters ->> 'open')::boolean, false) or not public.team_closed(i.status))
        and (not coalesce((p_filters ->> 'mine')::boolean, false) or i.owner = me or i.status = 'Waiting for ' || me)
        and (q = '' or position(q in lower(i.title)) > 0 or q = '#' || i.num or lower(coalesce(i.legacy_ref, '')) = q)
    ),
    pg as (select * from hit order by updated_at desc, num desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0))
    select jsonb_build_object(
      'total', (select count(*) from hit),
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.num desc) from (
        select pg.num, pg.kind, pg.title, pg.status, pg.severity, pg.priority, pg.platform, pg.area, pg.owner, pg.due_date,
               pg.link_num, pg.legacy_ref, pg.created_at, pg.updated_at, pg.closed_at,
               (select count(*) from public.team_comments c where c.item_id = pg.id) as comments
        from pg) r), '[]'::jsonb))
  );
end $$;

-- ─── AI costs: the by-user part only carries the 50 busiest people of the month ───
create or replace function public.admin_ai_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo';
begin
  perform public.require_admin();
  return jsonb_build_object(
    'month_start', month_start,
    'settings', coalesce((select jsonb_object_agg(key, value) from public.app_settings), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(r) from (
        select ((created_at at time zone 'Africa/Cairo')::date)::text as day, kind, coalesce(model, '') as model,
               count(*) as calls, count(*) filter (where not ok) as failed,
               count(*) filter (where input_tokens is null) as untracked,
               coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(audio_tokens), 0) as audio_tokens, coalesce(sum(output_tokens), 0) as output_tokens
        from public.ai_usage_log where created_at > now() - interval '31 days' group by 1, 2, 3
      ) r), '[]'::jsonb),
    'users', case when public.has_role(array['owner', 'admin']) then coalesce((
      select jsonb_agg(r) from (
        select l.user_id, coalesce(nullif(p.full_name, ''), u.email::text, '—') as name, u.email::text as email, l.kind, coalesce(l.model, '') as model,
               count(*) as calls, count(*) filter (where l.input_tokens is null) as untracked,
               coalesce(sum(l.input_tokens), 0) as input_tokens, coalesce(sum(l.audio_tokens), 0) as audio_tokens, coalesce(sum(l.output_tokens), 0) as output_tokens
        from public.ai_usage_log l
        left join public.profiles p on p.id = l.user_id
        left join auth.users u on u.id = l.user_id
        where l.created_at >= month_start
          and l.user_id in (select t.user_id from public.ai_usage_log t where t.created_at >= month_start and t.user_id is not null
                            group by t.user_id order by count(*) desc limit 50)
        group by 1, 2, 3, 4, 5
      ) r), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

revoke execute on function public.admin_user_list(text, integer, integer), public.team_list_page(text, jsonb, integer, integer),
  public.admin_ai_usage() from public, anon;
grant execute on function public.admin_user_list(text, integer, integer), public.team_list_page(text, jsonb, integer, integer),
  public.admin_ai_usage() to authenticated;
