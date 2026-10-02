-- Add-vehicle picker now offers pictured body types (decisions Q52). The old values stay valid, no rows change.
alter table public.vehicles drop constraint vehicles_vehicle_type_check;
alter table public.vehicles add constraint vehicles_vehicle_type_check check (
  vehicle_type in ('car', 'sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van', 'motorcycle', 'equipment')
);
