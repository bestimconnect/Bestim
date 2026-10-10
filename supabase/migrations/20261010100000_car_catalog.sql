-- Cars only, picked from a list (founder, 2026-10-10).
-- 1. The list owners pick their car from: brands and their models, each model with its body type.
--    Filled by the next migration, which scripts/car-catalog.ts writes from supabase/car-catalog.csv.
-- 2. A vehicle remembers which model was picked (null = typed by hand). make / model stay as plain text.
-- 3. Motorcycles and equipment are gone: vehicle_type is one of the eight pictured car types.
-- 4. Car wash and tolls become expense categories (running costs, not maintenance jobs).

create table public.car_makes (
  id uuid primary key default gen_random_uuid(),
  name_en text not null unique,
  name_ar text not null,
  sort integer not null default 1000 -- popular brands first, the rest by name
);

create table public.car_models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid not null references public.car_makes(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  body_type text not null check (body_type in ('sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van')),
  unique (make_id, name_en)
);

-- Reference data like service_types: everyone reads, nobody writes from the app.
alter table public.car_makes enable row level security;
create policy "car makes readable" on public.car_makes for select to anon, authenticated using (true);
alter table public.car_models enable row level security;
create policy "car models readable" on public.car_models for select to anon, authenticated using (true);

alter table public.vehicles add column car_model_id uuid references public.car_models(id) on delete set null;

-- Old rows ('car' from before the picker, and the two removed types) become the default picture.
update public.vehicles set vehicle_type = 'sedan' where vehicle_type in ('car', 'motorcycle', 'equipment');
alter table public.vehicles alter column vehicle_type set default 'sedan';
alter table public.vehicles drop constraint vehicles_vehicle_type_check;
alter table public.vehicles add constraint vehicles_vehicle_type_check check (
  vehicle_type in ('sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van')
);
-- ponytail: odometer_unit still accepts 'h' (operating hours) so no old row breaks; the app no longer offers it.

alter table public.expenses drop constraint expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('maintenance', 'fuel', 'wash', 'parking', 'tolls', 'insurance', 'registration', 'parts', 'other'));

-- A received car keeps its link to the list. Otherwise identical to 20261005090000_release_hardening.sql.
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

  insert into public.vehicles (user_id, make, model, car_model_id, year, plate_number, color, vin, current_odometer, odometer_unit, nickname, vehicle_type, is_primary)
  values (me, src.make, src.model, src.car_model_id, src.year, null, src.color, null, src.current_odometer, src.odometer_unit, src.nickname, src.vehicle_type,
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
