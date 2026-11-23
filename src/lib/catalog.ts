import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { CatalogJob, CatalogPart } from './catalogSearch';
import { supabase } from './supabase';

// The catalog on the phone (flow 14): job types and parts are kept in AsyncStorage with the server's catalog_version
// (20261123090000_catalog_version.sql), so search is instant and works offline. It refetches only when the version changes
// (or, if the version cannot be read, once a week). Public data, so it is not wiped on sign-out.
const KEY = 'catalogCache.v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;
type Cache = { version: number | null; at: number; jobs: CatalogJob[]; parts: CatalogPart[] };

async function fetchAll<T>(table: 'job_types' | 'catalog_items', cols: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as T[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

const readVersion = async () => {
  const { data, error } = await supabase.from('catalog_meta').select('version').maybeSingle(); // table missing = migration not applied yet
  return error ? null : (data?.version ?? null);
};

export const useCatalog = create<{ jobs: CatalogJob[]; parts: CatalogPart[]; ready: boolean; started: boolean; load: () => Promise<void> }>((set, get) => ({
  jobs: [],
  parts: [],
  ready: false,
  started: false,
  load: async () => {
    if (get().started) return;
    set({ started: true });
    let cache: Cache | null = null;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as Cache) : null;
    } catch {
      cache = null;
    }
    if (cache) set({ jobs: cache.jobs, parts: cache.parts, ready: true });
    try {
      const version = await readVersion();
      const fresh = cache && (version != null ? cache.version === version : Date.now() - cache.at < WEEK);
      if (fresh) return;
      const [jobs, parts] = await Promise.all([
        fetchAll<CatalogJob>('job_types', 'id,name_en,name_ar,aliases,specialist_key,system_id,suggested_items,tracked,fuel_types', 'sort'),
        fetchAll<CatalogPart>('catalog_items', 'id,name_en,name_ar,aliases,system_id,item_type,fuel_types', 'name_en'),
      ]);
      set({ jobs, parts, ready: true });
      await AsyncStorage.setItem(KEY, JSON.stringify({ version, at: Date.now(), jobs, parts } satisfies Cache));
    } catch {
      set({ started: false, ready: get().ready }); // offline or failed: use what we have, try again next time
    }
  },
}));
