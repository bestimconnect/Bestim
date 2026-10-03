-- Voice logging: how many recordings each user sent to the AI per day (Cairo time).
-- The process-voice-log Edge Function calls bump_voice_usage() before every AI call and refuses
-- past its daily limit, so one account can't run up the AI bill.
-- ponytail: rows are never cleaned up (one tiny row per user per active day); add a purge if the table ever matters.
create table public.voice_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  count integer not null default 1,
  primary key (user_id, day)
);

alter table public.voice_usage enable row level security;
-- No grants or policies: only bump_voice_usage() below touches this table.

-- Counts one recording for the caller and returns today's total. A user calling it directly
-- only uses up their own allowance.
create function public.bump_voice_usage() returns integer
language sql security definer set search_path = '' as $$
  insert into public.voice_usage (user_id, day)
  values (auth.uid(), (now() at time zone 'Africa/Cairo')::date)
  on conflict (user_id, day) do update set count = public.voice_usage.count + 1
  returning count;
$$;
revoke execute on function public.bump_voice_usage() from public, anon;
grant execute on function public.bump_voice_usage() to authenticated;
