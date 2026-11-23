import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { supabase } from './supabase';
import { useSession } from './session';

// v2 Services data (flow 12): reference tables are read once and kept; tracked health and visits are per car.

export const useSystems = () =>
  useQuery({ queryKey: ['v2-systems'], staleTime: Infinity, queryFn: async () => (await supabase.from('systems').select('*').order('sort')).data ?? [] });

export const useSpecialists = () =>
  useQuery({ queryKey: ['v2-specialists'], staleTime: Infinity, queryFn: async () => (await supabase.from('specialists').select('*').order('sort')).data ?? [] });

export const useJobTypes = () =>
  useQuery({ queryKey: ['v2-job-types'], staleTime: Infinity, queryFn: async () => (await supabase.from('job_types').select('id,name_en,name_ar,specialist_key,system_id,tracked').order('sort')).data ?? [] });

/** Tracked items of a car with server-side health (`tracked_health`, spec 2.8: the one formula, so Services and the car ring agree). */
export function useTracked(vehicleId: string | undefined) {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['tracked', userId, vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tracked_health', { p_vehicle_id: vehicleId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Names for tracked items that point at a catalog part instead of a job type (rare). */
export function useCatalogNames(ids: string[]) {
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['v2-catalog-names', key],
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: async () => (await supabase.from('catalog_items').select('id,name_en,name_ar').in('id', ids)).data ?? [],
  });
}

/** Live visits of a car (RLS hides soft-deleted ones), newest first, each with its jobs and line items. */
export function useVisits(vehicleId: string | undefined) {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['visits', userId, vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, jobs(*, line_items(*))')
        .eq('vehicle_id', vehicleId!)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type Visit = NonNullable<ReturnType<typeof useVisits>['data']>[number];

/** Money split of a visit: labor, parts, consumables, everything else (the same split the visit's expense stores). */
export function visitTotals(v: Visit) {
  const out = { labor: 0, parts: 0, consumables: 0, other: 0, total: 0 };
  for (const j of v.jobs) for (const li of j.line_items) {
    const k = li.type === 'labor' ? 'labor' : li.type === 'part' ? 'parts' : li.type === 'consumable' ? 'consumables' : 'other';
    out[k] += Number(li.total);
    out.total += Number(li.total);
  }
  return out;
}

export const bilingual = (x: { name_en: string; name_ar: string }, arabic: boolean) => (arabic ? x.name_ar : x.name_en);

/**
 * "Search a part" is a picker: the caller says what to do with the chosen job or part. Services uses it to filter visits;
 * the manual add flow (flow 14) reuses it to start a record.
 */
export type CatalogPick = { kind: 'job' | 'item'; id: string; name_en: string; name_ar: string };
/** `pops` = screens to close before onPick runs: 2 from Services (browse + search), 1 when browse was opened directly. */
export const usePartSearch = create<{ vehicleId?: string; pops: number; onPick: (p: CatalogPick) => void }>(() => ({ pops: 2, onPick: () => {} }));
