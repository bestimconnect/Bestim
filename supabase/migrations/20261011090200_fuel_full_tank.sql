-- Fuel consumption is measured between full tanks (decisions Q91). Rows saved before this count as full.
alter table public.expenses add column full_tank boolean not null default true;
