-- Demo data for the landing page screenshots (bestim-landing/public/screens).
--
-- Adds ONE demo vehicle (Toyota Hilux 2023) with a year of services and expenses to the test
-- account below. The account's other vehicles are not touched.
-- Safe to re-run: the data is created once (the vehicle is recognised by its VIN marker); every
-- run then rewrites the demo text in `lang`, so the same data can be captured in both languages.
-- It also sets that test profile's display name (شادي / Shady) to match the language.
--
-- Run:     supabase db query --linked -f supabase/seeds/demo_landing.sql
-- Remove:  delete from public.vehicles where vin = 'DEMO-LANDING';   (its logs and expenses go with it)
--
-- This is data, not schema: it is NOT a migration and must never go in supabase/migrations/.
do $$
declare
  uid  constant uuid := 'f8fa7881-d1c0-4f19-9891-19e73e6102d8'; -- the test account ("shady")
  lang constant text := 'ar';                                   -- 'ar' or 'en'
  ar   constant boolean := lang = 'ar';
  vid  uuid;
  x    record;
begin
  select id into vid from public.vehicles where user_id = uid and vin = 'DEMO-LANDING';

  if vid is null then
    insert into public.vehicles (user_id, make, model, year, vehicle_type, current_odometer, odometer_unit, vin, odometer_updated_at)
    values (uid, 'Toyota', 'Hilux', 2023, 'pickup', 93000, 'km', 'DEMO-LANDING', '2025-11-01')
    returning id into vid;

    -- Oldest first, one row at a time: the odometer trigger compares each reading with the ones before it.
    -- About 125 km a day, so nothing is flagged as suspicious. Today (2026-10-02) the pickup is at 134,550 km:
    -- brake pads are overdue by 800 km, the oil change is 450 km away, the air filter 900 km away.
    for x in
      select st.id as type_id, st.name_en, v.*
      from (values
        ('Brake Pad Replacement',  93750, 2400, '2025-11-10', 'manual'),
        ('Oil Change',             95000, 1100, '2025-11-20', 'manual'),
        ('Oil Change',            100000, 1100, '2025-12-30', 'voice'),
        ('Battery Replacement',   101300, 3800, '2026-01-09', 'manual'),
        ('Oil Change',            105000, 1150, '2026-02-08', 'voice'),
        ('Wiper Replacement',     106500,  280, '2026-02-20', 'manual'),
        ('Oil Change',            110000, 1150, '2026-03-20', 'voice'),
        ('Tire Replacement',      112900, 9600, '2026-04-12', 'manual'),
        ('Oil Change',            115000, 1200, '2026-04-29', 'voice'),
        ('Oil Change',            120000, 1200, '2026-06-08', 'voice'),
        ('Air Filter',            120450,  450, '2026-06-12', 'manual'),
        ('AC Service',            121600,  900, '2026-06-21', 'manual'),
        ('Coolant Check',         123400,  350, '2026-07-05', 'manual'),
        ('Oil Change',            125000, 1200, '2026-07-18', 'voice'),
        ('Oil Change',            130000, 1200, '2026-08-27', 'voice'),
        ('Full Inspection',       132250,  600, '2026-09-14', 'manual')
      ) as v(type, reading, cost, day, source)
      join public.service_types st on st.name_en = v.type
      order by v.day
    loop
      insert into public.maintenance_logs (vehicle_id, user_id, service_type_id, title, odometer_reading, cost, service_date, source)
      values (vid, uid, x.type_id, x.name_en, x.reading, x.cost, x.day::date, x.source);
    end loop;

    update public.maintenance_logs set status = 'verified' where vehicle_id = vid and status <> 'verified';

    -- One corrected record (the original value stays in the trail): coolant check, 300 → 350.
    insert into public.log_corrections (log_id, field_name, old_value, new_value, corrected_by)
    select l.id, 'cost', '300', '350', uid
    from public.maintenance_logs l join public.service_types st on st.id = l.service_type_id
    where l.vehicle_id = vid and st.name_en = 'Coolant Check';
    update public.maintenance_logs l set status = 'corrected'
    from public.service_types st
    where st.id = l.service_type_id and l.vehicle_id = vid and st.name_en = 'Coolant Check';

    -- Expenses that are not maintenance (a log's own cost becomes an expense by itself).
    insert into public.expenses (vehicle_id, user_id, category, amount, expense_date) values
      (vid, uid, 'fuel',         1900, '2026-01-14'),
      (vid, uid, 'fuel',         2000, '2026-02-12'),
      (vid, uid, 'registration', 1350, '2026-03-10'),
      (vid, uid, 'fuel',         2150, '2026-03-16'),
      (vid, uid, 'fuel',         2100, '2026-04-15'),
      (vid, uid, 'insurance',    5100, '2026-05-15'),
      (vid, uid, 'fuel',         1950, '2026-05-17'),
      (vid, uid, 'fuel',         2300, '2026-06-16'),
      (vid, uid, 'fuel',         2050, '2026-07-15'),
      (vid, uid, 'parts',        2200, '2026-07-30'),
      (vid, uid, 'parking',       200, '2026-08-09'),
      (vid, uid, 'fuel',         2400, '2026-08-16'),
      (vid, uid, 'fuel',         2200, '2026-09-15'),
      (vid, uid, 'parking',       150, '2026-09-22'),
      (vid, uid, 'fuel',         1150, '2026-10-01');

    update public.vehicles set current_odometer = 134550 where id = vid;
  end if;

  -- ── Text in the chosen language (runs every time) ──────────────────────────
  update public.profiles set full_name = case when ar then 'شادي' else 'Shady' end where id = uid;

  update public.vehicles
  set make = case when ar then 'تويوتا' else 'Toyota' end,
      model = case when ar then 'هايلكس' else 'Hilux' end
  where id = vid;

  -- Changing a log's title also refreshes the description of its own expense (log_expense trigger).
  update public.maintenance_logs l
  set title = case when ar then st.name_ar else st.name_en end,
      location = case when ar then 'مركز الصيانة السريع' else 'Quick Service Center' end,
      parts_replaced = case
        when st.name_en <> 'Oil Change' then '[]'::jsonb
        when ar then '["زيت 5W-30", "فلتر زيت"]'::jsonb
        else '["5W-30 oil", "Oil filter"]'::jsonb end,
      voice_transcript = case
        when l.source <> 'voice' then null
        when ar then 'غيّرت زيت المحرك عند ' || to_char(l.odometer_reading, 'FM999,999') || ' ودفعت ' || to_char(l.cost, 'FM999,999') || ' جنيه'
        else 'Changed engine oil at ' || to_char(l.odometer_reading, 'FM999,999') || ' and paid ' || to_char(l.cost, 'FM999,999') || ' EGP' end
  from public.service_types st
  where st.id = l.service_type_id and l.vehicle_id = vid;

  update public.log_corrections c
  set reason = case when ar then 'الفاتورة النهائية أعلى بقليل' else 'The final receipt was slightly higher' end
  from public.maintenance_logs l
  where l.id = c.log_id and l.vehicle_id = vid;

  update public.expenses
  set description = case when ar then 'مرآة جانبية' else 'Side mirror' end
  where vehicle_id = vid and category = 'parts' and not from_log;
end $$;

-- What the run produced (the query tool prints this).
select v.make, v.model, v.current_odometer,
       (select count(*) from public.maintenance_logs l where l.vehicle_id = v.id) as logs,
       (select count(*) from public.maintenance_logs l where l.vehicle_id = v.id and l.status = 'needs_review') as flagged,
       (select count(*) from public.expenses e where e.vehicle_id = v.id) as expenses,
       (select sum(e.amount) from public.expenses e where e.vehicle_id = v.id and e.expense_date >= '2026-01-01') as total_2026
from public.vehicles v where v.vin = 'DEMO-LANDING';
