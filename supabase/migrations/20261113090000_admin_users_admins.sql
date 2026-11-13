-- Dashboard: Users and Admins tables with full management (2026-11-13).
-- Who is an admin is a row in public.admins. These functions let an owner add, change and remove those rows from the
-- dashboard instead of the SQL editor, and extend the users list (plan, suspended, is-admin).
-- Creating, suspending and deleting login accounts needs Supabase's auth admin API: the dashboard server does that
-- (with a server-only key, after checking the caller's role here) and writes the audit line through admin_log().
-- Rules: only an owner changes who is an admin; the last owner can never be demoted or removed.

-- ─── Users list: + plan, suspended, admin role ──────────────
drop function public.admin_user_list(text, integer, integer);
create function public.admin_user_list(p_search text, p_limit integer, p_offset integer)
returns table (id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz, vehicles bigint, logs bigint,
               plan_id text, suspended boolean, admin_role text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin();
  return query
  with found as (
    select p.id, u.email::text as email, p.full_name, p.created_at, u.last_sign_in_at, (u.banned_until is not null and u.banned_until > now()) as suspended
    from public.profiles p join auth.users u on u.id = p.id
    -- position() instead of ilike so a "%" or "_" in the search box is just a character
    where coalesce(trim(p_search), '') = ''
       or position(lower(trim(p_search)) in lower(coalesce(u.email, ''))) > 0
       or position(lower(trim(p_search)) in lower(p.full_name)) > 0
  )
  select f.id, f.email, f.full_name, f.created_at, f.last_sign_in_at,
         (select count(*) from public.vehicles v where v.user_id = f.id),
         (select count(*) from public.maintenance_logs l where l.user_id = f.id),
         coalesce((select up.plan_id from public.user_plans up where up.user_id = f.id and (up.expires_at is null or up.expires_at > now())),
                  (select pl.id from public.plans pl where pl.is_default limit 1)),
         f.suspended,
         (select a.role from public.admins a where a.user_id = f.id),
         (select count(*) from found)
  from found f
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

-- ─── Admins list ────────────────────────────────────────────
create function public.admin_list_admins()
returns table (user_id uuid, email text, full_name text, role text, team_name text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_pii_admin(); -- emails are personal data: same roles as the users list
  return query
  select a.user_id, u.email::text, coalesce(p.full_name, ''), a.role, a.team_name, a.created_at, u.last_sign_in_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id
  order by (a.role = 'owner') desc, a.created_at;
end $$;

-- ─── Make someone an admin / change the role (owner only) ───
create function public.admin_set_role(p_user uuid, p_role text, p_team text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare old text;
begin
  if not public.has_role(array['owner']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role not in ('owner', 'admin', 'viewer') then raise exception 'bad_role' using errcode = '22023'; end if;
  if p_team is not null and p_team not in ('Shady', 'Ahmed', 'Daytwo') then raise exception 'bad_team' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'no_user' using errcode = '22023'; end if;
  select role into old from public.admins where user_id = p_user for update;
  if old = 'owner' and p_role <> 'owner' and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  insert into public.admins (user_id, role, team_name) values (p_user, p_role, p_team)
  on conflict (user_id) do update set role = excluded.role, team_name = coalesce(excluded.team_name, public.admins.team_name);
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'set_admin_role', p_user::text, jsonb_build_object('from', old, 'to', p_role));
end $$;

-- ─── Take admin access away (owner only; the account itself stays) ───
create function public.admin_remove_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare old text;
begin
  if not public.has_role(array['owner']) then raise exception 'not allowed' using errcode = '42501'; end if;
  select role into old from public.admins where user_id = p_user for update;
  if old is null then return; end if;
  if old = 'owner' and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  delete from public.admins where user_id = p_user;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'remove_admin', p_user::text, jsonb_build_object('was', old));
end $$;

-- ─── Edit a user's name (profiles are own-row only, so this goes through a function) ───
create function public.admin_update_profile(p_user uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'bad_name' using errcode = '22023'; end if;
  update public.profiles set full_name = trim(p_name) where id = p_user;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'edit_user', p_user::text, '{}'::jsonb);
end $$;

-- ─── Audit line for things the dashboard server does through the auth admin API (create, email, suspend, delete) ───
create function public.admin_log(p_action text, p_target text, p_detail jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('create_user', 'create_admin', 'change_email', 'suspend_user', 'unsuspend_user', 'delete_user') then
    raise exception 'bad_action' using errcode = '22023';
  end if;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), p_action, left(p_target, 200), coalesce(p_detail, '{}'::jsonb));
end $$;

revoke execute on function
  public.admin_user_list(text, integer, integer), public.admin_list_admins(), public.admin_set_role(uuid, text, text),
  public.admin_remove_admin(uuid), public.admin_update_profile(uuid, text), public.admin_log(text, text, jsonb)
  from public, anon;
grant execute on function
  public.admin_user_list(text, integer, integer), public.admin_list_admins(), public.admin_set_role(uuid, text, text),
  public.admin_remove_admin(uuid), public.admin_update_profile(uuid, text), public.admin_log(text, text, jsonb)
  to authenticated;
