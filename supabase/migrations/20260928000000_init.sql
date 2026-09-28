-- Bestim initial schema (spec §5) with security fixes:
-- RLS on service_types, WITH CHECK ownership on child rows, share lookup via RPC,
-- search_path pinned on SECURITY DEFINER functions, updated_at triggers,
-- reminder due/overdue computed client-side (not stored).

create extension if not exists moddatetime schema extensions;

-- ─── Profiles ───────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  language text not null default 'ar' check (language in ('ar', 'en')),
  currency text not null default 'EGP',
  onboarding_completed boolean not null default false,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Vehicles ───────────────────────────────────────────────
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  year integer not null check (year between 1900 and 2100),
  plate_number text,
  color text,
  vin text,
  current_odometer integer not null default 0 check (current_odometer >= 0),
  odometer_unit text not null default 'km' check (odometer_unit in ('km', 'mi')),
  photo_url text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_primary_vehicle_per_user on public.vehicles(user_id) where is_primary;

-- ─── Service types (system catalogue, read-only to clients) ─
create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  icon text not null default 'Wrench',
  category text not null default 'maintenance' check (category in ('maintenance', 'repair', 'inspection')),
  default_interval_km integer,
  default_interval_months integer,
  is_system boolean not null default true
);

-- ─── Maintenance logs ───────────────────────────────────────
create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  service_type_id uuid references public.service_types(id),
  title text not null,
  description text,
  odometer_reading integer check (odometer_reading >= 0),
  cost numeric(10,2) check (cost >= 0),
  currency text not null default 'EGP',
  service_date date not null default current_date,
  location text,
  source text not null default 'manual' check (source in ('manual', 'voice')),
  voice_transcript text,
  status text not null default 'verified' check (status in ('verified', 'needs_review', 'corrected')),
  parts_replaced jsonb not null default '[]',
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Log corrections (append-only audit trail) ──────────────
create table public.log_corrections (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.maintenance_logs(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  reason text,
  corrected_at timestamptz not null default now(),
  corrected_by uuid not null default auth.uid() references public.profiles(id) on delete cascade
);

-- ─── Reminders ──────────────────────────────────────────────
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  service_type_id uuid references public.service_types(id),
  title text not null,
  description text,
  due_date date,
  due_odometer integer,
  repeat_interval_km integer,
  repeat_interval_months integer,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'dismissed')),
  notify_before_days integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is not null or due_odometer is not null)
);

-- ─── Expenses ───────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_id uuid references public.maintenance_logs(id) on delete set null,
  category text not null default 'maintenance' check (category in ('maintenance', 'fuel', 'insurance', 'registration', 'parking', 'other')),
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'EGP',
  description text,
  expense_date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now()
);

-- ─── Vehicle shares ─────────────────────────────────────────
create table public.vehicle_shares (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  shared_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  shared_with_email text,
  share_token text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  includes_expenses boolean not null default false,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ─── Indexes (share_token already indexed by UNIQUE) ────────
create index on public.vehicles(user_id);
create index on public.maintenance_logs(vehicle_id, service_date desc);
create index on public.maintenance_logs(user_id);
create index on public.log_corrections(log_id);
create index on public.reminders(vehicle_id);
create index on public.reminders(user_id, status);
create index on public.expenses(vehicle_id, expense_date desc);
create index on public.expenses(user_id);
create index on public.vehicle_shares(vehicle_id);

-- ─── updated_at triggers ────────────────────────────────────
create trigger set_updated_at before update on public.profiles for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.vehicles for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.maintenance_logs for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.reminders for each row execute function extensions.moddatetime(updated_at);

-- ─── Ownership helper (used in WITH CHECK) ─────────────────
create function public.owns_vehicle(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vehicles where id = v and user_id = (select auth.uid()));
$$;

create function public.owns_log(l uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.maintenance_logs where id = l and user_id = (select auth.uid()));
$$;

-- ─── RLS ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter table public.vehicles enable row level security;
create policy "own vehicles" on public.vehicles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.service_types enable row level security;
create policy "service types readable" on public.service_types for select to anon, authenticated using (true);

alter table public.maintenance_logs enable row level security;
create policy "own logs" on public.maintenance_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id));

alter table public.log_corrections enable row level security;
create policy "own corrections read" on public.log_corrections for select to authenticated using (public.owns_log(log_id));
create policy "own corrections insert" on public.log_corrections for insert to authenticated
  with check ((select auth.uid()) = corrected_by and public.owns_log(log_id));

alter table public.reminders enable row level security;
create policy "own reminders" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id));

alter table public.expenses enable row level security;
create policy "own expenses" on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_vehicle(vehicle_id) and (log_id is null or public.owns_log(log_id)));

alter table public.vehicle_shares enable row level security;
create policy "own shares" on public.vehicle_shares for all to authenticated
  using ((select auth.uid()) = shared_by)
  with check ((select auth.uid()) = shared_by and public.owns_vehicle(vehicle_id));

-- ─── Share lookup: one share by token, never the whole table ─
create function public.get_share(token text)
returns table (vehicle_id uuid, includes_expenses boolean, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select s.vehicle_id, s.includes_expenses, s.expires_at, s.status
  from public.vehicle_shares s
  where s.share_token = token and s.status = 'pending' and s.expires_at > now();
$$;
revoke execute on function public.get_share(text) from public, anon;
grant execute on function public.get_share(text) to authenticated;

-- ─── Auto-create profile on signup ──────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS helpers must stay executable by authenticated (policies run as the caller).
revoke execute on function public.owns_vehicle(uuid), public.owns_log(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─── Seed: service types ────────────────────────────────────
insert into public.service_types (name_ar, name_en, icon, category, default_interval_km, default_interval_months) values
  ('تغيير الزيت', 'Oil Change', 'Droplets', 'maintenance', 5000, 6),
  ('فلتر الهواء', 'Air Filter', 'Wind', 'maintenance', 15000, 12),
  ('فلتر الزيت', 'Oil Filter', 'Filter', 'maintenance', 5000, 6),
  ('فحص الفرامل', 'Brake Inspection', 'CircleAlert', 'inspection', 20000, 12),
  ('تغيير تيل الفرامل', 'Brake Pad Replacement', 'Disc', 'maintenance', 40000, null),
  ('تبديل الإطارات', 'Tire Rotation', 'RefreshCcw', 'maintenance', 10000, 6),
  ('تغيير الإطارات', 'Tire Replacement', 'Circle', 'maintenance', 50000, null),
  ('فحص البطارية', 'Battery Check', 'BatteryFull', 'inspection', null, 6),
  ('تغيير البطارية', 'Battery Replacement', 'BatteryCharging', 'maintenance', null, 36),
  ('فحص سائل التبريد', 'Coolant Check', 'Thermometer', 'inspection', 30000, 12),
  ('تغيير شمعات الاحتراق', 'Spark Plug Replacement', 'Zap', 'maintenance', 30000, null),
  ('فحص ناقل الحركة', 'Transmission Check', 'Settings', 'inspection', 60000, 24),
  ('غسيل السيارة', 'Car Wash', 'Sparkles', 'maintenance', null, 1),
  ('فحص دوري شامل', 'Full Inspection', 'ClipboardCheck', 'inspection', 20000, 12),
  ('تغيير مساحات الزجاج', 'Wiper Replacement', 'CloudRain', 'maintenance', null, 12),
  ('فحص التكييف', 'AC Service', 'Snowflake', 'inspection', null, 12),
  ('تغيير سير التوقيت', 'Timing Belt', 'Timer', 'maintenance', 100000, null),
  ('إصلاح عام', 'General Repair', 'Wrench', 'repair', null, null);
