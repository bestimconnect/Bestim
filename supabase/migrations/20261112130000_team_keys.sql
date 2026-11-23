-- Team tracker: personal keys so an admin's Claude can connect without the sign-in button (Plan A, a bridge until the
-- OAuth sign-in can be used). One admin can hold several keys; only the hash is stored; a key stops working the moment it
-- is revoked or its owner stops being an admin. team_mcp() runs the same team_* functions the dashboard uses, as that admin.
create table public.team_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  key_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  window_start timestamptz not null default now(),
  window_uses integer not null default 0
);
create index team_keys_user on public.team_keys (user_id);
alter table public.team_keys enable row level security;
revoke all on public.team_keys from anon, authenticated; -- no grants, no policies: only the functions below touch it

-- Make a key (admins only; viewers too, their writes are refused later by team_require_writer). Shown once.
create function public.team_key_create(p_label text) returns text
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  perform public.require_admin();
  if (select count(*) from public.team_keys where user_id = (select auth.uid()) and revoked_at is null) >= 10 then
    raise exception 'too many keys' using errcode = '22023';
  end if;
  k := 'bsk_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.team_keys (user_id, label, key_hash)
  values ((select auth.uid()), left(coalesce(nullif(trim(p_label), ''), 'Claude'), 60), extensions.digest(k, 'sha256'));
  return k;
end $$;

create function public.team_key_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'created_at', created_at,
    'last_used_at', last_used_at, 'revoked_at', revoked_at) order by created_at desc)
    from public.team_keys where user_id = (select auth.uid())), '[]'::jsonb);
end $$;

create function public.team_key_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.team_keys set revoked_at = now() where id = p_id and user_id = (select auth.uid()) and revoked_at is null;
end $$;

-- The door the team-mcp Edge Function uses. Anyone can call it, but nothing happens without a live key of a current admin.
-- p_action: list | get | save | comment | file_add | overview.
create function public.team_mcp(p_key text, p_action text, p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.team_keys%rowtype;
  a jsonb := coalesce(p_args, '{}');
begin
  select * into k from public.team_keys
   where key_hash = extensions.digest(coalesce(p_key, ''), 'sha256') and revoked_at is null for update;
  if not found then raise exception 'bad key' using errcode = '42501'; end if;
  if now() - k.window_start > interval '1 hour' then k.window_start := now(); k.window_uses := 0; end if;
  if k.window_uses >= 300 then raise exception 'rate limit' using errcode = '54000'; end if;
  update public.team_keys set window_start = k.window_start, window_uses = k.window_uses + 1, last_used_at = now() where id = k.id;

  -- Act as the key's owner for the rest of this call: the team_* functions read auth.uid() and check is_admin().
  perform set_config('request.jwt.claims', jsonb_build_object('sub', k.user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', k.user_id::text, true);
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;

  return case p_action
    when 'list' then public.team_list(a ->> 'kind', coalesce(a -> 'filters', '{}'), coalesce((a ->> 'limit')::int, 50))
    when 'get' then public.team_get((a ->> 'num')::int)
    when 'save' then public.team_save(a -> 'item', 'mcp')
    when 'comment' then public.team_comment((a ->> 'num')::int, a ->> 'body', 'mcp')
    when 'file_add' then public.team_file_add((a ->> 'num')::int, a ->> 'path', a ->> 'mime', (a ->> 'size')::int, null, 'mcp')
    when 'overview' then public.team_overview()
    else jsonb_build_object('error', 'unknown_action')
  end;
end $$;

revoke all on function public.team_key_create(text), public.team_key_list(), public.team_key_revoke(uuid) from public, anon;
grant execute on function public.team_key_create(text), public.team_key_list(), public.team_key_revoke(uuid) to authenticated;
revoke all on function public.team_mcp(text, text, jsonb) from public;
grant execute on function public.team_mcp(text, text, jsonb) to anon, authenticated;
