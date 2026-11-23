-- Admin push notifications (dashboard "Notifications" page): phone tokens, the messages themselves, and their recipients.
-- Sending is done by the dashboard server with the service role (Expo push API); the app only registers its token and reads
-- the messages addressed to it (so each one also shows in the Notifications bell, with or without a phone alert).

-- ─── Phone tokens ───────────────────────────────────────────────────────────
-- A token belongs to one phone; if another user signs in on the same phone the token moves to them (register_push_token).
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token text not null unique check (char_length(token) between 10 and 200),
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "own tokens read" on public.push_tokens for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;
create trigger push_tokens_cap before insert on public.push_tokens for each row execute function public.cap_rows(10);

create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.push_tokens (user_id, token, platform) values ((select auth.uid()), p_token, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create function public.remove_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;
revoke execute on function public.register_push_token(text, text), public.remove_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.remove_push_token(text) to authenticated;

-- ─── Messages ───────────────────────────────────────────────────────────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(title_ar) between 1 and 100),
  title_en text check (char_length(title_en) <= 100),
  body_ar text not null check (char_length(body_ar) between 1 and 500),
  body_en text check (char_length(body_en) <= 500),
  audience text not null check (audience in ('all', 'selected')),
  sent_by uuid references auth.users(id) on delete set null,
  push_sent integer not null default 0,
  push_failed integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.announcement_users (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (announcement_id, user_id)
);
create index announcement_users_user on public.announcement_users (user_id);
alter table public.announcements enable row level security;
alter table public.announcement_users enable row level security;
-- A user sees "to everyone" messages sent after they signed up, and the ones addressed to them. Nobody writes from the app.
create policy "announcements visible" on public.announcements for select to authenticated using (
  (audience = 'all' and created_at >= (select p.created_at from public.profiles p where p.id = (select auth.uid())))
  or exists (select 1 from public.announcement_users a where a.announcement_id = announcements.id and a.user_id = (select auth.uid())));
create policy "own recipient rows" on public.announcement_users for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.announcements, public.announcement_users to authenticated;
grant all on public.announcements, public.announcement_users to service_role;

-- History for the dashboard (owner and admin).
create function public.admin_announcements(p_limit integer default 50)
returns table (id uuid, title_ar text, title_en text, audience text, push_sent integer, push_failed integer, recipients bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.title_ar, a.title_en, a.audience, a.push_sent, a.push_failed,
           case when a.audience = 'all' then (select count(*) from public.profiles) else (select count(*) from public.announcement_users u where u.announcement_id = a.id) end,
           a.created_at
    from public.announcements a order by a.created_at desc limit least(greatest(p_limit, 1), 200);
end $$;
revoke execute on function public.admin_announcements(integer) from public, anon;
grant execute on function public.admin_announcements(integer) to authenticated;

-- The audit line accepts the new action (same function as 20261113090000_admin_users_admins.sql, one more name).
create or replace function public.admin_log(p_action text, p_target text, p_detail jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('create_user', 'create_admin', 'change_email', 'suspend_user', 'unsuspend_user', 'delete_user', 'send_push') then
    raise exception 'bad_action' using errcode = '22023';
  end if;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), p_action, left(p_target, 200), coalesce(p_detail, '{}'::jsonb));
end $$;
