-- Team tracker (bugs and tasks) for the admin dashboard, plus what the Claude connector (team-mcp Edge Function) uses.
-- Written 2026-11-12, NOT applied. Nobody reads or writes these tables directly: every table has no grants and no
-- policies, and everything goes through the admin-only functions below (each starts with require_admin()).
-- The dashboard calls them with the admin's session; team-mcp calls the same ones with the admin's own token (p_via = 'mcp').
--
-- After the push, by hand (the names drive the "Waiting for me" box):
--   update public.admins set team_name = 'Shady' where user_id = (select id from auth.users where email = 'shaadygamal@gmail.com');
-- Ahmed is added as an admin by Shady (role owner); once he is in, give him his name:
--   update public.admins set team_name = 'Ahmed' where user_id = (select id from auth.users where email = '<ahmed email>');

alter table public.admins add column team_name text check (team_name in ('Shady', 'Ahmed', 'Daytwo'));

-- ─── Tables ─────────────────────────────────────────────────
create table public.team_items (
  id uuid primary key default gen_random_uuid(),
  num integer generated always as identity unique,   -- shown as "#12"
  legacy_ref text unique check (char_length(legacy_ref) <= 20), -- e.g. BES-5, kept from Linear
  kind text not null check (kind in ('bug', 'task')),
  title text not null check (char_length(title) between 1 and 200),
  status text not null,
  severity text check (severity in ('Blocker', 'High', 'Medium', 'Low')),   -- bugs
  priority text check (priority in ('High', 'Medium', 'Low')),             -- tasks
  platform text check (platform in ('iPhone', 'Android', 'Web', 'Both')),
  area text check (area in ('App', 'Store', 'Website', 'Connect', 'Backend')),
  build text check (char_length(build) <= 120),
  screen text check (char_length(screen) <= 120),
  steps text check (char_length(steps) <= 10000),
  expected text check (char_length(expected) <= 10000),
  actual text check (char_length(actual) <= 10000),
  reported_by uuid references auth.users(id) on delete set null,
  task_type text check (char_length(task_type) <= 60),
  owner text check (owner in ('Shady', 'Ahmed', 'Daytwo')),               -- tasks
  due_date date,
  details text check (char_length(details) <= 10000),
  link_num integer references public.team_items(num) on delete set null,  -- a bug points at its task
  created_by uuid references auth.users(id) on delete set null,
  created_via text not null default 'dashboard' check (created_via in ('dashboard', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (
    (kind = 'bug' and status in ('New', 'Confirmed', 'In progress', 'Fixed in build', 'Verified', 'Closed', 'Won''t fix') and severity is not null)
    or (kind = 'task' and status in ('Backlog', 'To do', 'In progress', 'Waiting for Ahmed', 'Waiting for Shady', 'Done') and owner is not null)
  ),
  check (link_num is distinct from num)
);
create index team_items_kind_status on public.team_items (kind, status);
create index team_items_link on public.team_items (link_num);

create table public.team_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.team_items(id) on delete cascade,
  author uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  via text not null default 'dashboard' check (via in ('dashboard', 'mcp')),
  created_at timestamptz not null default now()
);
create index team_comments_item on public.team_comments (item_id, created_at);

create table public.team_files (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.team_items(id) on delete cascade,
  comment_id uuid references public.team_comments(id) on delete set null,
  path text not null check (char_length(path) <= 300),   -- in the team-files bucket
  mime text not null check (char_length(mime) <= 100),
  size integer not null check (size between 1 and 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index team_files_item on public.team_files (item_id);

create table public.team_activity (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.team_items(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  via text not null default 'dashboard',
  action text not null,   -- created | status | owner | edited | comment | file
  detail jsonb,
  created_at timestamptz not null default now()
);
create index team_activity_item on public.team_activity (item_id, created_at desc);

-- No grants, no policies (RLS alone would give "permission denied" anyway; this makes it explicit).
alter table public.team_items enable row level security;
alter table public.team_comments enable row level security;
alter table public.team_files enable row level security;
alter table public.team_activity enable row level security;
revoke all on public.team_items, public.team_comments, public.team_files, public.team_activity from anon, authenticated;

-- ─── Helpers and triggers ───────────────────────────────────
create function public.team_closed(s text) returns boolean
language sql immutable set search_path = '' as $$ select s in ('Closed', 'Won''t fix', 'Done') $$;

create function public.team_who(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select team_name from public.admins where user_id = uid), (select split_part(email, '@', 1) from auth.users where id = uid));
$$;

-- Writing needs an admin who is not a viewer (viewers can read the tracker, not change it).
create function public.team_require_writer() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if public.admin_role() = 'viewer' then
    raise exception 'read only' using errcode = '42501';
  end if;
end $$;

-- Keeps updated_at and closed_at right, whoever wrote the row.
create function public.team_items_before() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if public.team_closed(new.status) then
    if tg_op = 'INSERT' then
      new.closed_at := now();
    elsif not public.team_closed(old.status) then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger team_items_before before insert or update on public.team_items
  for each row execute function public.team_items_before();

-- The activity log is written here, so no caller can forget it. The functions below set team.via for the transaction.
create function public.team_items_after() returns trigger
language plpgsql set search_path = '' as $$
declare
  v text := coalesce(nullif(current_setting('team.via', true), ''), 'dashboard');
  me uuid := (select auth.uid());
  skip text[] := array['status', 'owner', 'updated_at', 'closed_at'];
begin
  if tg_op = 'INSERT' then
    insert into public.team_activity (item_id, actor, via, action, detail)
    values (new.id, new.created_by, v, 'created', jsonb_build_object('status', new.status));
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.team_activity (item_id, actor, via, action, detail)
    values (new.id, me, v, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.owner is distinct from old.owner then
    insert into public.team_activity (item_id, actor, via, action, detail)
    values (new.id, me, v, 'owner', jsonb_build_object('from', old.owner, 'to', new.owner));
  end if;
  if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    insert into public.team_activity (item_id, actor, via, action) values (new.id, me, v, 'edited');
  end if;
  return null;
end $$;
create trigger team_items_after after insert or update on public.team_items
  for each row execute function public.team_items_after();

create function public.team_children_after() returns trigger
language plpgsql set search_path = '' as $$
declare v text := coalesce(nullif(current_setting('team.via', true), ''), 'dashboard');
begin
  if tg_table_name = 'team_comments' then
    insert into public.team_activity (item_id, actor, via, action, detail)
    values (new.item_id, new.author, v, 'comment', jsonb_build_object('comment_id', new.id));
  else
    insert into public.team_activity (item_id, actor, via, action, detail)
    values (new.item_id, new.uploaded_by, v, 'file', jsonb_build_object('file_id', new.id, 'mime', new.mime));
  end if;
  return null;
end $$;
create trigger team_comments_after after insert on public.team_comments for each row execute function public.team_children_after();
create trigger team_files_after after insert on public.team_files for each row execute function public.team_children_after();

revoke execute on function public.team_closed(text), public.team_who(uuid), public.team_require_writer(), public.team_items_before(),
  public.team_items_after(), public.team_children_after() from public, anon, authenticated;

-- ─── Admin functions (the only door) ────────────────────────
-- List for the board / table. Short rows only (no long texts). p_filters keys: status, owner, severity, area,
-- platform, q (title, "#12" or BES-5), open (true), mine (true = my tasks or waiting for me).
create function public.team_list(p_kind text default null, p_filters jsonb default '{}', p_limit integer default 200)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me text;
  q text := lower(trim(coalesce(p_filters ->> 'q', '')));
begin
  perform public.require_admin();
  select team_name into me from public.admins where user_id = (select auth.uid());
  return coalesce((
    select jsonb_agg(x order by x.updated_at desc) from (
      select i.num, i.kind, i.title, i.status, i.severity, i.priority, i.platform, i.area, i.owner, i.due_date,
             i.link_num, i.legacy_ref, i.created_at, i.updated_at, i.closed_at,
             (select count(*) from public.team_comments c where c.item_id = i.id) as comments
      from public.team_items i
      where (p_kind is null or i.kind = p_kind)
        and (p_filters ->> 'status' is null or i.status = p_filters ->> 'status')
        and (p_filters ->> 'owner' is null or i.owner = p_filters ->> 'owner')
        and (p_filters ->> 'severity' is null or i.severity = p_filters ->> 'severity')
        and (p_filters ->> 'area' is null or i.area = p_filters ->> 'area')
        and (p_filters ->> 'platform' is null or i.platform = p_filters ->> 'platform')
        and (not coalesce((p_filters ->> 'open')::boolean, false) or not public.team_closed(i.status))
        and (not coalesce((p_filters ->> 'mine')::boolean, false) or i.owner = me or i.status = 'Waiting for ' || me)
        and (q = '' or position(q in lower(i.title)) > 0 or q = '#' || i.num or lower(coalesce(i.legacy_ref, '')) = q)
      order by i.updated_at desc
      limit least(greatest(p_limit, 1), 500)
    ) x
  ), '[]'::jsonb);
end $$;

-- One item with everything: comments, files, activity, the linked task, and the bugs that point at it.
create function public.team_get(p_num integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare i public.team_items%rowtype;
begin
  perform public.require_admin();
  select * into i from public.team_items where num = p_num;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  return jsonb_build_object(
    'item', to_jsonb(i) || jsonb_build_object('reported_by_name', public.team_who(i.reported_by), 'created_by_name', public.team_who(i.created_by)),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'via', c.via, 'at', c.created_at, 'author', public.team_who(c.author)) order by c.created_at)
                          from public.team_comments c where c.item_id = i.id), '[]'),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.path, 'mime', f.mime, 'size', f.size, 'comment_id', f.comment_id, 'at', f.created_at, 'by', public.team_who(f.uploaded_by)) order by f.created_at)
                       from public.team_files f where f.item_id = i.id), '[]'),
    'activity', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'detail', a.detail, 'via', a.via, 'at', a.created_at, 'actor', public.team_who(a.actor)) order by a.created_at desc)
                          from (select * from public.team_activity where item_id = i.id order by created_at desc limit 100) a), '[]'),
    'linked', (select jsonb_build_object('num', l.num, 'kind', l.kind, 'title', l.title, 'status', l.status) from public.team_items l where l.num = i.link_num),
    'linked_from', coalesce((select jsonb_agg(jsonb_build_object('num', b.num, 'kind', b.kind, 'title', b.title, 'status', b.status) order by b.num)
                             from public.team_items b where b.link_num = i.num), '[]')
  );
end $$;

-- Create (no "num") or change (with "num": only the keys you send change; send null to clear a field).
-- Protected keys are ignored. Answers {ok, num} or {error: 'not_found' | 'invalid', detail}.
create function public.team_save(p_item jsonb, p_via text default 'dashboard') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean jsonb := p_item - array['id', 'created_by', 'created_via', 'created_at', 'updated_at', 'closed_at'];
  cur public.team_items%rowtype;
  r public.team_items%rowtype;
begin
  perform public.require_admin();
  perform set_config('team.via', case when p_via = 'mcp' then 'mcp' else 'dashboard' end, true);
  perform public.team_require_writer();
  if p_item ? 'num' then
    select * into cur from public.team_items where num = (p_item ->> 'num')::integer for update;
    if not found then return jsonb_build_object('error', 'not_found'); end if;
    r := jsonb_populate_record(cur, clean - 'num' - 'kind');
    update public.team_items set
      legacy_ref = r.legacy_ref, title = r.title, status = r.status, severity = r.severity, priority = r.priority,
      platform = r.platform, area = r.area, build = r.build, screen = r.screen, steps = r.steps, expected = r.expected,
      actual = r.actual, reported_by = r.reported_by, task_type = r.task_type, owner = r.owner, due_date = r.due_date,
      details = r.details, link_num = r.link_num
    where id = cur.id;
    return jsonb_build_object('ok', true, 'num', cur.num);
  end if;
  r := jsonb_populate_record(null::public.team_items, clean);
  insert into public.team_items (
    legacy_ref, kind, title, status, severity, priority, platform, area, build, screen, steps, expected, actual,
    reported_by, task_type, owner, due_date, details, link_num, created_by, created_via)
  values (
    r.legacy_ref, r.kind, r.title,
    coalesce(r.status, case when r.kind = 'bug' then 'New' else 'To do' end),
    r.severity, r.priority, r.platform, r.area, r.build, r.screen, r.steps, r.expected, r.actual,
    case when r.kind = 'bug' then coalesce(r.reported_by, me) end, r.task_type, r.owner, r.due_date, r.details, r.link_num,
    me, case when p_via = 'mcp' then 'mcp' else 'dashboard' end)
  returning * into r;
  return jsonb_build_object('ok', true, 'num', r.num);
exception when check_violation or not_null_violation or foreign_key_violation or unique_violation or string_data_right_truncation or invalid_text_representation then
  return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
end $$;

create function public.team_comment(p_num integer, p_body text, p_via text default 'dashboard') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item uuid;
begin
  perform public.require_admin();
  select id into item from public.team_items where num = p_num;
  if item is null then return jsonb_build_object('error', 'not_found'); end if;
  perform public.team_require_writer();
  perform set_config('team.via', case when p_via = 'mcp' then 'mcp' else 'dashboard' end, true);
  insert into public.team_comments (item_id, author, body, via)
  values (item, (select auth.uid()), trim(p_body), case when p_via = 'mcp' then 'mcp' else 'dashboard' end);
  update public.team_items set updated_at = now() where id = item;
  return jsonb_build_object('ok', true);
exception when check_violation or not_null_violation then
  return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
end $$;

-- Registers a file that was already uploaded to the team-files bucket. The path must sit under the item's own folder.
create function public.team_file_add(p_num integer, p_path text, p_mime text, p_size integer, p_comment uuid default null, p_via text default 'dashboard')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item uuid;
begin
  perform public.require_admin();
  select id into item from public.team_items where num = p_num;
  if item is null then return jsonb_build_object('error', 'not_found'); end if;
  perform public.team_require_writer();
  if left(p_path, 37) <> item::text || '/' then return jsonb_build_object('error', 'invalid', 'detail', 'path'); end if;
  perform set_config('team.via', case when p_via = 'mcp' then 'mcp' else 'dashboard' end, true);
  insert into public.team_files (item_id, comment_id, path, mime, size, uploaded_by)
  values (item, p_comment, p_path, p_mime, p_size, (select auth.uid()));
  update public.team_items set updated_at = now() where id = item;
  return jsonb_build_object('ok', true);
exception when check_violation or not_null_violation or foreign_key_violation then
  return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
end $$;

-- Everything the Team overview page draws, in one call. "Closed" = Closed / Won't fix / Done.
create function public.team_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me text;
  today date := (now() at time zone 'Africa/Cairo')::date;
  wk timestamp := date_trunc('week', now() at time zone 'Africa/Cairo');
begin
  perform public.require_admin();
  select team_name into me from public.admins where user_id = (select auth.uid());
  return jsonb_build_object(
    'me', me,
    'open_bugs', (select count(*) from public.team_items where kind = 'bug' and not public.team_closed(status)),
    'open_tasks', (select count(*) from public.team_items where kind = 'task' and not public.team_closed(status)),
    'closed_7d', (select count(*) from public.team_items where closed_at > now() - interval '7 days'),
    'bug_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.team_items where kind = 'bug' group by 1) s), '{}'),
    'task_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.team_items where kind = 'task' group by 1) s), '{}'),
    'bug_severity', coalesce((select jsonb_object_agg(severity, n) from (select severity, count(*) n from public.team_items where kind = 'bug' and not public.team_closed(status) group by 1) s), '{}'),
    'task_owner', coalesce((select jsonb_object_agg(owner, n) from (select owner, count(*) n from public.team_items where kind = 'task' and not public.team_closed(status) group by 1) s), '{}'),
    'open_area', coalesce((select jsonb_object_agg(area, n) from (select area, count(*) n from public.team_items where area is not null and not public.team_closed(status) group by 1) s), '{}'),
    'weekly', (select jsonb_agg(jsonb_build_object(
                 'week', w,
                 'created', (select count(*) from public.team_items where created_at at time zone 'Africa/Cairo' >= w and created_at at time zone 'Africa/Cairo' < w + interval '7 days'),
                 'closed', (select count(*) from public.team_items where closed_at at time zone 'Africa/Cairo' >= w and closed_at at time zone 'Africa/Cairo' < w + interval '7 days')
               ) order by w)
               from generate_series(wk - interval '49 days', wk, interval '7 days') w),
    'waiting_me', coalesce((select jsonb_agg(x) from (
        select num, kind, title, status, due_date from public.team_items
        where me is not null and kind = 'task' and status = 'Waiting for ' || me order by updated_at desc limit 10) x), '[]'),
    'blockers', coalesce((select jsonb_agg(x) from (
        select num, kind, title, status, area from public.team_items
        where kind = 'bug' and severity = 'Blocker' and not public.team_closed(status) order by created_at limit 10) x), '[]'),
    'due_week', coalesce((select jsonb_agg(x) from (
        select num, kind, title, status, owner, due_date from public.team_items
        where kind = 'task' and not public.team_closed(status) and due_date is not null and due_date <= today + 7
        order by due_date limit 15) x), '[]')
  );
end $$;

revoke execute on function
  public.team_list(text, jsonb, integer), public.team_get(integer), public.team_save(jsonb, text),
  public.team_comment(integer, text, text), public.team_file_add(integer, text, text, integer, uuid, text), public.team_overview()
  from public, anon;
grant execute on function
  public.team_list(text, jsonb, integer), public.team_get(integer), public.team_save(jsonb, text),
  public.team_comment(integer, text, text), public.team_file_add(integer, text, text, integer, uuid, text), public.team_overview()
  to authenticated;

-- ─── Screenshots and files: private bucket, folder per item ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-files', 'team-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'application/pdf']);
create policy "admins read team files" on storage.objects for select to authenticated
  using (bucket_id = 'team-files' and public.is_admin());
create policy "admins add team files" on storage.objects for insert to authenticated
  with check (bucket_id = 'team-files' and public.is_admin() and public.admin_role() <> 'viewer');
