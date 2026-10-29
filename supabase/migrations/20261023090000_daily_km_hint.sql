-- How far the owner says they drive per day (km question at onboarding). Used only to estimate the odometer between readings.
alter table public.vehicles add column daily_km_hint integer check (daily_km_hint between 1 and 1000);
