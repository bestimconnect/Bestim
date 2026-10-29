-- Dashboard phase 2: cars, parts and car types are managed from /dashboard/{cars,parts,types}, with pictures.
-- Who may change them: owner, admin and content editors (public.admins). Everyone else keeps read-only access exactly as before.
-- Pictures live in the public Storage bucket "catalog"; the tables keep only the file path inside it
-- (read it at <supabase url>/storage/v1/object/public/catalog/<path>). The app keeps its built-in pictures as the fallback.

create function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = any (roles));
$$;

create function public.can_edit_catalog() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(array['owner', 'admin', 'content']);
$$;

revoke execute on function public.has_role(text[]), public.can_edit_catalog() from public, anon;
grant execute on function public.has_role(text[]), public.can_edit_catalog() to authenticated;

-- ─── Columns ────────────────────────────────────────────────
-- is_active = shown in the app. Hiding never deletes: old records and cars keep pointing at the row.
-- The app only starts honouring it (and the pictures) after its next release.
alter table public.car_makes
  add column is_active boolean not null default true,
  add column logo_path text;
alter table public.car_models
  add column is_active boolean not null default true,
  add column image_path text;
alter table public.service_types
  add column is_active boolean not null default true,
  add column image_ok text,    -- the part as drawn (lime)
  add column image_soon text,  -- amber: due soon
  add column image_late text;  -- red: overdue

-- ─── Car types ──────────────────────────────────────────────
-- The eight body types. vehicles.vehicle_type and car_models.body_type are still checked against the same eight
-- values, so types can be renamed, re-pictured, hidden and re-ordered here, but not added or removed (the app has
-- them built in). Hence: update only.
create table public.vehicle_types (
  id text primary key check (id in ('sedan', 'hatchback', 'suv', 'coupe', 'sports', 'convertible', 'pickup', 'van')),
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  name_en text not null check (char_length(name_en) between 1 and 60),
  sort integer not null default 0,
  is_active boolean not null default true,
  image_path text
);
insert into public.vehicle_types (id, name_ar, name_en, sort) values
  ('sedan', 'سيدان', 'Sedan', 1),
  ('hatchback', 'هاتشباك', 'Hatchback', 2),
  ('suv', 'SUV', 'SUV', 3),
  ('coupe', 'كوبيه', 'Coupe', 4),
  ('sports', 'رياضية', 'Sports car', 5),
  ('convertible', 'مكشوفة', 'Convertible', 6),
  ('pickup', 'بيك أب', 'Pickup', 7),
  ('van', 'فان', 'Van', 8);

alter table public.vehicle_types enable row level security;
grant select on public.vehicle_types to anon, authenticated;
grant update on public.vehicle_types to authenticated;
create policy "vehicle types readable" on public.vehicle_types for select to anon, authenticated using (true);
create policy "catalog editors update vehicle types" on public.vehicle_types for update to authenticated
  using (public.can_edit_catalog()) with check (public.can_edit_catalog());

-- ─── Write access for catalog editors ───────────────────────
-- The tables were read-only for everyone; these policies add writes for editors only (RLS still decides who).
grant insert, update, delete on public.car_makes, public.car_models, public.service_types to authenticated;

create policy "catalog editors insert makes" on public.car_makes for insert to authenticated with check (public.can_edit_catalog());
create policy "catalog editors update makes" on public.car_makes for update to authenticated
  using (public.can_edit_catalog()) with check (public.can_edit_catalog());
create policy "catalog editors delete makes" on public.car_makes for delete to authenticated using (public.can_edit_catalog());

create policy "catalog editors insert models" on public.car_models for insert to authenticated with check (public.can_edit_catalog());
create policy "catalog editors update models" on public.car_models for update to authenticated
  using (public.can_edit_catalog()) with check (public.can_edit_catalog());
create policy "catalog editors delete models" on public.car_models for delete to authenticated using (public.can_edit_catalog());

create policy "catalog editors insert services" on public.service_types for insert to authenticated with check (public.can_edit_catalog());
create policy "catalog editors update services" on public.service_types for update to authenticated
  using (public.can_edit_catalog()) with check (public.can_edit_catalog());
create policy "catalog editors delete services" on public.service_types for delete to authenticated using (public.can_edit_catalog());

-- ─── Pictures: the "catalog" bucket ─────────────────────────
-- Public to read (they are app artwork, not user data), editors only to write. PNG / WebP / JPEG, 2 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 2097152, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "catalog pictures readable" on storage.objects for select to anon, authenticated using (bucket_id = 'catalog');
create policy "catalog editors add pictures" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and public.can_edit_catalog());
create policy "catalog editors replace pictures" on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and public.can_edit_catalog()) with check (bucket_id = 'catalog' and public.can_edit_catalog());
create policy "catalog editors remove pictures" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog' and public.can_edit_catalog());

-- ─── Audit: every dashboard change to these tables ──────────
-- Only changes made by a signed-in person are logged (auth.uid() is empty for the CSV seed scripts).
create function public.log_catalog_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
begin
  if auth.uid() is not null then
    insert into public.admin_audit_log (admin_id, action, target, detail)
    values (
      auth.uid(),
      'catalog_' || lower(tg_op),
      tg_table_name || ':' || coalesce(new_row ->> 'id', old_row ->> 'id'),
      jsonb_build_object(
        'admin_email', (select email from auth.users where id = auth.uid()),
        'name', coalesce(new_row ->> 'name_en', old_row ->> 'name_en'),
        'before', old_row,
        'after', new_row
      )
    );
  end if;
  return null;
end $$;

create trigger log_catalog_makes after insert or update or delete on public.car_makes for each row execute function public.log_catalog_change();
create trigger log_catalog_models after insert or update or delete on public.car_models for each row execute function public.log_catalog_change();
create trigger log_catalog_services after insert or update or delete on public.service_types for each row execute function public.log_catalog_change();
create trigger log_catalog_types after insert or update or delete on public.vehicle_types for each row execute function public.log_catalog_change();

-- ─── How much each car type is used (for the Car types page) ─
create function public.admin_type_usage() returns table (type text, models bigint, vehicles bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query
  select t.id,
         (select count(*) from public.car_models m where m.body_type = t.id),
         (select count(*) from public.vehicles v where v.vehicle_type = t.id)
  from public.vehicle_types t
  order by t.sort;
end $$;
revoke execute on function public.admin_type_usage() from public, anon;
grant execute on function public.admin_type_usage() to authenticated;
