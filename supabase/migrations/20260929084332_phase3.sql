-- Phase 3: per-log service interval, odometer bookkeeping, corrections RPC, receipt photos.

-- ─── Per-log interval (screen 17 answer; falls back to service_types defaults) ─
alter table public.maintenance_logs
  add column interval_km integer check (interval_km > 0),
  add column interval_months integer check (interval_months > 0);

-- ─── Odometer: flag suspicious readings (screen 20), keep vehicle odometer current ─
-- Flag on insert when the reading is below an earlier log's reading, or climbs faster than
-- a vehicle can plausibly run (1000 km|mi/day, 24 h/day) since the latest earlier log.
create function public.log_odometer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prev_reading integer;
  prev_date date;
  max_before integer;
  unit text;
begin
  if new.odometer_reading is null then return new; end if;

  select odometer_unit into unit from public.vehicles where id = new.vehicle_id;

  if tg_op = 'INSERT' then
    select l.odometer_reading, l.service_date into prev_reading, prev_date
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.odometer_reading is not null and l.service_date <= new.service_date
    order by l.service_date desc, l.created_at desc limit 1;

    select max(l.odometer_reading) into max_before
    from public.maintenance_logs l
    where l.vehicle_id = new.vehicle_id and l.service_date <= new.service_date;

    if new.odometer_reading < max_before
       or (prev_reading is not null and (new.odometer_reading - prev_reading)::numeric
           / greatest(new.service_date - prev_date, 1) > case when unit = 'h' then 24 else 1000 end)
    then
      new.status := 'needs_review';
    end if;
  end if;

  update public.vehicles set current_odometer = new.odometer_reading
  where id = new.vehicle_id and current_odometer < new.odometer_reading;
  return new;
end;
$$;
revoke execute on function public.log_odometer() from public, anon, authenticated;

create trigger log_odometer before insert or update of odometer_reading on public.maintenance_logs
  for each row execute function public.log_odometer();

-- ─── Corrections: change a log and record every changed field, atomically ─
-- The original values survive in log_corrections (append-only). Runs as the caller, so RLS applies.
create function public.correct_log(log_id uuid, changes jsonb, reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  old_row jsonb;
begin
  select to_jsonb(l) into old_row from public.maintenance_logs l where l.id = log_id;
  if old_row is null then raise exception 'log not found'; end if;
  if coalesce(trim(reason), '') = '' then raise exception 'reason required'; end if;

  insert into public.log_corrections (log_id, field_name, old_value, new_value, reason)
  select log_id, c.key, old_row->>c.key, c.value, reason
  from jsonb_each_text(changes) c
  where c.key in ('title', 'service_type_id', 'odometer_reading', 'cost', 'service_date', 'location', 'description')
    and c.value is distinct from old_row->>c.key;

  if not found then return; end if;

  update public.maintenance_logs l set
    title = coalesce(changes->>'title', l.title),
    service_type_id = coalesce((changes->>'service_type_id')::uuid, l.service_type_id),
    odometer_reading = coalesce((changes->>'odometer_reading')::integer, l.odometer_reading),
    cost = coalesce((changes->>'cost')::numeric, l.cost),
    service_date = coalesce((changes->>'service_date')::date, l.service_date),
    location = coalesce(changes->>'location', l.location),
    description = coalesce(changes->>'description', l.description),
    status = 'corrected'
  where l.id = log_id;
end;
$$;
revoke execute on function public.correct_log(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_log(uuid, jsonb, text) to authenticated;

-- ─── Receipt photos (screen 16): private bucket, objects under "<uid>/…" ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/heic']);

create policy "own receipts read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own receipts insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own receipts delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
