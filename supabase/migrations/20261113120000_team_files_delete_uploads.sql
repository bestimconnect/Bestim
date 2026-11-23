-- Team tracker files: delete a screenshot, return the new file's id, and a chunked upload fallback for the Claude connector (2026-11-13).
-- Why: Ahmed's Claude has to retype long base64 text and cut it short, so the connector now checks size and hash and can send the
-- file in small pieces. Nothing could be deleted before: there was no function and no storage policy.
-- Same rules as the rest of the tracker: no grants on tables, everything through functions, viewers are read-only.

-- ─── Admins who can write may delete files from the private bucket (also makes the upload rollback in the dashboard work) ───
create policy "admins remove team files" on storage.objects for delete to authenticated
  using (bucket_id = 'team-files' and public.is_admin() and public.admin_role() <> 'viewer');

-- ─── team_file_add now also returns the new file's id ───
create or replace function public.team_file_add(p_num integer, p_path text, p_mime text, p_size integer, p_comment uuid default null, p_via text default 'dashboard')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item uuid; fid uuid;
begin
  perform public.require_admin();
  select id into item from public.team_items where num = p_num;
  if item is null then return jsonb_build_object('error', 'not_found'); end if;
  perform public.team_require_writer();
  if left(p_path, 37) <> item::text || '/' then return jsonb_build_object('error', 'invalid', 'detail', 'path'); end if;
  perform set_config('team.via', case when p_via = 'mcp' then 'mcp' else 'dashboard' end, true);
  insert into public.team_files (item_id, comment_id, path, mime, size, uploaded_by)
  values (item, p_comment, p_path, p_mime, p_size, (select auth.uid()))
  returning id into fid;
  update public.team_items set updated_at = now() where id = item;
  return jsonb_build_object('ok', true, 'id', fid);
exception when check_violation or not_null_violation or foreign_key_violation then
  return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
end $$;

-- ─── Delete one file of an item. Returns its storage path; the caller removes the object. The history keeps a line. ───
create function public.team_file_delete(p_num integer, p_file_id uuid, p_via text default 'dashboard') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item uuid; gone public.team_files%rowtype;
begin
  perform public.require_admin();
  select id into item from public.team_items where num = p_num;
  if item is null then return jsonb_build_object('error', 'not_found'); end if;
  perform public.team_require_writer();
  delete from public.team_files where id = p_file_id and item_id = item returning * into gone;
  if gone.id is null then return jsonb_build_object('error', 'no_file'); end if;
  insert into public.team_activity (item_id, actor, via, action, detail)
  values (item, (select auth.uid()), case when p_via = 'mcp' then 'mcp' else 'dashboard' end, 'file_removed',
          jsonb_build_object('file_id', gone.id, 'mime', gone.mime, 'size', gone.size));
  update public.team_items set updated_at = now() where id = item;
  return jsonb_build_object('ok', true, 'path', gone.path);
end $$;

-- ─── Chunked upload: an upload is opened with its size and hash, filled piece by piece, then read back and checked by the function ───
create table public.team_uploads (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.team_keys(id) on delete cascade,
  item_num integer not null,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size integer not null check (size between 1 and 3000000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'open' check (status in ('open', 'done')),
  expires_at timestamptz not null default now() + interval '1 hour'
);
create index team_uploads_key on public.team_uploads (key_id);
create table public.team_upload_chunks (
  upload_id uuid not null references public.team_uploads(id) on delete cascade,
  idx integer not null check (idx between 0 and 3000),
  bytes bytea not null check (octet_length(bytes) between 1 and 1125), -- 1500 base64 characters
  primary key (upload_id, idx)
);
alter table public.team_uploads enable row level security;
alter table public.team_upload_chunks enable row level security;
revoke all on public.team_uploads, public.team_upload_chunks from anon, authenticated; -- no grants, no policies

-- ─── The connector's door, with the new actions: file_delete, upload_start, upload_chunk, upload_read, upload_done ───
-- Chunks are not counted against the hourly limit (a 100 KB image is about 90 of them); each upload is capped at 3 MB and
-- one key can hold 5 open uploads. Finished and expired uploads are purged whenever a new one starts.
create or replace function public.team_mcp(p_key text, p_action text, p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.team_keys%rowtype;
  a jsonb := coalesce(p_args, '{}');
  u public.team_uploads%rowtype;
  uid uuid;
begin
  select * into k from public.team_keys
   where key_hash = extensions.digest(coalesce(p_key, ''), 'sha256') and revoked_at is null for update;
  if not found then raise exception 'bad key' using errcode = '42501'; end if;
  if p_action <> 'upload_chunk' then
    if now() - k.window_start > interval '1 hour' then k.window_start := now(); k.window_uses := 0; end if;
    if k.window_uses >= 300 then raise exception 'rate limit' using errcode = '54000'; end if;
    update public.team_keys set window_start = k.window_start, window_uses = k.window_uses + 1, last_used_at = now() where id = k.id;
  end if;

  -- Act as the key's owner for the rest of this call: the team_* functions read auth.uid() and check is_admin().
  perform set_config('request.jwt.claims', jsonb_build_object('sub', k.user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', k.user_id::text, true);
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;

  if p_action = 'upload_start' then
    perform public.team_require_writer();
    delete from public.team_uploads where expires_at < now() or status = 'done';
    if (select count(*) from public.team_uploads where key_id = k.id) >= 5 then return jsonb_build_object('error', 'too_many'); end if;
    if not exists (select 1 from public.team_items where num = (a ->> 'num')::int) then return jsonb_build_object('error', 'not_found'); end if;
    insert into public.team_uploads (key_id, item_num, mime, size, sha256)
    values (k.id, (a ->> 'num')::int, a ->> 'mime', (a ->> 'size')::int, a ->> 'sha256') returning id into uid;
    return jsonb_build_object('upload_id', uid);
  elsif p_action in ('upload_chunk', 'upload_read', 'upload_done') then
    select * into u from public.team_uploads
     where id = (a ->> 'upload_id')::uuid and key_id = k.id and status = 'open' and expires_at > now();
    if not found then return jsonb_build_object('error', 'no_upload'); end if;
    if p_action = 'upload_chunk' then
      insert into public.team_upload_chunks (upload_id, idx, bytes)
      values (u.id, (a ->> 'index')::int, decode(a ->> 'data', 'base64'))
      on conflict (upload_id, idx) do update set bytes = excluded.bytes; -- sending an index again replaces it
      return jsonb_build_object('ok', true);
    elsif p_action = 'upload_read' then
      return jsonb_build_object('num', u.item_num, 'mime', u.mime, 'size', u.size, 'sha256', u.sha256,
        'chunks', coalesce((select jsonb_agg(jsonb_build_object('index', c.idx, 'data', encode(c.bytes, 'base64')) order by c.idx)
                            from public.team_upload_chunks c where c.upload_id = u.id), '[]'::jsonb));
    else
      update public.team_uploads set status = 'done' where id = u.id;
      delete from public.team_upload_chunks where upload_id = u.id;
      return jsonb_build_object('ok', true);
    end if;
  end if;

  return case p_action
    when 'list' then public.team_list(a ->> 'kind', coalesce(a -> 'filters', '{}'), coalesce((a ->> 'limit')::int, 50))
    when 'get' then public.team_get((a ->> 'num')::int)
    when 'save' then public.team_save(a -> 'item', 'mcp')
    when 'comment' then public.team_comment((a ->> 'num')::int, a ->> 'body', 'mcp')
    when 'file_add' then public.team_file_add((a ->> 'num')::int, a ->> 'path', a ->> 'mime', (a ->> 'size')::int, null, 'mcp')
    when 'file_delete' then public.team_file_delete((a ->> 'num')::int, (a ->> 'file_id')::uuid, 'mcp')
    when 'overview' then public.team_overview()
    else jsonb_build_object('error', 'unknown_action')
  end;
end $$;

revoke all on function public.team_file_delete(integer, uuid, text) from public, anon;
grant execute on function public.team_file_delete(integer, uuid, text) to authenticated;
