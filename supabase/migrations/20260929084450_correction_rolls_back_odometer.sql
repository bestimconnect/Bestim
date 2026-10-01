-- Correcting an inflated reading (screen 20) must pull the vehicle odometer back down
-- when that log was what set it.
create or replace function public.log_odometer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prev_reading integer;
  prev_date date;
  max_before integer;
  unit text;
begin
  if new.odometer_reading is null then return new; end if;

  select odometer_unit into unit from public.vehicles where id = new.vehicle_id;

  if tg_op = 'INSERT' then
    select l.odometer_reading, l.service_date into prev_reading, prev_date
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.odometer_reading is not null and l.service_date <= new.service_date
    order by l.service_date desc, l.created_at desc limit 1;

    select max(l.odometer_reading) into max_before
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.service_date <= new.service_date;

    if new.odometer_reading < max_before
       or (prev_reading is not null and (new.odometer_reading - prev_reading)::numeric
           / greatest(new.service_date - prev_date, 1) > case when unit = 'h' then 24 else 1000 end)
    then
      new.status := 'needs_review';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.odometer_reading is not null and new.odometer_reading < old.odometer_reading then
    update public.vehicles v set current_odometer = greatest(new.odometer_reading, coalesce((
      select max(l.odometer_reading) from public.maintenance_logs l
      where l.vehicle_id = new.vehicle_id and l.id <> new.id), 0))
    where v.id = new.vehicle_id and v.current_odometer = old.odometer_reading;
  end if;

  update public.vehicles set current_odometer = new.odometer_reading
  where id = new.vehicle_id and current_odometer < new.odometer_reading;
  return new;
end;
$$;
