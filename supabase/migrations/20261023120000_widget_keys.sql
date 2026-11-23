-- Home-screen widgets that act on their own (decisions Q115).
-- A widget holds no login. Instead the signed-in app asks for a "widget key": a random secret that can do only the
-- three things below, for that owner's cars, and nothing else (it cannot read data). Only the key's SHA-256 is stored.
-- The widget calls widget_action() directly (PostgREST rpc, anon key + the widget key in the body): one function,
-- one transaction, no extra server to deploy.

create table public.widget_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key_hash bytea not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  window_start timestamptz not null default now(), -- rate limit: 60 actions per key per hour
  window_uses integer not null default 0
);
create index widget_keys_user on public.widget_keys (user_id);
alter table public.widget_keys enable row level security;
create policy "own widget keys" on public.widget_keys for select to authenticated using ((select auth.uid()) = user_id);
-- Explicit grants (RLS alone gives "permission denied"). The hash never leaves the database.
revoke all on public.widget_keys from anon, authenticated;
grant select (id, platform, created_at, last_used_at) on public.widget_keys to authenticated;

-- The app calls this after sign-in. One key per owner and platform: a new one replaces the old one.
create function public.create_widget_key(p_platform text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  k text;
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then raise exception 'bad platform'; end if;
  delete from public.widget_keys where user_id = me and platform = p_platform;
  k := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.widget_keys (user_id, key_hash, platform) values (me, extensions.digest(k, 'sha256'), p_platform);
  return k;
end $$;
revoke all on function public.create_widget_key(text) from public, anon;
grant execute on function public.create_widget_key(text) to authenticated;

-- The app calls this before signing out.
create function public.revoke_widget_keys() returns void
language sql security definer set search_path = '' as $$
  delete from public.widget_keys where user_id = (select auth.uid());
$$;
revoke all on function public.revoke_widget_keys() from public, anon;
grant execute on function public.revoke_widget_keys() to authenticated;

-- The only door a widget has. Answers are always JSON ({ok:true,...} or {error:'...'}), never an exception.
--   set_km     p_km: raise the reading (never lower it, at most 5,000 km at once; the app handles corrections)
--   mark_done  p_service, p_title: log the service as done today at the current reading (once per day per service)
--   snooze     p_service, p_title: hide the reminder for 7 days (same rows the app writes, src/lib/snooze.ts)
create function public.widget_action(
  p_key text, p_action text, p_vehicle uuid, p_service uuid default null, p_km integer default null, p_title text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.widget_keys%rowtype;
  v public.vehicles%rowtype;
  st public.service_types%rowtype;
  last_log public.maintenance_logs%rowtype;
  today date := (now() at time zone 'Africa/Cairo')::date;
  title text := left(coalesce(nullif(trim(p_title), ''), ''), 120);
begin
  if p_key is null or length(p_key) <> 64 then return jsonb_build_object('error', 'key'); end if;
  select * into k from public.widget_keys where key_hash = extensions.digest(p_key, 'sha256') for update;
  if not found then return jsonb_build_object('error', 'key'); end if;

  if now() - k.window_start > interval '1 hour' then
    k.window_start := now();
    k.window_uses := 0;
  end if;
  if k.window_uses >= 60 then return jsonb_build_object('error', 'limit'); end if;
  update public.widget_keys set window_start = k.window_start, window_uses = k.window_uses + 1, last_used_at = now() where id = k.id;

  select * into v from public.vehicles where id = p_vehicle and user_id = k.user_id;
  if not found then return jsonb_build_object('error', 'vehicle'); end if;

  if p_action = 'set_km' then
    -- A car with no reading yet takes any first reading (like the app's update screen); after that: up only, at most +5,000.
    if p_km is null or p_km < 0 or (v.odometer_updated_at is not null and (p_km < v.current_odometer or p_km > v.current_odometer + 5000)) then
      return jsonb_build_object('error', 'km');
    end if;
    update public.vehicles set current_odometer = p_km where id = v.id;
    return jsonb_build_object('ok', true, 'km', p_km);
  end if;

  if p_action in ('mark_done', 'snooze') then
    select * into st from public.service_types where id = p_service and category_id is not null; -- a retired service has no category
    if not found then return jsonb_build_object('error', 'service'); end if;
    if title = '' then
      select case when p.language = 'ar' then st.name_ar else st.name_en end into title from public.profiles p where p.id = k.user_id;
    end if;

    if p_action = 'snooze' then
      delete from public.reminders where vehicle_id = v.id and service_type_id = st.id and status = 'dismissed';
      insert into public.reminders (vehicle_id, user_id, service_type_id, title, status, due_date)
      values (v.id, k.user_id, st.id, title, 'dismissed', today + 7);
      return jsonb_build_object('ok', true);
    end if;

    -- mark_done: a second tap the same day is a no-op, so a double tap cannot write two logs.
    if exists (
      select 1 from public.maintenance_logs
      where vehicle_id = v.id and service_type_id = st.id and service_date = today and details ->> 'from_widget' = 'true'
    ) then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
    select * into last_log from public.maintenance_logs
      where vehicle_id = v.id and service_type_id = st.id order by service_date desc, created_at desc limit 1;
    insert into public.maintenance_logs
      (vehicle_id, user_id, service_type_id, title, odometer_reading, service_date, source, interval_km, interval_months, parts_replaced, details)
    values
      (v.id, k.user_id, st.id, title,
       case when v.odometer_updated_at is null then null else v.current_odometer end, -- no reading yet: do not log a false 0
       today, 'manual',
       coalesce(last_log.interval_km, st.default_interval_km), coalesce(last_log.interval_months, st.default_interval_months),
       '[]'::jsonb, '{"from_widget": true}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('error', 'action');
end $$;
revoke all on function public.widget_action(text, text, uuid, uuid, integer, text) from public;
grant execute on function public.widget_action(text, text, uuid, uuid, integer, text) to anon, authenticated;
