-- Design screens 03/04: vehicle nickname + type, and operating hours for equipment.
alter table public.vehicles
  add column nickname text,
  add column vehicle_type text not null default 'car' check (vehicle_type in ('car', 'motorcycle', 'pickup', 'equipment'));

alter table public.vehicles drop constraint vehicles_odometer_unit_check;
alter table public.vehicles add constraint vehicles_odometer_unit_check check (odometer_unit in ('km', 'mi', 'h'));
