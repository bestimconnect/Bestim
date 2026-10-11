import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSettings } from '@/stores/settingsStore';
import type { Tables } from '@/types/database';

import i18n from './i18n';
import { latestPerType, partStatus, type PartStatus, type Unit } from './parts';
import { useSession } from './session';
import { supabase } from './supabase';

// Shared query hooks (several screens read the same data). Keys: ['vehicles'], ['logs', vehicleId],
// ['log', id], ['service_types'], ['record_categories'], ['snoozes', vehicleId], ['expenses', since]. After a write, invalidate
// ['vehicles'], ['logs'] and ['expenses'] (a log's cost becomes an expense via a DB trigger).

type Names = { name_en: string; name_ar: string };
/** The linked catalog model and brand names; null for a car typed by hand. */
export type CatalogJoin = (Names & { car_makes: Names | null }) | null;
export type Vehicle = Tables<'vehicles'> & { car_models: CatalogJoin };
export type ServiceType = Tables<'service_types'>;
export type RecordCategory = Tables<'record_categories'>;
/** A service with its subcategory and category; both null for a retired service (old logs still resolve it, pickers skip it). */
export type Service = ServiceType & { subcategory: RecordCategory | null; parentCategory: RecordCategory | null }; // (`category` is an old text column of service_types)
export type Log = Tables<'maintenance_logs'> & { service_types: ServiceType | null };
export type Part = { serviceType: ServiceType; log: Log; status: PartStatus; snoozedUntil: string | null };
export type Expense = Tables<'expenses'> & { vehicles: Pick<Vehicle, 'id' | 'make' | 'model' | 'nickname' | 'car_models'> | null };

/** Select list that joins a vehicle's catalog model and brand names. */
export const CATALOG_JOIN = 'car_models(name_en, name_ar, car_makes(name_en, name_ar))';

/** What the owner sees as the car's name: nickname, else catalog brand + model in the app language, else the typed text. */
export function vehicleName(v: Pick<Vehicle, 'nickname' | 'make' | 'model' | 'car_models'>) {
  if (v.nickname) return v.nickname;
  const m = v.car_models;
  if (!m?.car_makes) return `${v.make} ${v.model}`;
  const k = i18n.language === 'ar' ? 'name_ar' : 'name_en';
  return `${m.car_makes[k]} ${m[k]}`;
}

/** Anonymous Supabase user = guest (decisions Q17). */
export function useIsGuest() {
  return !!useSession()?.user.is_anonymous;
}

/** The signed-in user's profile row. Key ['profile', userId]. */
export function useProfile() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`*, ${CATALOG_JOIN}`)
        .order('is_primary', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** The vehicle Home shows and new logs go to: the user's pick, else the primary (first) one. */
export function useCurrentVehicle() {
  const vehicles = useVehicles();
  const id = useSettings((s) => s.currentVehicleId);
  const vehicle = vehicles.data?.find((v) => v.id === id) ?? vehicles.data?.[0] ?? null;
  return { ...vehicles, vehicle };
}

export function useVehicle(id: string | undefined) {
  const vehicles = useVehicles();
  return { ...vehicles, vehicle: vehicles.data?.find((v) => v.id === id) ?? null };
}

export type CarMake = Names & { id: string; sort: number; car_models: (Names & { id: string; body_type: string })[] };

/** Every brand with its models, for the car pickers. Plain JSON because the query cache is persisted. */
export function useCarCatalog() {
  return useQuery({
    queryKey: ['car_catalog'],
    staleTime: 7 * 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<CarMake[]> => {
      const { data, error } = await supabase
        .from('car_makes')
        .select('id, name_en, name_ar, sort, car_models(id, name_en, name_ar, body_type)')
        .order('sort')
        .order('name_en')
        .order('name_en', { referencedTable: 'car_models' });
      if (error) throw error;
      return data;
    },
  });
}

/** The whole record tree (categories, their subcategories) in one query, ordered by `sort`. Plain JSON because the cache is persisted. */
export function useRecordCategories() {
  return useQuery({
    queryKey: ['record_categories'],
    staleTime: 7 * 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<RecordCategory[]> => {
      const { data, error } = await supabase.from('record_categories').select('*').order('sort');
      if (error) throw error;
      return data;
    },
  });
}

/** Every service (retired ones too, with `category_id` null), ordered category → subcategory → service. */
export function useServiceTypes() {
  const types = useQuery({
    queryKey: ['service_types'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('service_types').select('*').order('sort');
      if (error) throw error;
      return data;
    },
  });
  const tree = useRecordCategories().data;
  const data = useMemo((): Service[] | undefined => {
    if (!types.data) return undefined;
    const byId = new Map((tree ?? []).map((c) => [c.id, c]));
    const rank = (c: RecordCategory | null) => c?.sort ?? 1e9;
    return types.data
      .map((s) => {
        const subcategory = byId.get(s.category_id ?? '') ?? null;
        return { ...s, subcategory, parentCategory: byId.get(subcategory?.parent_id ?? '') ?? null };
      })
      .sort((a, b) => rank(a.parentCategory) - rank(b.parentCategory) || rank(a.subcategory) - rank(b.subcategory) || a.sort - b.sort);
  }, [types.data, tree]);
  return { ...types, data };
}

/** All logs of a vehicle, newest first, with their service type. */
export function useVehicleLogs(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['logs', vehicleId],
    enabled: !!vehicleId,
    queryFn: async (): Promise<Log[]> => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*, service_types(*)')
        .eq('vehicle_id', vehicleId!)
        .order('service_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useLog(id: string | undefined) {
  return useQuery({
    queryKey: ['log', id],
    enabled: !!id,
    queryFn: async (): Promise<Log> => {
      const { data, error } = await supabase.from('maintenance_logs').select('*, service_types(*)').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

/** Active snoozes (screen 22 "snooze a week", Q24): reminders rows with status 'dismissed', hidden until due_date. */
export function useSnoozes(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['snoozes', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from('reminders')
        .select('service_type_id, due_date')
        .eq('vehicle_id', vehicleId!)
        .eq('status', 'dismissed')
        .gt('due_date', today);
      if (error) throw error;
      // A plain object, not a Map: query data is persisted as JSON for offline use (src/lib/queryClient.ts).
      return Object.fromEntries(data.map((r) => [r.service_type_id, r.due_date])) as Record<string, string | null>;
    },
  });
}

/** Odometer readings of a car (a trigger writes one whenever the reading changes), newest first. Under 'vehicles' so a reading change refreshes it. */
export function useOdometerReadings(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['vehicles', 'readings', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('odometer_readings').select('*').eq('vehicle_id', vehicleId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Tracked parts of a vehicle, most urgent first (decisions Q10). */
export function useVehicleParts(vehicle: Vehicle | null | undefined) {
  const logs = useVehicleLogs(vehicle?.id);
  const snoozes = useSnoozes(vehicle?.id);
  const parts: Part[] = [];
  if (vehicle && logs.data)
    for (const log of latestPerType(logs.data)) {
      const st = log.service_types;
      if (!st?.has_reminder) continue;
      const status = partStatus({
        odometer: vehicle.current_odometer,
        unit: vehicle.odometer_unit as Unit,
        lastReading: log.odometer_reading,
        lastDate: log.service_date,
        intervalKm: log.interval_km ?? st.default_interval_km,
        intervalMonths: log.interval_months ?? st.default_interval_months,
      });
      if (status) parts.push({ serviceType: st, log, status, snoozedUntil: snoozes.data?.[st.id] ?? null });
    }
  parts.sort((a, b) => a.status.urgency - b.status.urgency);
  return { ...logs, parts };
}

/** Soon/overdue parts that aren't snoozed: Home "today's priority", 09 overview, 21 "needs attention". */
export const needsAttention = (parts: Part[]) => parts.filter((p) => p.status.state !== 'ok' && !p.snoozedUntil);

/** Every fuel fill-up of one car, no date window, so consumption (src/lib/fuel.ts) uses the whole history. */
export function useFuelFills(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'fuel', vehicleId], // under ['expenses'], so every expense write refreshes it
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, liters, odometer_reading, full_tank')
        .eq('vehicle_id', vehicleId!)
        .eq('category', 'fuel')
        .not('liters', 'is', null)
        .not('odometer_reading', 'is', null);
      if (error) throw error;
      return data;
    },
  });
}

/** Start of the expense window every money screen shares: Jan 1st, or 6 months back if earlier (bars on 06/23). */
export function expensesSince(today = new Date()) {
  const sixBack = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const jan1 = new Date(today.getFullYear(), 0, 1);
  return (sixBack < jan1 ? sixBack : jan1).toLocaleDateString('en-CA'); // YYYY-MM-DD, local
}

/** Expenses of all the user's vehicles since `expensesSince()`, newest first. Filter by vehicle_id / year client-side. */
export function useExpenses() {
  const since = expensesSince();
  return useQuery({
    queryKey: ['expenses', since],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`*, vehicles(id, make, model, nickname, ${CATALOG_JOIN})`)
        .gte('expense_date', since)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
