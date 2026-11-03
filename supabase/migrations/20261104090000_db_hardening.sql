-- Database hardening (2026-11-04), from the security review. Each block says what it stops.
-- 1. History columns only the database may set: a log's created_at / status / source, a car's removed_records.
-- 2. correct_log runs as the database (with its own ownership check); nobody writes log_corrections directly.
-- 3. Size limits on free text, and row caps on the tables that had none.
-- 4. Plan switches enforced by the database: receipt photos, widgets; guests cannot start a trial;
--    the catalog audit trigger function is not callable through the API.

-- 1 ─── Columns the owner may not set ────────────────────────────────────
-- Why: created_at drives the 24-hour edit rule (guard_log_edit), status is the "verified / corrected / needs review"
-- badge buyers trust, removed_records is the "N records removed" line on a shared history. Through the API an owner
-- could rewrite all three. Our own SECURITY DEFINER functions (correct_log, accept_share, log_removed, widget_action)
-- run as their owner (postgres) and the service role as service_role, so only direct API calls
-- (current_user = authenticated / anon) are checked. On insert the values are reset rather than refused,
-- because the app never sends them (a future-dated created_at would otherwise keep a record editable forever).
create or replace function public.guard_system_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_table_name = 'vehicles' then
    if tg_op = 'INSERT' then
      new.removed_records := 0;
    elsif new.removed_records is distinct from old.removed_records then
      raise exception 'protected_field' using errcode = '42501';
    end if;
  else -- maintenance_logs
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.status := 'verified'; -- log_odometer (runs after this trigger, names sort) still flags a suspicious reading
    elsif (new.created_at, new.status, new.source) is distinct from (old.created_at, old.status, old.source) then
      raise exception 'protected_field' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_system_columns() from public, anon, authenticated;
create or replace trigger guard_system_columns before insert or update on public.maintenance_logs
  for each row execute function public.guard_system_columns();
create or replace trigger guard_system_columns before insert or update on public.vehicles
  for each row execute function public.guard_system_columns();

-- 2 ─── Corrections only through correct_log ─────────────────────────────
-- Why: log_corrections is the audit trail. With a direct insert grant an owner could add fake "original values".
-- correct_log becomes SECURITY DEFINER (it was invoker and relied on RLS), so it checks ownership itself.
-- Same body as 20261012090000_edit_delete_rules.sql otherwise. The app only calls the RPC (src/app/capture/index.tsx).
create or replace function public.correct_log(log_id uuid, changes jsonb, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb;
begin
  if not public.owns_log(log_id) then raise exception 'log not found'; end if;
  select to_jsonb(l) into old_row from public.maintenance_logs l where l.id = log_id;
  if old_row is null then raise exception 'log not found'; end if;
  if coalesce(trim(reason), '') = '' then raise exception 'reason required'; end if;

  insert into public.log_corrections (log_id, field_name, old_value, new_value, reason)
  select log_id, c.key, old_row->>c.key, c.value, reason
  from jsonb_each_text(changes) c
  where c.key in ('title', 'service_type_id', 'odometer_reading', 'cost', 'service_date', 'location', 'description', 'interval_km')
    and c.value is distinct from old_row->>c.key;

  if not found then return; end if;

  perform set_config('bestim.correcting', '1', true); -- this transaction only
  update public.maintenance_logs l set
    title = coalesce(changes->>'title', l.title),
    service_type_id = coalesce((changes->>'service_type_id')::uuid, l.service_type_id),
    odometer_reading = coalesce((changes->>'odometer_reading')::integer, l.odometer_reading),
    cost = coalesce((changes->>'cost')::numeric, l.cost),
    service_date = coalesce((changes->>'service_date')::date, l.service_date),
    location = coalesce(changes->>'location', l.location),
    description = coalesce(changes->>'description', l.description),
    interval_km = coalesce((changes->>'interval_km')::integer, l.interval_km),
    status = 'corrected'
  where l.id = log_id;
end;
$$;
revoke execute on function public.correct_log(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_log(uuid, jsonb, text) to authenticated;

revoke insert, update, delete on public.log_corrections from anon, authenticated;
drop policy if exists "own corrections insert" on public.log_corrections;

-- 3a ─── Text size limits ─────────────────────────────────────────────────
-- Why: free text had no ceiling, so one account could store megabytes per row. NOT VALID: rows already saved are not
-- checked (they stay readable); new rows and edits are. Limits sit well above what the app's screens produce.
alter table public.profiles
  drop constraint if exists profiles_text_len,
  add constraint profiles_text_len check (
    char_length(full_name) <= 100 and char_length(coalesce(avatar_url, '')) <= 1000 and char_length(currency) <= 10) not valid;

alter table public.vehicles
  drop constraint if exists vehicles_text_len,
  add constraint vehicles_text_len check (
    char_length(make) <= 100 and char_length(model) <= 100 and char_length(coalesce(plate_number, '')) <= 30
    and char_length(coalesce(color, '')) <= 50 and char_length(coalesce(vin, '')) <= 50
    and char_length(coalesce(nickname, '')) <= 100 and char_length(coalesce(photo_url, '')) <= 1000) not valid;

alter table public.maintenance_logs
  drop constraint if exists maintenance_logs_text_len,
  add constraint maintenance_logs_text_len check (
    char_length(title) <= 200 and char_length(coalesce(description, '')) <= 2000 and char_length(coalesce(location, '')) <= 200
    and char_length(coalesce(voice_transcript, '')) <= 8000 and char_length(currency) <= 10
    and length(details::text) <= 8000 and length(parts_replaced::text) <= 8000 and cardinality(photos) <= 10) not valid;

alter table public.reminders
  drop constraint if exists reminders_text_len,
  add constraint reminders_text_len check (
    char_length(title) <= 200 and char_length(coalesce(description, '')) <= 2000) not valid;

alter table public.expenses
  drop constraint if exists expenses_text_len,
  add constraint expenses_text_len check (
    char_length(coalesce(description, '')) <= 2000 and char_length(coalesce(receipt_url, '')) <= 1000
    and char_length(currency) <= 10) not valid;

-- old_value / new_value copy a log's fields (description up to 2000), so they get the larger limit.
alter table public.log_corrections
  drop constraint if exists log_corrections_text_len,
  add constraint log_corrections_text_len check (
    char_length(field_name) <= 50 and char_length(coalesce(old_value, '')) <= 8000
    and char_length(coalesce(new_value, '')) <= 8000 and char_length(coalesce(reason, '')) <= 1000) not valid;

alter table public.vehicle_shares
  drop constraint if exists vehicle_shares_text_len,
  add constraint vehicle_shares_text_len check (char_length(coalesce(shared_with_email, '')) <= 320) not valid;

-- 3b ─── Row caps on the remaining user tables ────────────────────────────
-- Why: a scripted account could fill these without limit. Same cap_rows as 20261030090000_plans.sql, plus an optional
-- third argument naming the owner column (vehicle_shares has shared_by, log_corrections corrected_by).
-- The owner is read through to_jsonb(new) because NEW.user_id does not exist on those two tables.
create or replace function public.cap_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n bigint;
  col text := coalesce(tg_argv[2], 'user_id');
  owner_id uuid := (to_jsonb(new) ->> col)::uuid;
  cap integer := tg_argv[0]::integer;
  plan_cap integer := case when coalesce(tg_argv[1], '') = '' then null
                           else (public.plan_entitlements(owner_id) ->> tg_argv[1])::integer end;
begin
  cap := least(cap, coalesce(plan_cap, cap));
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, col) into n using owner_id;
  if n >= cap then
    raise exception 'limit reached' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.cap_rows() from public, anon, authenticated;

-- The counts need an index on the owner column.
create index if not exists log_corrections_corrected_by_idx on public.log_corrections (corrected_by);
create index if not exists vehicle_shares_shared_by_idx on public.vehicle_shares (shared_by);
create index if not exists odometer_readings_user_idx on public.odometer_readings (user_id);

-- reminders: the app keeps at most one snooze row per car and part. odometer_readings is written on every reading
-- change (a cap here blocks updating the reading), so it gets the most room.
create or replace trigger reminders_cap before insert on public.reminders
  for each row execute function public.cap_rows(500);
create or replace trigger vehicle_shares_cap before insert on public.vehicle_shares
  for each row execute function public.cap_rows(200, '', 'shared_by');
create or replace trigger log_corrections_cap before insert on public.log_corrections
  for each row execute function public.cap_rows(5000, '', 'corrected_by');
create or replace trigger odometer_readings_cap before insert on public.odometer_readings
  for each row execute function public.cap_rows(10000);

-- 4a ─── Receipt photos need the plan switch ──────────────────────────────
-- Why: the app hides the photo button on plans without receipt_photos, but the storage API took the upload anyway.
drop policy if exists "own receipts insert" on storage.objects;
create policy "own receipts insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
    and public.my_feature('receipt_photos')
  );

-- 4b ─── Widgets need the plan switch ─────────────────────────────────────
-- Why: same as above, the app checks the plan (src/widgets/sync.ts) but the database did not.
-- Same as 20261023120000_widget_keys.sql, plus the plan check.
create or replace function public.create_widget_key(p_platform text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  k text;
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) or not public.my_feature('widgets') then
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

-- widget_action is called with the anon key (auth.uid() is empty), so it reads the key owner's plan directly.
-- A key made before a downgrade stops acting: {error:'plan'} (the widget shows its usual failure and the app still opens).
create or replace function public.widget_action(
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
  if not coalesce((public.plan_entitlements(k.user_id) ->> 'widgets')::boolean, false) then
    return jsonb_build_object('error', 'plan');
  end if;

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

-- 4c ─── Guests cannot start a trial ──────────────────────────────────────
-- Why: a guest account costs nothing to make, so each one could take a fresh trial.
-- Same as 20261103090000_plans_v2.sql, plus the guest check. The app falls back to "notify me" on an error.
create or replace function public.start_trial() returns text
language plpgsql security definer set search_path = '' as $$
declare p public.plans;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_plans where user_id = auth.uid()) then return null; end if;
  select * into p from public.plans where is_active and trial_days > 0 order by sort limit 1;
  if not found then return null; end if;
  insert into public.user_plans (user_id, plan_id, source, expires_at)
  values (auth.uid(), p.id, 'trial', now() + make_interval(days => p.trial_days));
  return p.id;
end $$;
revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- 4d ─── The catalog audit trigger is not an API function ─────────────────
-- Why: it was left executable by everyone (the default). Triggers still fire: the privilege is only checked when a
-- trigger is created, not when it runs.
revoke execute on function public.log_catalog_change() from public, anon, authenticated;
