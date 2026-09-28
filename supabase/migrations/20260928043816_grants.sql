-- New Supabase projects don't auto-grant table privileges to API roles.
-- Grant the minimum; RLS policies still decide which rows.
grant select on public.service_types to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.vehicles, public.maintenance_logs, public.reminders, public.expenses, public.vehicle_shares to authenticated;
grant select, insert on public.log_corrections to authenticated; -- append-only audit trail
grant execute on function public.owns_vehicle(uuid), public.owns_log(uuid), public.get_share(text) to authenticated;
