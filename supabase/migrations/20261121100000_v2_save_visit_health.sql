-- v2: saving a visit, one expense per visit, tracked items, health.
--
-- DECISION (expenses and the old tables, until the app is cut over):
-- * save_visit() writes visits / jobs / line_items only. It never writes maintenance_logs, so the old log_expense trigger
--   (from_log expenses) never fires for a visit and nothing is counted twice. The v1 app keeps writing logs and from_log
--   expenses exactly as before.
-- * Each visit owns at most one expense (expenses.visit_id, unique), written by write_visit_expense(): category
--   'maintenance', amount = sum of all line items, breakdown = {labor, parts, consumables, other} (machine shop, diagnostic,
--   towing, tip and other count as "other"). No expense for a 0 total (same as log_expense).
-- * Backfilled visits (20261121120000) adopt their log's existing from_log expense by setting its visit_id. If that visit is
--   later edited in v2, the from_log row is replaced by a visit expense. If the v1 app edits the same old log afterwards, its
--   trigger re-creates a from_log expense (visit_id null): a double count only possible while both apps edit one record.
--   Cut-over step: stop v1 writes, re-run select public.backfill_v2_from_logs().
-- * The odometer moves through the vehicles table (update current_odometer), the same path the update screen uses, so
--   touch_odometer, keep_odometer_reading and guard_odometer all apply. A visit dated today cannot be below the car's reading
--   (same rule as guard_log_reading). Not carried over from logs yet: the needs_review flag and the 24-hour edit rule.
--
-- Health (spec 2.8; must agree with src/lib/parts.ts):
--   km fraction left   = (last_done_km + interval_km - odometer) / interval_km
--   time fraction left = days to due / days in the interval, due = last_done_date + interval_months (calendar months)
--   health = clamp(min of the two that exist, 0, 1)  ( = clamp(1 - max(km_used/interval_km, months_used/interval_months)) )
--   overdue: km left <= 0 or days left <= 0;  soon: km left <= 1,000 or days left <= 30 or health <= 30%;  else ok.
--   parts.ts has the 1,000 km / 30 day rule but not "health <= 30%": the TS mirror must add it (Phase 4).
-- Car health: weighted average of item health, weight = systems.health_weight (brakes incl. brake fluid = 2, wheels &
--   tyres = 2, all else 1). The lowest item caps nothing. OPEN PRODUCT QUESTION (founder): lowest item vs weighted average;
--   today's app shows a plain average (src/lib/health.ts), so scores will shift slightly once the app uses this.

-- ─── Tracked items follow the latest live visit ────────────────────────────
-- Security invoker: under RLS for app calls, full access when called from a SECURITY DEFINER function or a migration.
create function public.recompute_tracked(p_vehicle_id uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.tracked_items t set
    last_done_visit_id = x.visit_id, last_done_km = x.odometer, last_done_date = x.visit_date
  from (
    select t2.id as tid, lv.visit_id, lv.odometer, lv.visit_date, t2.last_done_visit_id as old_visit
    from public.tracked_items t2
    left join lateral (
      select v.id as visit_id, v.odometer, v.visit_date
      from public.visits v join public.jobs j on j.visit_id = v.id
      where v.vehicle_id = t2.vehicle_id and v.deleted_at is null
        and (j.job_type_id = t2.job_type_id
             or exists (select 1 from public.line_items li where li.job_id = j.id and li.catalog_item_id = t2.catalog_item_id))
      order by v.visit_date desc, v.odometer desc nulls last, v.created_at desc
      limit 1
    ) lv on true
    where t2.vehicle_id = p_vehicle_id
  ) x
  where t.id = x.tid
    and (x.visit_id is not null or x.old_visit is not null) -- no visit ever: keep what the owner typed
    and (t.last_done_visit_id, t.last_done_km, t.last_done_date) is distinct from (x.visit_id, x.odometer, x.visit_date);
$$;

-- ─── The visit's one expense ─────────────────────────────────────────────────
create function public.write_visit_expense(p_visit_id uuid) returns void
language sql security invoker set search_path = '' as $$
  delete from public.expenses where visit_id = p_visit_id;
  insert into public.expenses (vehicle_id, user_id, visit_id, category, amount, currency, description, expense_date, breakdown)
  select v.vehicle_id, v.user_id, v.id, 'maintenance', s.total,
         coalesce((select p.currency from public.profiles p where p.id = v.user_id), 'EGP'),
         left(coalesce(nullif(btrim(v.workshop_name), ''), s.first_job), 200), v.visit_date,
         jsonb_build_object('labor', s.labor, 'parts', s.parts, 'consumables', s.consumables, 'other', s.total - s.labor - s.parts - s.consumables)
  from public.visits v
  cross join lateral (
    select coalesce(sum(li.total), 0) as total,
           coalesce(sum(li.total) filter (where li.type = 'labor'), 0) as labor,
           coalesce(sum(li.total) filter (where li.type = 'part'), 0) as parts,
           coalesce(sum(li.total) filter (where li.type = 'consumable'), 0) as consumables,
           (select coalesce(jt.name_ar, j2.custom_name) from public.jobs j2 left join public.job_types jt on jt.id = j2.job_type_id
             where j2.visit_id = v.id order by j2.sort limit 1) as first_job
    from public.jobs j join public.line_items li on li.job_id = j.id
    where j.visit_id = v.id
  ) s
  where v.id = p_visit_id and v.deleted_at is null and s.total > 0;
$$;

-- ─── save_visit: one atomic call for a new or edited visit ─────────────────
-- p = { id?, vehicle_id, visit_date?, odometer?, workshop_name?, workshop_phone?, notes?, photos?: [],
--       jobs: [ { specialist_key, specialist_name?, job_type_id? | custom_name?, position?, notes?,
--                 items: [ { type, catalog_item_id?, name?, qty?, unit?, unit_price?, total?, brand?, origin?, condition?,
--                            part_number?, warranty_months? } ] } ] }
-- Every job needs exactly one 'labor' item (0 allowed). Editing (id given) replaces all jobs and items of that visit.
-- Errors: jobs_required, labor_required, lower_reading, not found (P0002).
create function public.save_visit(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_vehicle uuid := (p->>'vehicle_id')::uuid;
  v_date date := coalesce(nullif(p->>'visit_date', '')::date, (now() at time zone 'Africa/Cairo')::date);
  v_km integer := nullif(p->>'odometer', '')::integer;
  car public.vehicles;
  j jsonb;
  j_ord bigint;
  new_job uuid;
begin
  if jsonb_typeof(p->'jobs') is distinct from 'array' or jsonb_array_length(p->'jobs') = 0 then
    raise exception 'jobs_required' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p->'jobs') jj
    where (select count(*) from jsonb_array_elements(coalesce(jj->'items', '[]')) x where x->>'type' = 'labor') <> 1
  ) then
    raise exception 'labor_required' using errcode = 'P0001';
  end if;

  select * into car from public.vehicles where id = v_vehicle and deleted_at is null; -- RLS: own cars only
  if car.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_km is not null and v_date >= (now() at time zone 'Africa/Cairo')::date
     and car.odometer_updated_at is not null and v_km < car.current_odometer then
    raise exception 'lower_reading' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.visits (vehicle_id, visit_date, odometer, workshop_name, workshop_phone, notes, photos)
    values (v_vehicle, v_date, v_km, nullif(btrim(p->>'workshop_name'), ''), nullif(btrim(p->>'workshop_phone'), ''),
            nullif(btrim(p->>'notes'), ''), coalesce(array(select jsonb_array_elements_text(p->'photos')), '{}'))
    returning id into v_id;
  else
    update public.visits set visit_date = v_date, odometer = v_km,
      workshop_name = nullif(btrim(p->>'workshop_name'), ''), workshop_phone = nullif(btrim(p->>'workshop_phone'), ''),
      notes = nullif(btrim(p->>'notes'), ''), photos = coalesce(array(select jsonb_array_elements_text(p->'photos')), '{}')
    where id = v_id and vehicle_id = v_vehicle;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    delete from public.jobs where visit_id = v_id;
  end if;

  for j, j_ord in select e, o from jsonb_array_elements(p->'jobs') with ordinality as t(e, o) loop
    insert into public.jobs (visit_id, specialist_key, specialist_name, job_type_id, custom_name, position, notes, sort)
    values (v_id, coalesce(j->>'specialist_key', 'other'), nullif(btrim(j->>'specialist_name'), ''),
            nullif(j->>'job_type_id', '')::uuid, nullif(btrim(j->>'custom_name'), ''), nullif(j->>'position', ''),
            nullif(btrim(j->>'notes'), ''), j_ord)
    returning id into new_job;

    insert into public.line_items (job_id, type, catalog_item_id, name, qty, unit, unit_price, total,
                                   brand, origin, condition, part_number, warranty_months)
    select new_job, x->>'type', nullif(x->>'catalog_item_id', '')::uuid,
           coalesce(nullif(btrim(x->>'name'), ''), ci.name_ar, x->>'type'),
           coalesce(nullif(x->>'qty', '')::numeric, 1), nullif(x->>'unit', ''), nullif(x->>'unit_price', '')::numeric,
           coalesce(nullif(x->>'total', '')::numeric,
                    coalesce(nullif(x->>'qty', '')::numeric, 1) * nullif(x->>'unit_price', '')::numeric, 0),
           nullif(btrim(x->>'brand'), ''), nullif(x->>'origin', ''), nullif(x->>'condition', ''),
           nullif(btrim(x->>'part_number'), ''), nullif(x->>'warranty_months', '')::smallint
    from jsonb_array_elements(coalesce(j->'items', '[]')) x
    left join public.catalog_items ci on ci.id = nullif(x->>'catalog_item_id', '')::uuid;
  end loop;

  -- A tracked job type starts being tracked on this car the first time it is done.
  insert into public.tracked_items (vehicle_id, job_type_id)
  select distinct v_vehicle, jt.id
  from public.jobs jb join public.job_types jt on jt.id = jb.job_type_id
  where jb.visit_id = v_id and jt.tracked
  on conflict (vehicle_id, job_type_id) where job_type_id is not null do nothing;

  perform public.recompute_tracked(v_vehicle);
  perform public.write_visit_expense(v_id);

  if v_km is not null and (v_km > car.current_odometer or car.odometer_updated_at is null) then
    update public.vehicles set current_odometer = v_km where id = v_vehicle and current_odometer <= v_km;
  end if;
  return v_id;
end $$;

-- ─── Health ────────────────────────────────────────────────────────────────
-- One tracked item. null health/state = nothing to measure against (no interval, or never done).
create function public.item_health(
  odometer integer, last_km integer, last_date date, interval_km integer, interval_months integer, today date
) returns table (health numeric, state text, remaining_km integer, remaining_days integer, due_date date)
language sql immutable parallel safe set search_path = '' as $$
  select h.v,
         case when h.v is null then null
              when x.rkm <= 0 or x.due - today <= 0 then 'overdue'
              when x.rkm <= 1000 or x.due - today <= 30 or h.v <= 0.3 then 'soon'
              else 'ok' end,
         x.rkm, x.due - today, x.due
  from (select
          case when interval_km is not null and last_km is not null then last_km + interval_km - odometer end as rkm,
          case when interval_months is not null and last_date is not null
               then (last_date + make_interval(months => interval_months))::date end as due) x
  cross join lateral (select case when x.rkm is null and x.due is null then null
    else greatest(0::numeric, least(1::numeric,
           coalesce(x.rkm::numeric / interval_km, 'Infinity'::numeric),
           coalesce((x.due - today)::numeric / greatest(x.due - last_date, 1), 'Infinity'::numeric))) end as v) h;
$$;

-- Every tracked item of a car with its health (RLS: own cars only).
create function public.tracked_health(p_vehicle_id uuid)
returns table (tracked_item_id uuid, job_type_id uuid, catalog_item_id uuid, system_id smallint, weight smallint,
               interval_km integer, interval_months integer, last_done_km integer, last_done_date date,
               health numeric, state text, remaining_km integer, remaining_days integer, due_date date)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.job_type_id, t.catalog_item_id, s.id, coalesce(s.health_weight, 1::smallint),
         coalesce(t.interval_km, jt.default_interval_km), coalesce(t.interval_months, jt.default_interval_months),
         t.last_done_km, t.last_done_date, h.health, h.state, h.remaining_km, h.remaining_days, h.due_date
  from public.tracked_items t
  join public.vehicles v on v.id = t.vehicle_id
  left join public.job_types jt on jt.id = t.job_type_id
  left join public.catalog_items ci on ci.id = t.catalog_item_id
  left join public.systems s on s.id = coalesce(jt.system_id, ci.system_id)
  cross join lateral public.item_health(v.current_odometer, t.last_done_km, t.last_done_date,
    coalesce(t.interval_km, jt.default_interval_km), coalesce(t.interval_months, jt.default_interval_months),
    (now() at time zone 'Africa/Cairo')::date) h
  where t.vehicle_id = p_vehicle_id;
$$;

-- The car: score 0..100 (null = nothing measurable yet, the ring shows "Not tracked yet") and items per state.
create function public.car_health(p_vehicle_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'score', round(100 * sum(h.weight * h.health) / nullif(sum(h.weight) filter (where h.health is not null), 0)),
    'ok', count(*) filter (where h.state = 'ok'),
    'soon', count(*) filter (where h.state = 'soon'),
    'overdue', count(*) filter (where h.state = 'overdue'),
    'tracked', count(*) filter (where h.health is not null))
  from public.tracked_health(p_vehicle_id) h;
$$;

revoke execute on function public.recompute_tracked(uuid), public.write_visit_expense(uuid), public.save_visit(jsonb),
  public.item_health(integer, integer, date, integer, integer, date), public.tracked_health(uuid), public.car_health(uuid)
  from public, anon;
grant execute on function public.recompute_tracked(uuid), public.write_visit_expense(uuid), public.save_visit(jsonb),
  public.item_health(integer, integer, date, integer, integer, date), public.tracked_health(uuid), public.car_health(uuid)
  to authenticated;
