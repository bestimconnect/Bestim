-- A received car keeps its link to the brand/model list (so its name follows the app language) and the count of
-- records the owner removed (Q100). Otherwise the same as accept_share in 20261005090000_release_hardening.sql.
create or replace function public.accept_share(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s public.vehicle_shares;
  src public.vehicles;
  new_vehicle uuid;
  new_log uuid;
  r public.maintenance_logs;
begin
  if me is null then raise exception 'not signed in'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'guest'; end if;

  select * into s from public.vehicle_shares
  where share_token = token and status = 'pending' and expires_at > now()
  for update;
  if s.id is null then raise exception 'share not found'; end if;
  if s.shared_by = me then raise exception 'own share'; end if;

  select * into src from public.vehicles where id = s.vehicle_id;

  insert into public.vehicles (user_id, make, model, year, plate_number, color, vin, current_odometer, odometer_unit, nickname, vehicle_type, car_model_id, removed_records, is_primary)
  values (me, src.make, src.model, src.year, null, src.color, null, src.current_odometer, src.odometer_unit, src.nickname, src.vehicle_type, src.car_model_id, src.removed_records,
          not exists (select 1 from public.vehicles where user_id = me))
  returning id into new_vehicle;

  for r in select * from public.maintenance_logs where vehicle_id = src.id order by service_date, created_at loop
    insert into public.maintenance_logs (vehicle_id, user_id, service_type_id, title, description, odometer_reading, cost, currency,
                                         service_date, location, source, voice_transcript, parts_replaced, interval_km, interval_months)
    values (new_vehicle, me, r.service_type_id, r.title, r.description, r.odometer_reading,
            case when s.includes_expenses then r.cost end, r.currency,
            r.service_date, r.location, r.source, null, r.parts_replaced, r.interval_km, r.interval_months)
    returning id into new_log;

    -- Keep the history honest: same status and the same correction trail as the original.
    update public.maintenance_logs set status = r.status where id = new_log;
    insert into public.log_corrections (log_id, field_name, old_value, new_value, reason, corrected_at, corrected_by)
    select new_log, c.field_name, c.old_value, c.new_value, c.reason, c.corrected_at, me
    from public.log_corrections c
    where c.log_id = r.id and (s.includes_expenses or c.field_name <> 'cost');
  end loop;

  if s.includes_expenses then
    insert into public.expenses (vehicle_id, user_id, category, amount, currency, description, expense_date)
    select new_vehicle, me, e.category, e.amount, e.currency, e.description, e.expense_date
    from public.expenses e where e.vehicle_id = src.id and not e.from_log;
  end if;

  -- The insert trigger may have moved the odometer while replaying logs; the owner's reading is the truth.
  update public.vehicles set current_odometer = src.current_odometer where id = new_vehicle;
  update public.vehicle_shares set status = 'accepted' where id = s.id;
  return new_vehicle;
end;
$$;
