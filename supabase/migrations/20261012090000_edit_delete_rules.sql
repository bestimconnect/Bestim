-- Decisions Q98–Q101: records are easy to fix, and the rules that keep a history honest live in the database.
-- 1. A record can be edited directly for 24 hours. After that, a change must go through correct_log (with a reason).
-- 2. A record can be deleted. Its automatic expense goes with it, the car's reading steps back if that record set it,
--    and the car counts records removed after their first day (a shared history can say "N records removed").
-- 3. A car's reading never goes down by hand. Only fixing or deleting the record that set it can lower it.
-- 4. A record dated today cannot carry a reading below the car's current one (older dates can: that is history).

alter table public.vehicles add column removed_records integer not null default 0;
-- ponytail: the owner could reset this counter through the API; lock the column if shared histories start to matter legally.

-- 1 ─── 24-hour rule ───────────────────────────────────────────────────────
create function public.guard_log_edit() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.created_at > now() - interval '24 hours' then return new; end if;
  if current_setting('bestim.correcting', true) = '1' then return new; end if;
  if (new.title, new.service_type_id, new.odometer_reading, new.cost, new.service_date, new.location, new.description, new.interval_km)
     is distinct from
     (old.title, old.service_type_id, old.odometer_reading, old.cost, old.service_date, old.location, old.description, old.interval_km)
  then
    raise exception 'needs_reason';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_log_edit() from public, anon, authenticated;
create trigger guard_log_edit before update on public.maintenance_logs
  for each row execute function public.guard_log_edit();

-- Same as 20261011090000_record_catalog.sql, plus the flag that lets the change through the guard above.
create or replace function public.correct_log(log_id uuid, changes jsonb, reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  old_row jsonb;
begin
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

-- 2 ─── deleting a record ──────────────────────────────────────────────────
create function public.log_removed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.expenses e where e.log_id = old.id and e.from_log;

  update public.vehicles v set
    removed_records = v.removed_records + case when old.created_at < now() - interval '24 hours' then 1 else 0 end,
    current_odometer = case
      when old.odometer_reading is not null and v.current_odometer = old.odometer_reading then greatest(
        coalesce((select max(l.odometer_reading) from public.maintenance_logs l where l.vehicle_id = old.vehicle_id and l.id <> old.id), 0),
        coalesce((select max(r.reading) from public.odometer_readings r where r.vehicle_id = old.vehicle_id and r.reading < old.odometer_reading), 0))
      else v.current_odometer end
  where v.id = old.vehicle_id;
  return old;
end;
$$;
revoke execute on function public.log_removed() from public, anon, authenticated;
create trigger log_removed before delete on public.maintenance_logs
  for each row execute function public.log_removed();

-- 3 ─── the reading never goes down by hand ────────────────────────────────
-- Depth 1 = the owner's own update. Deeper = one of our triggers stepping the reading back after a fix or a delete.
create function public.guard_odometer() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.current_odometer < old.current_odometer and pg_trigger_depth() = 1 then
    raise exception 'lower_reading';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_odometer() from public, anon, authenticated;
create trigger guard_odometer before update of current_odometer on public.vehicles
  for each row execute function public.guard_odometer();

-- 4 ─── a record dated today cannot be below the car's reading ─────────────
create function public.guard_log_reading() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.odometer_reading is not null
     and new.service_date >= (now() at time zone 'Africa/Cairo')::date
     and new.odometer_reading < (select v.current_odometer from public.vehicles v where v.id = new.vehicle_id)
  then
    raise exception 'lower_reading';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_log_reading() from public, anon, authenticated;
create trigger guard_log_reading before insert on public.maintenance_logs
  for each row execute function public.guard_log_reading();
