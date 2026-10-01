-- Phase 5: notification preferences, receiving a shared vehicle history, account deletion.

-- ─── Notification preferences (screen 28) ───────────────────
alter table public.profiles add column notification_prefs jsonb not null
  default '{"due_soon": true, "overdue": true, "odometer": true, "weekly": false, "quiet_from": 22, "quiet_to": 8}';

-- ─── Share lookup (screen 42): what the receiver sees before accepting ─
drop function public.get_share(text);
create function public.get_share(token text)
returns table (
  vehicle_id uuid, make text, model text, year integer, nickname text, vehicle_type text,
  log_count bigint, shared_by_name text, includes_expenses boolean, expires_at timestamptz, own boolean
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.make, v.model, v.year, v.nickname, v.vehicle_type,
         (select count(*) from public.maintenance_logs l where l.vehicle_id = v.id),
         p.full_name, s.includes_expenses, s.expires_at, s.shared_by = (select auth.uid())
  from public.vehicle_shares s
  join public.vehicles v on v.id = s.vehicle_id
  join public.profiles p on p.id = s.shared_by
  where s.share_token = token and s.status = 'pending' and s.expires_at > now();
$$;
revoke execute on function public.get_share(text) from public, anon;
grant execute on function public.get_share(text) to authenticated;

-- ─── Accept a share: copy the vehicle and its history to the caller ─
-- The owner keeps theirs (screen 41: sharing doesn't transfer ownership). Receipt photos stay private to the
-- owner (storage is per-user), so copies carry no photos. A token works once.
create function public.accept_share(token text) returns uuid
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

  select * into s from public.vehicle_shares
  where share_token = token and status = 'pending' and expires_at > now()
  for update;
  if s.id is null then raise exception 'share not found'; end if;
  if s.shared_by = me then raise exception 'own share'; end if;

  select * into src from public.vehicles where id = s.vehicle_id;

  insert into public.vehicles (user_id, make, model, year, plate_number, color, vin, current_odometer, odometer_unit, nickname, vehicle_type, is_primary)
  values (me, src.make, src.model, src.year, src.plate_number, src.color, src.vin, src.current_odometer, src.odometer_unit, src.nickname, src.vehicle_type,
          not exists (select 1 from public.vehicles where user_id = me))
  returning id into new_vehicle;

  for r in select * from public.maintenance_logs where vehicle_id = src.id order by service_date, created_at loop
    insert into public.maintenance_logs (vehicle_id, user_id, service_type_id, title, description, odometer_reading, cost, currency,
                                         service_date, location, source, voice_transcript, parts_replaced, interval_km, interval_months)
    values (new_vehicle, me, r.service_type_id, r.title, r.description, r.odometer_reading,
            case when s.includes_expenses then r.cost end, r.currency,
            r.service_date, r.location, r.source, r.voice_transcript, r.parts_replaced, r.interval_km, r.interval_months)
    returning id into new_log;

    -- Keep the history honest: same status and the same correction trail as the original.
    update public.maintenance_logs set status = r.status where id = new_log;
    insert into public.log_corrections (log_id, field_name, old_value, new_value, reason, corrected_at, corrected_by)
    select new_log, c.field_name, c.old_value, c.new_value, c.reason, c.corrected_at, me
    from public.log_corrections c where c.log_id = r.id;
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
revoke execute on function public.accept_share(text) from public, anon;
grant execute on function public.accept_share(text) to authenticated;

-- ─── Delete my account (App Store rule for apps with sign-up). Cascades to all the user's rows. ─
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
