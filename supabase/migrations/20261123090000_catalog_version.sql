-- v2 flow 14: the app keeps a copy of the job types and parts on the phone (instant, offline search) and refetches it only when
-- this number changes. Any edit to catalog_items or job_types bumps it (statement triggers), so the admin dashboard needs no extra step.
create table public.catalog_meta (
  id boolean primary key default true check (id), -- one row only
  version integer not null default 1
);
insert into public.catalog_meta default values;
alter table public.catalog_meta enable row level security;
create policy "catalog meta readable" on public.catalog_meta for select to anon, authenticated using (true);
grant select on public.catalog_meta to anon, authenticated;

create function public.bump_catalog_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_meta set version = version + 1;
  return null;
end $$;
revoke execute on function public.bump_catalog_version() from public, anon, authenticated;

create trigger catalog_items_version after insert or update or delete on public.catalog_items for each statement execute function public.bump_catalog_version();
create trigger job_types_version after insert or update or delete on public.job_types for each statement execute function public.bump_catalog_version();
