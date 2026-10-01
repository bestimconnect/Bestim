-- Phase 4: expenses are the single source for money totals (screens 06, 09, 23).
-- A maintenance log's own cost becomes an expense automatically (from_log = true), so totals never double count.

alter table public.expenses drop constraint expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('maintenance', 'fuel', 'insurance', 'registration', 'parking', 'parts', 'other'));

alter table public.expenses add column from_log boolean not null default false;
create unique index expenses_one_per_log on public.expenses(log_id) where from_log;

-- Runs as the caller: RLS on expenses still applies (the log's owner writes their own expense).
-- Only touches the from_log row, never extra expenses the user linked to the log (decisions Q28).
create function public.log_expense() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.expenses where log_id = new.id and from_log;
  end if;
  if new.cost is not null and new.cost > 0 then
    insert into public.expenses (vehicle_id, user_id, log_id, category, amount, currency, description, expense_date, from_log)
    values (new.vehicle_id, new.user_id, new.id, 'maintenance', new.cost, new.currency, new.title, new.service_date, true);
  end if;
  return null;
end;
$$;
revoke execute on function public.log_expense() from public, anon, authenticated;

create trigger log_expense after insert or update of cost, service_date, title on public.maintenance_logs
  for each row execute function public.log_expense();

-- Backfill logs saved before this migration.
insert into public.expenses (vehicle_id, user_id, log_id, category, amount, currency, description, expense_date, from_log)
select l.vehicle_id, l.user_id, l.id, 'maintenance', l.cost, l.currency, l.title, l.service_date, true
from public.maintenance_logs l
where l.cost > 0 and not exists (select 1 from public.expenses e where e.log_id = l.id and e.from_log);
