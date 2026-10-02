-- Demo requests from the Bestim Connect website (bestim-connect.com).
-- The form is public (no login), so this table is the gate: visitors may only
-- add a row, never read, change or delete one. Lengths and allowed values are
-- enforced here because anything the browser checks can be skipped.
create table public.connect_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 80),
  company text not null check (char_length(company) between 2 and 120),
  phone text not null check (phone ~ '^[0-9+ ()-]{7,20}$'),
  fleet_size text not null check (fleet_size in ('1-10', '11-50', '51-200', '200+')),
  kind text not null check (kind in ('fleet', 'workshop')),
  note text check (char_length(note) <= 500),
  lang text not null check (lang in ('ar', 'en'))
);

alter table public.connect_leads enable row level security;

-- Only the form's own columns: a visitor can't set the id or the timestamp.
grant insert (name, company, phone, fleet_size, kind, note, lang) on public.connect_leads to anon;

create policy "Visitors can send a demo request"
  on public.connect_leads for insert to anon
  with check (true);

-- No select / update / delete grant or policy: requests are read in the
-- Supabase dashboard (or later by a dashboard role added in its own migration).
