import { useQuery } from '@tanstack/react-query';

import { useSettings } from '@/stores/settingsStore';
import type { Tables } from '@/types/database';

import { latestPerType, partStatus, type PartStatus, type Unit } from './parts';
import { useSession } from './session';
import { supabase } from './supabase';

// Shared query hooks (several screens read the same data). Keys: ['vehicles'], ['logs', vehicleId],
// ['log', id], ['service_types'], ['snoozes', vehicleId], ['expenses', since]. After a write, invalidate
// ['vehicles'], ['logs'] and ['expenses'] (a log's cost becomes an expense via a DB trigger).

export type Vehicle = Tables<'vehicles'>;
export type ServiceType = Tables<'service_types'>;
export type Log = Tables<'maintenance_logs'> & { service_types: ServiceType | null };
export type Part = { serviceType: ServiceType; log: Log; status: PartStatus; snoozedUntil: string | null };
export type Expense = Tables<'expenses'> & { vehicles: Pick<Vehicle, 'id' | 'make' | 'model' | 'nickname'> | null };

/** Anonymous Supabase user = guest (decisions Q17). */
export function useIsGuest() {
  return !!useSession()?.user.is_anonymous;
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
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

export function useServiceTypes() {
  return useQuery({
    queryKey: ['service_types'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('service_types').select('*').order('category');
      if (error) throw error;
      return data;
    },
  });
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
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('reminders')
        .select('service_type_id, due_date')
        .eq('vehicle_id', vehicleId!)
        .eq('status', 'dismissed')
        .gt('due_date', today);
      if (error) throw error;
      return new Map(data.map((r) => [r.service_type_id, r.due_date]));
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
      if (!st) continue;
      const status = partStatus({
        odometer: vehicle.current_odometer,
        unit: vehicle.odometer_unit as Unit,
        lastReading: log.odometer_reading,
        lastDate: log.service_date,
        intervalKm: log.interval_km ?? st.default_interval_km,
        intervalMonths: log.interval_months ?? st.default_interval_months,
      });
      if (status) parts.push({ serviceType: st, log, status, snoozedUntil: snoozes.data?.get(st.id) ?? null });
    }
  parts.sort((a, b) => a.status.urgency - b.status.urgency);
  return { ...logs, parts };
}

/** Soon/overdue parts that aren't snoozed: Home "today's priority", 09 overview, 21 "needs attention". */
export const needsAttention = (parts: Part[]) => parts.filter((p) => p.status.state !== 'ok' && !p.snoozedUntil);

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
        .select('*, vehicles(id, make, model, nickname)')
        .gte('expense_date', since)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
