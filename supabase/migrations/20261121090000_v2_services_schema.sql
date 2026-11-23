-- v2 Services (Phase 1 data design; spec: Bestim_Bug_Report.pdf section 2, design-v2/BUG-AUDIT-AND-SERVICES-SPEC.md).
-- Visit > Job > Line items, a catalog built from the parts tree (16 systems, 2,047 parts) and the specialist catalog,
-- and per-car tracked items. Old tables (maintenance_logs, service_types, record_categories) stay untouched until the app
-- is cut over. Seeds: 20261121090100..090300 (scripts/v2-seed.mjs). Logic: 20261121100000. Soft delete: 20261121110000. Backfill: 20261121120000.
--
-- Category -> system mapping (job_types.system_id; source of truth: CATEGORY_SYSTEM / JOB_SYSTEM in scripts/v2-seed.mjs).
-- The PDF's 24 "systems" (2.5) are display groups; we file every job under one of the tree's 16 systems instead:
--   1 Engine: periodic service, belts & timing, engine repair, ignition, machining, quick service
--   2 Fuel: injection, fuel system, carburettor, CNG          3 Intake & exhaust: exhaust (+ air filter, throttle body jobs)
--   4 Cooling                                                 5 Transmission: CV joints, cardan & diff, clutch, gearboxes
--   7 12V: battery & charging, starting, wiring (+ horn)      8 Lighting: lighting, headlights & tail lights
--   9 Electronics: sensors, diagnostics, comfort electrics, gauges (+ remote/alarm, key programming)
--  10 Brakes (all three categories)  11 Steering  12 Suspension  13 Wheels & tyres: tyres, alignment & balancing
--  14 Climate: A/C (+ cabin filter)  15 Body & glass: bodywork, paint, bumpers, glass, locks & keys, cleaning (+ wipers, mirrors)
--  16 Interior: interior trim, accessories (+ airbag, interior cleaning, multimedia)
--   none: roadside (towing, jump start) and inspection (whole-car checks)
-- Ambiguous (a founder may move them): Paint, Glass, Cleaning, Locks & keys -> 15 Body; Accessories -> 16 Interior;
-- CNG -> 2 Fuel (no CNG system in the tree); Inspection / Roadside -> no system; Alignment & balancing -> 13 (could be 11/12);
-- Gauges -> 9 (could be 16 dashboard); Machining -> 1 (flywheel / drum machining is driveline / brakes).

-- ─── Arabic search normalisation ─────────────────────────────────────────────
-- Strip tashkeel (U+064B..U+065F, U+0670) and tatweel, unify alef forms, ى -> ي, ة -> ه, lowercase Latin, squeeze spaces.
-- Mirrored by normAr() in scripts/v2-seed.mjs.
create function public.normalize_ar(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
    translate(lower(regexp_replace(coalesce(t, ''), '[ً-ٰٟـ]', '', 'g')), 'أإآٱىة', 'اااايه'),
    '\s+', ' ', 'g'));
$$;
grant execute on function public.normalize_ar(text) to anon, authenticated;

-- What search_catalog() matches against: both names and every alias, normalised.
create function public.search_text(name_en text, name_ar text, aliases text[]) returns text
language sql immutable parallel safe set search_path = '' as $$
  select public.normalize_ar(name_ar || ' ' || name_en || ' ' || array_to_string(aliases, ' '));
$$;

-- ─── Car fuel type (filters diesel / hybrid / EV parts) ─────────────────────
alter table public.vehicles add column fuel_type text not null default 'petrol'
  check (fuel_type in ('petrol', 'diesel', 'hybrid', 'ev'));

-- ─── Reference data (read-only to the app) ──────────────────────────────────
create table public.systems (
  id smallint primary key,                    -- the tree's system number, 1..16
  name_en text not null,
  name_ar text not null,
  health_weight smallint not null default 1 check (health_weight between 1 and 5), -- car_health(): brakes and tyres = 2
  sort smallint not null
);

create table public.specialists (
  key text primary key,
  name_en text not null,
  name_ar text not null,
  shows_all_jobs boolean not null default false, -- dealer and DIY pick from every job
  sort smallint not null
);

create table public.catalog_items (
  id uuid primary key,                        -- md5(natural key)::uuid, set by the seed
  system_id smallint references public.systems(id),
  subsystem text, subsystem_ar text,          -- null for items that only come from the specialist catalog
  group_name text, group_ar text,
  name_en text not null,
  name_ar text not null,
  aliases text[] not null default '{}',
  search_text text generated always as (public.search_text(name_en, name_ar, aliases)) stored,
  fuel_types text[] check (fuel_types <@ array['petrol', 'diesel', 'hybrid', 'ev']), -- null = every car
  flags text[] not null default '{}',         -- check_catalog (tree '*'), quick_add (consumable chips)
  item_type text not null default 'part' check (item_type in ('part', 'consumable', 'service'))
);

create table public.job_types (
  id uuid primary key,                        -- md5(natural key)::uuid, set by the seed
  specialist_key text not null references public.specialists(key),
  category_en text not null,
  category_ar text not null,
  system_id smallint references public.systems(id), -- null = whole-car job (inspection, roadside)
  name_en text not null unique,
  name_ar text not null,
  aliases text[] not null default '{}',
  search_text text generated always as (public.search_text(name_en, name_ar, aliases)) stored,
  tracked boolean not null default false,
  default_interval_km integer check (default_interval_km > 0),
  default_interval_months integer check (default_interval_months > 0),
  fuel_types text[] check (fuel_types <@ array['petrol', 'diesel', 'hybrid', 'ev']),
  suggested_items uuid[] not null default '{}', -- catalog_items ids, in chip order
  sort smallint not null
);

alter table public.systems enable row level security;
alter table public.specialists enable row level security;
alter table public.catalog_items enable row level security;
alter table public.job_types enable row level security;
create policy "systems readable" on public.systems for select to anon, authenticated using (true);
create policy "specialists readable" on public.specialists for select to anon, authenticated using (true);
create policy "catalog items readable" on public.catalog_items for select to anon, authenticated using (true);
create policy "job types readable" on public.job_types for select to anon, authenticated using (true);
grant select on public.systems, public.specialists, public.catalog_items, public.job_types to anon, authenticated;

-- ─── Visits > jobs > line items (the owner's history) ───────────────────────
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  visit_date date not null default current_date,
  odometer integer check (odometer >= 0),     -- null only for old records that had none
  workshop_name text,
  workshop_phone text,
  notes text,
  photos text[] not null default '{}',        -- receipt photo paths in the receipts bucket
  legacy_log_id uuid unique references public.maintenance_logs(id) on delete cascade, -- backfill marker; old app deleting the log removes the copy
  deleted_at timestamptz,                     -- soft delete, purged after 30 days
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visits_text_len check (
    char_length(coalesce(workshop_name, '')) <= 200 and char_length(coalesce(workshop_phone, '')) <= 30
    and char_length(coalesce(notes, '')) <= 2000 and cardinality(photos) <= 10)
);
create index visits_vehicle_date on public.visits (vehicle_id, visit_date desc);
create index visits_user on public.visits (user_id);
create index visits_deleted on public.visits (deleted_at) where deleted_at is not null;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  specialist_key text not null references public.specialists(key),
  specialist_name text,                       -- free text for specialist 'other'
  job_type_id uuid references public.job_types(id),
  custom_name text,                           -- a job not in the catalog
  position text check (position in ('fl', 'fr', 'rl', 'rr', 'front', 'rear', 'all')),
  notes text,
  sort smallint not null default 0,
  constraint jobs_named check (job_type_id is not null or coalesce(btrim(custom_name), '') <> ''),
  constraint jobs_text_len check (
    char_length(coalesce(specialist_name, '')) <= 100 and char_length(coalesce(custom_name, '')) <= 200
    and char_length(coalesce(notes, '')) <= 2000)
);
create index jobs_visit on public.jobs (visit_id);
create index jobs_job_type on public.jobs (job_type_id);

-- 'labor': exactly one per job (0 allowed). Enforced by save_visit(), not a trigger.
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  type text not null check (type in ('part', 'consumable', 'labor', 'machine_shop', 'diagnostic_fee', 'towing', 'tip', 'other')),
  catalog_item_id uuid references public.catalog_items(id),
  name text not null,
  qty numeric(10,2) not null default 1 check (qty > 0),
  unit text check (unit in ('piece', 'set', 'pair', 'litre', 'can', 'kg', 'metre')),
  unit_price numeric(10,2) check (unit_price >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  brand text,
  origin text check (origin in ('oem', 'korean', 'japanese', 'german', 'turkish', 'taiwanese', 'chinese', 'local', 'other')),
  condition text check (condition in ('new', 'used', 'imported_used', 'rebuilt')),
  part_number text,
  warranty_months smallint check (warranty_months between 0 and 240),
  constraint line_items_text_len check (
    char_length(name) between 1 and 200 and char_length(coalesce(brand, '')) <= 100 and char_length(coalesce(part_number, '')) <= 100)
);
create index line_items_job on public.line_items (job_id);
create index line_items_catalog on public.line_items (catalog_item_id);

-- A car x (job type | catalog item). Intervals here override the job type's defaults for this car.
-- last_done_* is maintained by recompute_tracked() from the latest live visit; with no visit it is what the owner typed.
create table public.tracked_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  job_type_id uuid references public.job_types(id),
  catalog_item_id uuid references public.catalog_items(id),
  interval_km integer check (interval_km > 0),
  interval_months integer check (interval_months > 0),
  last_done_km integer check (last_done_km >= 0),
  last_done_date date,
  last_done_visit_id uuid references public.visits(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tracked_items_one_target check (num_nonnulls(job_type_id, catalog_item_id) = 1)
);
create unique index tracked_items_job on public.tracked_items (vehicle_id, job_type_id) where job_type_id is not null;
create unique index tracked_items_item on public.tracked_items (vehicle_id, catalog_item_id) where catalog_item_id is not null;

create trigger set_updated_at before update on public.visits for each row execute function extensions.moddatetime(updated_at);

-- Row caps (same cap_rows as 20261104090000_db_hardening.sql). Visits replace logs, so they share the plan's max_logs.
create trigger visits_cap before insert on public.visits for each row execute function public.cap_rows(10000, 'max_logs');
create trigger jobs_cap before insert on public.jobs for each row execute function public.cap_rows(20, '', 'visit_id');
create trigger line_items_cap before insert on public.line_items for each row execute function public.cap_rows(50, '', 'job_id');
create trigger tracked_items_cap before insert on public.tracked_items for each row execute function public.cap_rows(300, '', 'vehicle_id');

-- ─── RLS: own rows only; children are reached through their (visible) parent ─
-- The parent subqueries run under the parent's RLS, so a soft-deleted visit or car hides everything under it.
alter table public.visits enable row level security;
alter table public.jobs enable row level security;
alter table public.line_items enable row level security;
alter table public.tracked_items enable row level security;

create policy "own visits read" on public.visits for select to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null and vehicle_id in (select v.id from public.vehicles v));
create policy "own visits insert" on public.visits for insert to authenticated
  with check ((select auth.uid()) = user_id and deleted_at is null and legacy_log_id is null and public.owns_vehicle(vehicle_id));
create policy "own visits update" on public.visits for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id and deleted_at is null and public.owns_vehicle(vehicle_id));
-- No delete grant: deleting is soft (soft_delete_visit), the purge removes rows.

create policy "own jobs" on public.jobs for all to authenticated
  using (visit_id in (select v.id from public.visits v))
  with check (visit_id in (select v.id from public.visits v));
create policy "own line items" on public.line_items for all to authenticated
  using (job_id in (select j.id from public.jobs j))
  with check (job_id in (select j.id from public.jobs j));
create policy "own tracked items" on public.tracked_items for all to authenticated
  using (vehicle_id in (select v.id from public.vehicles v))
  with check (public.owns_vehicle(vehicle_id) and (last_done_visit_id is null or last_done_visit_id in (select v.id from public.visits v)));

grant select, insert, update on public.visits to authenticated;
grant select, insert, update, delete on public.jobs, public.line_items, public.tracked_items to authenticated;

-- ─── One expense per visit ──────────────────────────────────────────────────
-- breakdown: {"labor": n, "parts": n, "consumables": n, "other": n}, written by save_visit().
alter table public.expenses
  add column visit_id uuid references public.visits(id) on delete cascade,
  add column breakdown jsonb check (breakdown is null or jsonb_typeof(breakdown) = 'object');
create unique index expenses_one_per_visit on public.expenses (visit_id) where visit_id is not null;

-- ─── Search: job types and catalog items by any name or alias, filtered by the car's fuel type ─
-- Every word of q must appear. Fuel-flagged rows only for a matching car; unflagged rows for all.
-- No vehicle (or one the caller cannot see) = no fuel filter.
-- ponytail: substring scan over ~2.7k rows; add a pg_trgm index if it ever shows up in timings.
create function public.search_catalog(q text, p_vehicle_id uuid default null, max_rows integer default 50)
returns table (kind text, id uuid, name_en text, name_ar text, system_id smallint, item_type text, specialist_key text)
language sql stable security invoker set search_path = '' as $$
  with fuel as (select v.fuel_type from public.vehicles v where v.id = p_vehicle_id),
  words as (select array_remove(string_to_array(public.normalize_ar(q), ' '), '') as w),
  hits as (
    select 'job'::text as kind, j.id, j.name_en, j.name_ar, j.system_id, null::text as item_type, j.specialist_key, j.search_text, j.fuel_types, 0 as rank_kind
    from public.job_types j
    union all
    select 'item', c.id, c.name_en, c.name_ar, c.system_id, c.item_type, null, c.search_text, c.fuel_types, 1
    from public.catalog_items c
  )
  select h.kind, h.id, h.name_en, h.name_ar, h.system_id, h.item_type, h.specialist_key
  from hits h, words
  where cardinality(words.w) > 0
    and not exists (select 1 from unnest(words.w) x where position(x in h.search_text) = 0)
    and (h.fuel_types is null or not exists (select 1 from fuel) or (select f.fuel_type from fuel f) = any (h.fuel_types))
  order by (position(words.w[1] in h.search_text) = 1) desc, h.rank_kind, length(h.name_ar), h.name_en
  limit least(greatest(max_rows, 1), 200);
$$;
revoke execute on function public.search_catalog(text, uuid, integer) from public;
grant execute on function public.search_catalog(text, uuid, integer) to anon, authenticated;
