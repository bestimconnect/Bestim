-- "Last reading · 3 days ago" (screen 06) needs the time the odometer last changed; updated_at moves on any edit.
alter table public.vehicles add column odometer_updated_at timestamptz not null default now();

create function public.touch_odometer() returns trigger language plpgsql set search_path = '' as $$
begin
  new.odometer_updated_at := now();
  return new;
end;
$$;
revoke execute on function public.touch_odometer() from public, anon, authenticated;

create trigger touch_odometer before update of current_odometer on public.vehicles
  for each row when (new.current_odometer is distinct from old.current_odometer)
  execute function public.touch_odometer();

-- decisions.md Q9. The previous reading is the latest one on or before the log's date: an earlier log,
-- or the vehicle odometer (screen 25 updates it without a log). Backdated logs are only compared
-- with what came before them. A flagged reading doesn't move the vehicle odometer until confirmed (screen 20).
create or replace function public.log_odometer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  prev_reading integer;
  prev_date date;
  max_before integer;
begin
  if new.odometer_reading is null then return new; end if;

  select current_odometer, odometer_unit, odometer_updated_at::date as at into v
  from public.vehicles where id = new.vehicle_id;

  if tg_op = 'INSERT' then
    select l.odometer_reading, l.service_date into prev_reading, prev_date
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.odometer_reading is not null and l.service_date <= new.service_date
    order by l.service_date desc, l.created_at desc limit 1;

    select max(l.odometer_reading) into max_before
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.service_date <= new.service_date;

    if v.at <= new.service_date and (prev_date is null or v.at >= prev_date) then
      prev_reading := v.current_odometer;
      prev_date := v.at;
      max_before := greatest(max_before, v.current_odometer);
    end if;

    if new.odometer_reading < max_before
       or (prev_reading is not null and (new.odometer_reading - prev_reading)::numeric
           / greatest(new.service_date - prev_date, 1) > case when v.odometer_unit = 'h' then 24 else 1000 end)
    then
      new.status := 'needs_review';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.odometer_reading is not null and new.odometer_reading < old.odometer_reading then
    update public.vehicles set current_odometer = greatest(new.odometer_reading, coalesce((
      select max(l.odometer_reading) from public.maintenance_logs l
      where l.vehicle_id = new.vehicle_id and l.id <> new.id and l.status <> 'needs_review'), 0))
    where id = new.vehicle_id and current_odometer = old.odometer_reading;
  end if;

  if new.status <> 'needs_review' then
    update public.vehicles set current_odometer = new.odometer_reading
    where id = new.vehicle_id and current_odometer < new.odometer_reading;
  end if;
  return new;
end;
$$;
