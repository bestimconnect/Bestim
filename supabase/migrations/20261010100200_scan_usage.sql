-- Odometer camera: when the phone cannot read the display (digital segment digits), the read-odometer
-- Edge Function asks the AI to read the picture. Same protection as voice: it calls bump_scan_usage()
-- before every AI call and refuses past its daily limit. Counted on the user's voice_usage row for the day.
alter table public.voice_usage add column scans integer not null default 0;

create function public.bump_scan_usage() returns integer
language sql security definer set search_path = '' as $$
  insert into public.voice_usage (user_id, day, count, scans)
  values (auth.uid(), (now() at time zone 'Africa/Cairo')::date, 0, 1)
  on conflict (user_id, day) do update set scans = public.voice_usage.scans + 1
  returning scans;
$$;
revoke execute on function public.bump_scan_usage() from public, anon;
grant execute on function public.bump_scan_usage() to authenticated;
