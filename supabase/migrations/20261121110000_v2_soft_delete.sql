-- v2 soft delete with 30-day recovery (spec 2.13 #8, bugs #22/#23): visits (column in the schema migration), cars, accounts.
-- Hiding is done by RLS, not views: a soft-deleted car disappears from vehicles, and every table that reads its rows through
-- the car (visits, tracked items, and now logs, reminders, expenses) hides them too. Deleting, restoring and listing go
-- through SECURITY DEFINER functions that check ownership, because the rows are invisible to the owner once deleted.
-- Accounts: the profile stays readable to its owner (the app needs deleted_at to offer "restore" after sign-in).
-- Purge: purge_soft_deleted() hard-deletes anything deleted more than 30 days ago. pg_cron is NOT enabled in this project;
-- once it is (Dashboard > Integrations > Cron), schedule it with:
--   select cron.schedule('bestim-purge', '17 3 * * *', 'select public.purge_soft_deleted()');
-- ponytail: purged receipt photos stay in storage; clean the bucket when the purge job is scheduled.

alter table public.vehicles add column deleted_at timestamptz;
alter table public.profiles add column deleted_at timestamptz;

-- A deleted car is not "owned" for writes (logs, reminders, expenses, shares, visits, tracked items all check this).
create or replace function public.owns_vehicle(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vehicles where id = v and user_id = (select auth.uid()) and deleted_at is null);
$$;

-- vehicles: split "own vehicles" so reads hide deleted cars and a plain update cannot set deleted_at.
drop policy "own vehicles" on public.vehicles;
create policy "own vehicles read" on public.vehicles for select to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);
create policy "own vehicles insert" on public.vehicles for insert to authenticated
  with check ((select auth.uid()) = user_id and deleted_at is null);
create policy "own vehicles update" on public.vehicles for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id and deleted_at is null);
create policy "own vehicles delete" on public.vehicles for delete to authenticated
  using ((select auth.uid()) = user_id); -- the v1 app still hard-deletes

-- Old tables: same rules as before, plus "the car is not deleted" (the vehicles subquery runs under vehicles' RLS).
drop policy "own logs" on public.maintenance_logs;
create policy "own logs" on public.maintenance_logs for all to authenticated
  using ((select auth.uid()) = user_id and vehicle_id in (select v.id from public.vehicles v))
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id));
drop policy "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id and vehicle_id in (select v.id from public.vehicles v))
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id));
drop policy "own expenses" on public.expenses;
create policy "own expenses" on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id and vehicle_id in (select v.id from public.vehicles v))
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id) and (log_id is null or public.owns_log(log_id))
              and (visit_id is null or visit_id in (select v.id from public.visits v)));

-- ─── Cars ────────────────────────────────────────────────────────────────────
create function public.soft_delete_vehicle(p_vehicle_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  update public.vehicles set deleted_at = now(), is_primary = false
  where id = p_vehicle_id and user_id = me and deleted_at is null;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  -- Keep one primary car: the newest remaining one.
  if not exists (select 1 from public.vehicles where user_id = me and is_primary and deleted_at is null) then
    update public.vehicles set is_primary = true
    where id = (select id from public.vehicles where user_id = me and deleted_at is null order by created_at desc limit 1);
  end if;
end $$;

create function public.restore_vehicle(p_vehicle_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicles set deleted_at = null,
    is_primary = not exists (select 1 from public.vehicles o where o.user_id = (select auth.uid()) and o.is_primary and o.deleted_at is null)
  where id = p_vehicle_id and user_id = (select auth.uid()) and deleted_at > now() - interval '30 days';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

-- ─── Visits ──────────────────────────────────────────────────────────────────
-- Deleting a visit also removes its expense and rolls tracked items back to the previous visit; restoring redoes both.
create function public.soft_delete_visit(p_visit_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  update public.visits set deleted_at = now()
  where id = p_visit_id and user_id = (select auth.uid()) and deleted_at is null
  returning * into v;
  if v.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  delete from public.expenses where visit_id = v.id;
  perform public.recompute_tracked(v.vehicle_id);
end $$;

create function public.restore_visit(p_visit_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  update public.visits set deleted_at = null
  where id = p_visit_id and user_id = (select auth.uid()) and deleted_at > now() - interval '30 days'
    and vehicle_id in (select id from public.vehicles where deleted_at is null)
  returning * into v;
  if v.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.write_visit_expense(v.id);
  perform public.recompute_tracked(v.vehicle_id);
end $$;

-- ─── Account ─────────────────────────────────────────────────────────────────
-- delete_my_account() (immediate, App Store rule) stays; this is the recoverable one.
create function public.soft_delete_my_account() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set deleted_at = now() where id = (select auth.uid()) and deleted_at is null;
$$;
create function public.restore_my_account() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set deleted_at = null where id = (select auth.uid()) and deleted_at > now() - interval '30 days';
$$;

-- ─── The "Recently deleted" list ─────────────────────────────────────────────
create function public.my_deleted_items()
returns table (kind text, id uuid, vehicle_id uuid, title text, deleted_at timestamptz, purge_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select 'vehicle', v.id, v.id, concat_ws(' ', v.make, v.model, v.year), v.deleted_at, v.deleted_at + interval '30 days'
  from public.vehicles v where v.user_id = (select auth.uid()) and v.deleted_at is not null
  union all
  select 'visit', s.id, s.vehicle_id, coalesce(s.workshop_name, s.visit_date::text), s.deleted_at, s.deleted_at + interval '30 days'
  from public.visits s where s.user_id = (select auth.uid()) and s.deleted_at is not null
  order by 5 desc;
$$;

-- ─── Purge (service role / cron only) ───────────────────────────────────────
create function public.purge_soft_deleted() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_visits int; n_cars int; n_users int;
begin
  delete from public.visits where deleted_at < now() - interval '30 days';
  get diagnostics n_visits = row_count;
  delete from public.vehicles where deleted_at < now() - interval '30 days';
  get diagnostics n_cars = row_count;
  delete from auth.users where id in (select id from public.profiles where deleted_at < now() - interval '30 days');
  get diagnostics n_users = row_count;
  return jsonb_build_object('visits', n_visits, 'vehicles', n_cars, 'users', n_users);
end $$;

revoke execute on function public.soft_delete_vehicle(uuid), public.restore_vehicle(uuid), public.soft_delete_visit(uuid),
  public.restore_visit(uuid), public.soft_delete_my_account(), public.restore_my_account(), public.my_deleted_items(),
  public.purge_soft_deleted() from public, anon;
grant execute on function public.soft_delete_vehicle(uuid), public.restore_vehicle(uuid), public.soft_delete_visit(uuid),
  public.restore_visit(uuid), public.soft_delete_my_account(), public.restore_my_account(), public.my_deleted_items() to authenticated;
grant execute on function public.purge_soft_deleted() to service_role;
