-- This project grants table access explicitly (20260928043816_grants.sql); the car list needs the same
-- read access as service_types. Guests pick their car before they have an account, hence anon too.
grant select on public.car_makes, public.car_models to anon, authenticated;
