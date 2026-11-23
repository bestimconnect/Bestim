-- v2 Phase 1 checks. Read-only in effect: everything runs in one transaction that is rolled back.
-- Run after the 20261121* migrations (SQL editor as postgres, or psql). Any failed check stops with "assertion failed: ...".
-- Real anon-key REST checks (PostgREST) still need doing after a push: GET /rest/v1/catalog_items?limit=1 with the anon key
-- = 200 + rows; GET /rest/v1/visits with the anon key = 401/permission denied; with a user token = only that user's rows.
begin;

-- ─── 1. Seeded reference data ───────────────────────────────────────────────
do $$ begin
  assert (select count(*) from public.systems) = 16, 'systems = 16';
  assert (select count(*) from public.specialists) = 31, 'specialists = 31 (28 with jobs + dealer, DIY, other)';
  assert (select count(*) from public.job_types) = 225, 'job_types = 225';
  assert (select count(*) from public.job_types where tracked) = 26, 'tracked job types = 26';
  assert (select count(*) from public.catalog_items) = 2428, 'catalog_items = 2428 (2047 tree + 369 catalog-only + 12 quick-add)';
  assert (select count(*) from public.catalog_items where subsystem is not null) = 2047, 'tree parts = 2047';
  assert (select count(distinct subsystem_ar || system_id) from public.catalog_items where subsystem is not null) <= 127, 'sub-systems <= 127';
  assert (select count(*) from public.catalog_items where 'check_catalog' = any (flags)) = 75, 'check_catalog = 75';
  assert (select count(*) from public.catalog_items where 'quick_add' = any (flags)) = 29, 'quick-add consumables = 29';
  assert not exists (select 1 from public.job_types j, unnest(j.suggested_items) s(id)
                     where not exists (select 1 from public.catalog_items c where c.id = s.id)), 'suggested items all exist';
  assert (select array_agg(id order by id) from public.systems where health_weight = 2) = array[10, 13]::smallint[], 'weights';
end $$;

-- ─── 2. Arabic normalisation and search ─────────────────────────────────────
do $$ begin
  assert public.normalize_ar('إطـــارات') = 'اطارات', 'tatweel + hamza alef';
  assert public.normalize_ar('مُسَاعِد') = 'مساعد', 'tashkeel';
  assert public.normalize_ar('سيارة  كبرى') = 'سياره كبري', 'taa marbuta, alef maqsura, spaces';
  assert public.normalize_ar('ABS') = 'abs', 'latin lowercase';
  assert exists (select 1 from public.search_catalog('بواجي') where name_en ilike 'spark plug%'), 'alias بواجي finds spark plugs';
  assert exists (select 1 from public.search_catalog('فحمات') where name_en ilike '%brake pad%'), 'alias فحمات finds brake pads';
  assert exists (select 1 from public.search_catalog('راس السلندر')), 'alias راس السلندر';
  assert exists (select 1 from public.search_catalog('glow plug') where kind = 'item'), 'no car = no fuel filter';
end $$;

-- ─── 3. Health formula (same thresholds as src/lib/parts.ts + spec 30% rule) ─
do $$
declare d date := current_date;
begin
  assert (select health from public.item_health(5000, 0, d, 10000, null, d)) = 0.5, 'half used';
  assert (select state from public.item_health(5000, 0, d, 10000, null, d)) = 'ok', 'half used is ok';
  assert (select state from public.item_health(7500, 0, d, 10000, null, d)) = 'soon', '<= 30% left is soon';
  assert (select state from public.item_health(9100, 0, d, 40000, null, d)) = 'ok', '30,900 km left is ok';
  assert (select state from public.item_health(39100, 0, d, 40000, null, d)) = 'soon', 'within 1,000 km is soon';
  assert (select (health, state) from public.item_health(10000, 0, d, 10000, null, d)) = (0::numeric, 'overdue'::text), 'due = overdue, 0';
  assert (select health from public.item_health(0, null, d - 365, null, 24, d)) between 0.49 and 0.51, 'a year into 24 months';
  assert (select state from public.item_health(0, null, d - 160, null, 6, d)) = 'soon', '6-month item with ~20 days left';
  assert (select health from public.item_health(0, null, d, null, null, d)) is null, 'no interval = not measurable';
  -- #28: pads done 7 days ago at 100,000, interval 40,000, now 100,600 -> 39,400 km left, ring below 100%.
  assert (select (remaining_km, health < 1) from public.item_health(100600, 100000, d - 7, 40000, null, d)) = (39400, true), 'bug #28';
end $$;

-- ─── 4. Privileges ──────────────────────────────────────────────────────────
do $$ begin
  assert has_table_privilege('anon', 'public.catalog_items', 'select'), 'anon reads catalog';
  assert has_table_privilege('anon', 'public.job_types', 'select') and has_table_privilege('anon', 'public.specialists', 'select')
     and has_table_privilege('anon', 'public.systems', 'select'), 'anon reads reference tables';
  assert not has_table_privilege('anon', 'public.catalog_items', 'insert'), 'nobody writes the catalog through the API';
  assert not has_table_privilege('authenticated', 'public.job_types', 'update'), 'nobody writes job types through the API';
  assert not (has_table_privilege('anon', 'public.visits', 'select') or has_table_privilege('anon', 'public.jobs', 'select')
     or has_table_privilege('anon', 'public.line_items', 'select') or has_table_privilege('anon', 'public.tracked_items', 'select')),
     'anon reads no user table';
  assert not has_table_privilege('authenticated', 'public.visits', 'delete'), 'visits are only soft-deleted';
  assert not has_function_privilege('anon', 'public.save_visit(jsonb)', 'execute'), 'anon cannot save';
  assert not has_function_privilege('authenticated', 'public.purge_soft_deleted()', 'execute'), 'purge is service-only';
  assert not has_function_privilege('authenticated', 'public.backfill_v2_from_logs()', 'execute'), 'backfill is service-only';
  assert (select bool_and(relrowsecurity) from pg_class
          where oid in ('public.systems'::regclass, 'public.specialists'::regclass, 'public.catalog_items'::regclass, 'public.job_types'::regclass,
                        'public.visits'::regclass, 'public.jobs'::regclass, 'public.line_items'::regclass, 'public.tracked_items'::regclass)), 'RLS on';
end $$;

-- ─── 5. Backfill: one visit per old log, its expense adopted ────────────────
do $$ begin
  assert (select count(*) from public.maintenance_logs) = (select count(*) from public.visits where legacy_log_id is not null), 'one visit per log';
  assert not exists (select 1 from public.visits v where v.legacy_log_id is not null
                     and (select count(*) from public.jobs j where j.visit_id = v.id) <> 1), 'one job per backfilled visit';
  assert not exists (select 1 from public.jobs j where (select count(*) from public.line_items l where l.job_id = j.id and l.type = 'labor') <> 1),
     'every job has exactly one labor line';
  assert not exists (select 1 from public.expenses e join public.maintenance_logs l on l.id = e.log_id
                     where e.from_log and e.visit_id is null
                       and not exists (select 1 from public.expenses e2 join public.visits v on v.id = e2.visit_id where v.legacy_log_id = l.id)),
     'every from_log expense belongs to its visit';
  assert not exists (select 1 from public.visits v join public.maintenance_logs l on l.id = v.legacy_log_id
                     where (select sum(li.total) from public.jobs j join public.line_items li on li.job_id = j.id where j.visit_id = v.id) <> coalesce(l.cost, 0)),
     'visit total = old log cost';
end $$;

-- ─── 6. RLS as real users (two throwaway accounts, rolled back) ────────────
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-0000000000a1', 'v2-verify-a@example.invalid'),
  ('b0000000-0000-4000-8000-0000000000b1', 'v2-verify-b@example.invalid');
insert into public.vehicles (id, user_id, make, model, year, fuel_type) values
  ('a0000000-0000-4000-8000-00000000ca01', 'a0000000-0000-4000-8000-0000000000a1', 'Nissan', 'Sunny', 2018, 'petrol'),
  ('b0000000-0000-4000-8000-00000000cb01', 'b0000000-0000-4000-8000-0000000000b1', 'Kia', 'Cerato', 2020, 'diesel');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  car uuid := 'a0000000-0000-4000-8000-00000000ca01';
  oil uuid := (select id from public.job_types where name_en = 'Engine oil change');
  vid uuid;
  e public.expenses;
begin
  vid := public.save_visit(jsonb_build_object(
    'vehicle_id', car, 'odometer', 282400, 'workshop_name', 'Hassan',
    'jobs', jsonb_build_array(
      jsonb_build_object('specialist_key', 'mechanic', 'job_type_id', oil, 'items', jsonb_build_array(
        jsonb_build_object('type', 'labor', 'total', 100),
        jsonb_build_object('type', 'consumable', 'name', 'زيت موتور', 'qty', 4, 'unit', 'litre', 'unit_price', 150),
        jsonb_build_object('type', 'part', 'name', 'فلتر زيت', 'total', 120, 'origin', 'korean'))),
      jsonb_build_object('specialist_key', 'machine_shop_engine_rebuilding', 'custom_name', 'خراطة وش', 'items', jsonb_build_array(
        jsonb_build_object('type', 'labor', 'total', 0),
        jsonb_build_object('type', 'machine_shop', 'name', 'خراطة', 'total', 250))))));

  assert (select count(*) from public.jobs where visit_id = vid) = 2, 'two jobs';
  select * into e from public.expenses where visit_id = vid;
  assert e.amount = 1070, 'one expense = 100 + 600 + 120 + 0 + 250';
  assert e.breakdown = '{"labor": 100, "parts": 120, "consumables": 600, "other": 250}'::jsonb, 'expense breakdown';
  assert (select count(*) from public.expenses where visit_id = vid) = 1, 'exactly one expense';
  assert (select current_odometer from public.vehicles where id = car) = 282400, 'odometer moved';
  assert exists (select 1 from public.odometer_readings where vehicle_id = car and reading = 282400), 'reading history kept';
  assert (select last_done_km from public.tracked_items where vehicle_id = car and job_type_id = oil) = 282400, 'oil change tracked';
  assert (public.car_health(car) ->> 'score')::int = 100, 'fresh oil change = 100';

  -- edit replaces jobs and rewrites the one expense
  perform public.save_visit(jsonb_build_object('id', vid, 'vehicle_id', car, 'odometer', 282400,
    'jobs', jsonb_build_array(jsonb_build_object('specialist_key', 'self_diy', 'job_type_id', oil,
      'items', jsonb_build_array(jsonb_build_object('type', 'labor', 'total', 0), jsonb_build_object('type', 'part', 'name', 'x', 'total', 50))))));
  assert (select count(*) from public.jobs where visit_id = vid) = 1, 'edit replaced jobs';
  assert (select amount from public.expenses where visit_id = vid) = 50, 'edit rewrote expense';

  begin
    perform public.save_visit(jsonb_build_object('vehicle_id', car, 'jobs', jsonb_build_array(
      jsonb_build_object('specialist_key', 'mechanic', 'job_type_id', oil, 'items', '[]'::jsonb))));
    assert false, 'missing labor must fail';
  exception when others then assert sqlerrm = 'labor_required', 'labor_required: ' || sqlerrm; end;

  begin
    perform public.save_visit(jsonb_build_object('vehicle_id', car, 'odometer', 1000, 'jobs', jsonb_build_array(
      jsonb_build_object('specialist_key', 'mechanic', 'job_type_id', oil, 'items', '[{"type":"labor","total":0}]'::jsonb))));
    assert false, 'lower reading today must fail';
  exception when others then assert sqlerrm = 'lower_reading', 'lower_reading: ' || sqlerrm; end;

  assert not exists (select 1 from public.search_catalog('plug', car, 200) s join public.catalog_items c on c.id = s.id
                     where not ('petrol' = any (coalesce(c.fuel_types, '{petrol}')))), 'petrol car sees no diesel/EV-only parts';
  assert exists (select 1 from public.search_catalog('plug', car, 200) where name_en ilike 'spark plug%'), 'but sees spark plugs';

  -- soft delete: gone from reads, expense removed, tracking rolled back; restore brings both back
  perform public.soft_delete_visit(vid);
  assert not exists (select 1 from public.visits where id = vid), 'deleted visit hidden';
  assert not exists (select 1 from public.jobs where visit_id = vid), 'its jobs hidden';
  assert not exists (select 1 from public.expenses where visit_id = vid), 'its expense removed';
  assert (select last_done_km from public.tracked_items where vehicle_id = car and job_type_id = oil) is null, 'tracking rolled back';
  assert exists (select 1 from public.my_deleted_items() where id = vid), 'listed as recently deleted';
  perform public.restore_visit(vid);
  assert (select amount from public.expenses where visit_id = vid) = 50, 'restore rewrote expense';
  assert (select last_done_km from public.tracked_items where vehicle_id = car and job_type_id = oil) = 282400, 'restore re-tracked';

  -- soft-deleted car hides its visits and expenses
  perform public.soft_delete_vehicle(car);
  assert not exists (select 1 from public.vehicles where id = car), 'deleted car hidden';
  assert not exists (select 1 from public.visits where vehicle_id = car), 'its visits hidden';
  assert not exists (select 1 from public.expenses where vehicle_id = car), 'its expenses hidden';
  perform public.restore_vehicle(car);
  assert exists (select 1 from public.visits where id = vid), 'restored car shows visits';
end $$;

-- user B sees none of A's rows and cannot write under them
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$
declare a_job uuid;
begin
  assert not exists (select 1 from public.visits where user_id = 'a0000000-0000-4000-8000-0000000000a1'), 'B cannot see A visits';
  assert not exists (select 1 from public.jobs j join public.visits v on v.id = j.visit_id
                     where v.vehicle_id = 'a0000000-0000-4000-8000-00000000ca01'), 'B cannot see A jobs';
  assert not exists (select 1 from public.tracked_items where vehicle_id = 'a0000000-0000-4000-8000-00000000ca01'), 'B cannot see A tracked items';
  begin
    perform public.save_visit(jsonb_build_object('vehicle_id', 'a0000000-0000-4000-8000-00000000ca01', 'jobs',
      '[{"specialist_key":"other","custom_name":"x","items":[{"type":"labor","total":0}]}]'::jsonb));
    assert false, 'B saving on A car must fail';
  exception when others then assert sqlerrm = 'not found', 'B on A car: ' || sqlerrm; end;
  begin
    perform public.soft_delete_visit((select id from public.visits limit 1));
    assert false, 'B deleting nothing must fail';
  exception when others then assert sqlerrm = 'not found', 'B delete: ' || sqlerrm; end;
end $$;

-- B: direct writes under A's job are refused by RLS
reset role;
select set_config('bestim.a_job', (select j.id::text from public.jobs j join public.visits v on v.id = j.visit_id
  where v.vehicle_id = 'a0000000-0000-4000-8000-00000000ca01' limit 1), true);
set local role authenticated;
do $$ begin
  begin
    insert into public.line_items (job_id, type, name, total) values (current_setting('bestim.a_job')::uuid, 'tip', 'x', 1);
    assert false, 'B insert under A job must fail';
  exception when insufficient_privilege then null; end;
end $$;

-- anon: reference data yes, user tables no
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  assert (select count(*) from public.catalog_items) = 2428, 'anon reads catalog';
  assert (select count(*) from public.job_types) = 225, 'anon reads job types';
  begin perform 1 from public.visits limit 1; assert false, 'anon visits'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.jobs limit 1; assert false, 'anon jobs'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.line_items limit 1; assert false, 'anon line_items'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.tracked_items limit 1; assert false, 'anon tracked_items'; exception when insufficient_privilege then null; end;
  begin perform public.save_visit('{}'); assert false, 'anon save_visit'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'v2 phase 1: all checks passed' as result;
rollback;
