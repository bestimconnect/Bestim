-- Push follow-up: what a tap does (info only / open a screen / open a link) and Expo ticket ids so delivery can be checked later.
alter table public.announcements
  add column action text not null default 'none' check (action in ('none', 'screen', 'link')),
  add column action_value text check (action_value is null or length(action_value) <= 300);

-- Expo ticket ids per message. Server only (service role): no grants to app users, RLS on with no policies.
create table public.announcement_tickets (
  ticket_id text primary key,
  announcement_id uuid not null references public.announcements (id) on delete cascade
);
alter table public.announcement_tickets enable row level security;
revoke all on public.announcement_tickets from public, anon, authenticated;
grant all on public.announcement_tickets to service_role;
create index on public.announcement_tickets (announcement_id);
