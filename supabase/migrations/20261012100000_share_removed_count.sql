-- Q100: the receiver of a shared history sees how many records the owner removed after their first day.
-- Same as get_share in 20261001090000_phase5.sql, plus removed_records.
drop function public.get_share(text);
create function public.get_share(token text)
returns table (
  vehicle_id uuid, make text, model text, year integer, nickname text, vehicle_type text,
  log_count bigint, shared_by_name text, includes_expenses boolean, expires_at timestamptz, own boolean,
  removed_records integer
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.make, v.model, v.year, v.nickname, v.vehicle_type,
         (select count(*) from public.maintenance_logs l where l.vehicle_id = v.id),
         p.full_name, s.includes_expenses, s.expires_at, s.shared_by = (select auth.uid()),
         v.removed_records
  from public.vehicle_shares s
  join public.vehicles v on v.id = s.vehicle_id
  join public.profiles p on p.id = s.shared_by
  where s.share_token = token and s.status = 'pending' and s.expires_at > now();
$$;
revoke execute on function public.get_share(text) from public, anon;
grant execute on function public.get_share(text) to authenticated;
