-- v2 backfill (spec 2.6 "Migration", acceptance 2.13 #7): every maintenance_logs row becomes
--   1 visit (legacy_log_id = the log; same date, reading, place, notes, photos)
--   1 job   (the job type mapped from the log's service type below, with its specialist; else specialist 'other' + the log title)
--   2 line items: labor 0 (every job has one) and one 'part' holding the log's whole cost (named after parts_replaced, else the title)
-- The log's existing from_log expense is adopted by the visit (visit_id set; log_id kept, so the old link stays valid).
-- Tracked items: one per car x mapped job type that had an interval (the log's own, else the service default), kept as the
-- car's interval so nothing on screen changes; last done comes from the latest visit (recompute_tracked).
-- Idempotent: logs that already have a visit are skipped. Re-run at cut-over: select public.backfill_v2_from_logs();
-- Not mirrored: a v1 edit of a log after it was copied (cut-over runs after v1 writes stop).
--
-- Unmapped (become custom jobs, not tracked): Brake Inspection, Coolant Check, AC Service, Transmission Check,
-- Suspension Repair, Body & Paint Repair, Glass Repair, General Repair, accessories without a catalog job.
-- Judgement calls: Transmission Oil Change -> automatic (the catalog splits manual / automatic; most cars logged are automatic),
-- Brake Pad Replacement -> front pads, Oil Filter -> engine oil change (the filter is part of that job).

create function public.backfill_v2_from_logs() returns integer
language plpgsql security definer set search_path = '' as $$
declare before_n bigint := (select count(*) from public.visits);
begin
  drop table if exists pg_temp.v2_map, pg_temp.v2_src;
  create temp table v2_map (service_en text primary key, job_en text not null) on commit drop;
  insert into v2_map values
    ('Oil Change', 'Engine oil change'), ('Oil Filter', 'Engine oil change'),
    ('Spark Plug Replacement', 'Spark plugs replacement'), ('Timing Belt', 'Timing belt kit replacement'),
    ('Drive Belt', 'Drive / accessory belt replacement'), ('Air Filter', 'Air filter replacement'),
    ('Cabin Filter', 'Cabin (A/C) filter replacement'), ('Fuel Filter', 'Fuel filter replacement'),
    ('Brake Pad Replacement', 'Front brake pads replacement'), ('Brake Disc Replacement', 'Front discs replacement'),
    ('Brake Fluid Change', 'Brake fluid change & bleeding'), ('Tire Replacement', 'New tyres'),
    ('Tire Rotation', 'Tyre rotation'), ('Wheel Alignment & Balancing', 'Wheel alignment'),
    ('Battery Replacement', 'Battery replacement'), ('Battery Check', 'Battery / charging test'),
    ('Bulb Replacement', 'Bulb replacement'), ('Coolant Change', 'Coolant change / flush'),
    ('AC Gas Refill', 'Refrigerant recharge'), ('Transmission Oil Change', 'Automatic transmission fluid change'),
    ('Shock Absorbers', 'Front shock absorbers replacement'), ('Wiper Replacement', 'Wiper blades replacement'),
    ('Full Inspection', 'General check-up'), ('Car Wash', 'Exterior wash'),
    ('Reverse Camera', 'Reverse camera installation'), ('Floor Mats', 'Floor mats'), ('Car Cover', 'Car cover'),
    ('Roof Rack', 'Roof rack / tow hook'), ('Seat Covers', 'Seat covers / reupholstery'), ('Window Tint', 'Window tint'),
    ('Steering Wheel Cover', 'Steering wheel cover'), ('Parking Sensors', 'Parking sensors installation / repair');

  create temp table v2_src on commit drop as
  select l.id, l.vehicle_id, l.user_id, l.service_date, l.odometer_reading, l.location, l.description, l.photos, l.created_at,
         l.title, l.cost, l.parts_replaced, l.interval_km, l.interval_months,
         st.name_en as st_en, st.name_ar as st_ar, st.default_interval_km, st.default_interval_months,
         jt.id as jt_id, coalesce(jt.specialist_key, 'other') as spec
  from public.maintenance_logs l
  left join public.service_types st on st.id = l.service_type_id
  left join v2_map m on m.service_en = st.name_en
  left join public.job_types jt on jt.name_en = m.job_en
  where not exists (select 1 from public.visits v where v.legacy_log_id = l.id);

  with nv as (
    insert into public.visits (vehicle_id, user_id, visit_date, odometer, workshop_name, notes, photos, legacy_log_id, created_at)
    select vehicle_id, user_id, service_date, odometer_reading, left(nullif(btrim(location), ''), 200),
           left(nullif(btrim(description), ''), 2000), photos[1:10], id, created_at
    from v2_src
    returning id, legacy_log_id
  ), nj as (
    insert into public.jobs (visit_id, specialist_key, job_type_id, custom_name, notes, sort)
    select nv.id, s.spec, s.jt_id,
           case when s.jt_id is null then left(s.title, 200) end,
           case when s.jt_id is not null and s.title not in (coalesce(s.st_en, ''), coalesce(s.st_ar, '')) then left(s.title, 2000) end,
           1
    from nv join v2_src s on s.id = nv.legacy_log_id
    returning id, visit_id
  )
  insert into public.line_items (job_id, type, name, qty, unit_price, total)
  select nj.id, t.type, t.name, 1, t.amount, t.amount
  from nj join nv on nv.id = nj.visit_id join v2_src s on s.id = nv.legacy_log_id
  cross join lateral (values
    ('labor', 'مصنعية', 0::numeric),
    ('part', left(coalesce(nullif((
       select string_agg(case jsonb_typeof(p) when 'string' then p #>> '{}' else p ->> 'name' end, ' + ')
       from jsonb_array_elements(case when jsonb_typeof(s.parts_replaced) = 'array' then s.parts_replaced else '[]' end) p), ''),
       s.title), 200), coalesce(s.cost, 0))
  ) t(type, name, amount);

  -- The log's automatic expense now belongs to its visit.
  update public.expenses e
  set visit_id = v.id, breakdown = jsonb_build_object('labor', 0, 'parts', e.amount, 'consumables', 0, 'other', 0)
  from public.visits v
  where v.legacy_log_id = e.log_id and e.from_log and e.visit_id is null
    and not exists (select 1 from public.expenses e2 where e2.visit_id = v.id);

  insert into public.tracked_items (vehicle_id, job_type_id, interval_km, interval_months)
  select distinct on (s.vehicle_id, s.jt_id) s.vehicle_id, s.jt_id,
         coalesce(s.interval_km, s.default_interval_km), coalesce(s.interval_months, s.default_interval_months)
  from v2_src s
  where s.jt_id is not null
    and coalesce(s.interval_km, s.default_interval_km, s.interval_months, s.default_interval_months) is not null
  order by s.vehicle_id, s.jt_id, s.service_date desc, s.created_at desc
  on conflict (vehicle_id, job_type_id) where job_type_id is not null do nothing;

  perform public.recompute_tracked(x.vehicle_id) from (select distinct vehicle_id from v2_src) x;
  return (select count(*) from public.visits) - before_n;
end $$;
revoke execute on function public.backfill_v2_from_logs() from public, anon, authenticated;
grant execute on function public.backfill_v2_from_logs() to service_role;

select public.backfill_v2_from_logs();
