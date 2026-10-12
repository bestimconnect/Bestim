-- Q105: a car can be added before its first reading. "No reading yet" = odometer_updated_at is null
-- (current_odometer stays 0, so a real reading of 0 is still possible). The app sets the date when the first reading is saved.
alter table public.vehicles alter column odometer_updated_at drop not null;
