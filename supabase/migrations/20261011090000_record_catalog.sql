-- Records get a category tree and fields that fit the category (CEO follow-up, 2026-10-10; decisions Q90).
-- 1. record_categories: two levels (category → subcategory). A running-cost subcategory carries the expense code it saves as.
--    Filled by the next migration, which scripts/record-catalog.ts writes from supabase/record-catalog.csv.
-- 2. service_types hang under a subcategory, say whether they remind, and list their extra form fields.
-- 3. A maintenance log keeps those extra fields in `details`; a fuel expense can keep litres and the reading.
-- 4. odometer_readings: every change of a car's reading leaves a row, so the Car log can show readings.
-- 5. correct_log can also correct the next-maintenance distance.

create table public.record_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.record_categories(id) on delete cascade, -- null = a top category
  name_en text not null,
  name_ar text not null,
  icon text,
  sort integer not null default 1000,
  expense_code text check (expense_code in ('fuel', 'wash', 'parking', 'tolls', 'insurance', 'registration', 'parts', 'other')),
  unique nulls not distinct (parent_id, name_en)
);
alter table public.record_categories enable row level security;
create policy "record categories readable" on public.record_categories for select to anon, authenticated using (true);
grant select on public.record_categories to anon, authenticated;

alter table public.service_types
  add column category_id uuid references public.record_categories(id) on delete set null, -- null = retired (Car Wash): old logs still show it, pickers do not
  add column has_reminder boolean not null default true,
  add column fields text[] not null default '{}',
  add column sort integer not null default 1000;

alter table public.maintenance_logs add column details jsonb not null default '{}';

alter table public.expenses
  add column liters numeric(7,2) check (liters > 0),
  add column odometer_reading integer check (odometer_reading >= 0);

create table public.odometer_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reading integer not null,
  created_at timestamptz not null default now()
);
create index odometer_readings_vehicle on public.odometer_readings(vehicle_id, created_at desc);
alter table public.odometer_readings enable row level security;
create policy "own readings" on public.odometer_readings for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.odometer_readings to authenticated;

-- One place for every path that moves the reading (the update screen, voice, a saved log, a received car).
create function public.keep_odometer_reading() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.odometer_readings (vehicle_id, user_id, reading) values (new.id, new.user_id, new.current_odometer);
  return null;
end;
$$;
revoke execute on function public.keep_odometer_reading() from public, anon, authenticated;
create trigger keep_odometer_reading after update of current_odometer on public.vehicles
  for each row when (new.current_odometer is distinct from old.current_odometer)
  execute function public.keep_odometer_reading();

-- Same as 20260929084332_phase3.sql, plus interval_km.
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
