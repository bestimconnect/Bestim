import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { AppState, Platform } from 'react-native';

import i18n from '@/lib/i18n';
import { partArt, type ArtState } from '@/lib/partArt';
import { queryClient } from '@/lib/queryClient';
import { vehicleName, type Expense, type Log, type Vehicle } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { vehicleArt } from '@/lib/vehicleArt';
import { buildSnapshot, emptySnapshot, type CarInput, type WidgetApi, type WidgetLang, type WidgetSnapshot } from '@/lib/widgetSnapshot';
import { useSettings } from '@/stores/settingsStore';

// Keeps the home-screen widgets in step with the app: rebuilds the snapshot from the query cache whenever data,
// the chosen car, the language or the app's foreground state changes, downloads the pictures it needs into a
// folder the widgets can read, and hands the result to the platform (iOS: expo-widgets; Android: a file the
// widget task reads). Widgets hold no login; their buttons use a limited widget key (see widgetApi below).
// Started once from register.ts.

export const SNAPSHOT_FILE = 'snapshot.json';
export const IOS_WIDGETS = ['BestimNext', 'BestimKm', 'BestimDashboard', 'BestimQuick', 'BestimSpend', 'BestimLock'] as const;
const CATALOG = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/`;
const KEY_STORE = 'widgetKey.v1';

/** The folder the widgets read: the iOS app group directory, or the app's own files on Android. */
export function widgetDir(): Directory | null {
  if (Platform.OS === 'ios') {
    const { widgetsDirectory } = require('expo-widgets') as { widgetsDirectory: string | null };
    return widgetsDirectory ? new Directory(widgetsDirectory) : null;
  }
  return new Directory(Paths.document, 'widget');
}

/** A bundled picture copied into the widget folder once; returns its file:// path. */
async function copyBundled(dir: Directory, name: string, source: number): Promise<string | null> {
  const to = new File(dir, name);
  if (to.exists) return to.uri;
  try {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    new File(asset.localUri).copy(to);
    return to.uri;
  } catch {
    return null;
  }
}

/** A catalog picture (public bucket) downloaded once; null when it is not there, so the bundled one is used. */
async function fetchCatalog(dir: Directory, path: string): Promise<string | null> {
  const to = new File(dir, `catalog-${path.replace(/[^\w.-]/g, '_')}`);
  if (to.exists) return to.uri;
  try {
    await File.downloadFileAsync(CATALOG + path, to);
    return to.uri;
  } catch {
    return null;
  }
}

export async function withPictures(snap: WidgetSnapshot, dir: Directory): Promise<WidgetSnapshot> {
  const cars = await Promise.all(
    snap.cars.map(async (car) => ({
      ...car,
      img: await copyBundled(dir, `car-${car.type}.png`, vehicleArt(car.type)),
      parts: await Promise.all(
        car.parts.map(async (p) => {
          const state: ArtState = p.state === 'overdue' ? 'late' : p.state;
          const img = (p.remote && (await fetchCatalog(dir, p.remote))) || (await copyBundled(dir, `part-${p.art.replace(/\W/g, '')}-${state}.webp`, partArt(p.art, state)));
          return { ...p, img };
        }),
      ),
    })),
  );
  return { ...snap, cars };
}

// The widget key: a random secret that lets a widget raise the km, mark a service done or snooze it, and nothing else.
// Made by the server for the signed-in owner (rpc create_widget_key), kept next to the snapshot, wiped on sign-out.
type StoredKey = { userId: string; key: string };

async function widgetApi(): Promise<WidgetApi | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return null;
  let stored: StoredKey | null = null;
  try {
    stored = JSON.parse((await AsyncStorage.getItem(KEY_STORE)) ?? 'null');
  } catch {}
  if (stored?.userId !== user.id) {
    const { data: key, error } = await supabase.rpc('create_widget_key' as never, { p_platform: Platform.OS === 'ios' ? 'ios' : 'android' } as never);
    if (error || typeof key !== 'string') return null; // migration not applied yet, or offline: widgets still show data, their buttons open the app
    stored = { userId: user.id, key };
    await AsyncStorage.setItem(KEY_STORE, JSON.stringify(stored));
  }
  return { url: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/widget_action`, anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, key: stored!.key };
}

// Reading the cache, and fetching what the app has not opened yet (the other cars' logs).
const fetchLogs = (id: string) =>
  queryClient.fetchQuery({
    queryKey: ['logs', id],
    staleTime: 60_000,
    queryFn: async (): Promise<Log[]> => {
      const { data, error } = await supabase.from('maintenance_logs').select('*, service_types(*)').eq('vehicle_id', id).order('service_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
const fetchSnoozes = (id: string) =>
  queryClient.fetchQuery({
    queryKey: ['snoozes', id],
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase.from('reminders').select('service_type_id, due_date').eq('vehicle_id', id).eq('status', 'dismissed').gt('due_date', today);
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.service_type_id, r.due_date])) as Record<string, string | null>;
    },
  });

async function fromCache(lang: WidgetLang, api: WidgetApi | null): Promise<WidgetSnapshot | null> {
  const vehicles = queryClient.getQueryData<Vehicle[]>(['vehicles']);
  if (!vehicles) return null;
  const expenses = queryClient.getQueryData<Expense[]>(['expenses', 'all']) ?? [];
  const cars: CarInput[] = await Promise.all(
    vehicles.map(async (vehicle) => ({
      vehicle,
      name: vehicleName(vehicle),
      logs: await fetchLogs(vehicle.id).catch(() => queryClient.getQueryData<Log[]>(['logs', vehicle.id]) ?? []),
      snoozes: await fetchSnoozes(vehicle.id).catch(() => queryClient.getQueryData<Record<string, string | null>>(['snoozes', vehicle.id]) ?? {}),
      expenses,
    })),
  );
  const current = useSettings.getState().currentVehicleId;
  return buildSnapshot(cars, lang, api, Math.max(0, vehicles.findIndex((v) => v.id === current)));
}

let lastSent = '';
let running = false;
let again = false;

/** Rebuild and push now. Serialised: a change that arrives mid-run triggers one more run after it. */
export async function syncWidgets(force = false) {
  if (running) return void (again = true);
  running = true;
  try {
    const lang: WidgetLang = i18n.language === 'en' ? 'en' : 'ar';
    const dir = widgetDir();
    const base = await fromCache(lang, await widgetApi());
    if (!base || !dir) return;
    dir.create({ idempotent: true, intermediates: true });
    const snap = await withPictures(base, dir);
    const key = JSON.stringify({ ...snap, updated: 0 });
    if (!force && key === lastSent) return;
    lastSent = key;
    if (Platform.OS === 'ios') await pushIos(snap);
    else await pushAndroid(snap, dir);
  } catch (e) {
    console.warn('widget sync failed', e);
  } finally {
    running = false;
    if (again) {
      again = false;
      syncWidgets();
    }
  }
}

/** Each iOS widget remembers the car its owner flipped to; the new snapshot keeps that choice. */
export async function pushIos(full: WidgetSnapshot) {
  const widgets = require('./ios') as typeof import('./ios');
  // iOS stores the props as a property list, which cannot hold null: one null anywhere makes the native call throw.
  const snap = JSON.parse(JSON.stringify(full, (_k, v) => (v === null ? undefined : v))) as WidgetSnapshot;
  for (const name of IOS_WIDGETS) {
    const prev = (await widgets[name].getTimeline().catch(() => []))[0]?.props as { sel?: number } | undefined;
    const sel = typeof prev?.sel === 'number' && prev.sel < snap.cars.length ? prev.sel : snap.sel;
    widgets[name].updateSnapshot({ ...snap, sel, kind: name });
  }
}

async function pushAndroid(snap: WidgetSnapshot, dir: Directory) {
  const file = new File(dir, SNAPSHOT_FILE);
  let sel = snap.sel;
  try {
    const prev = await file.json();
    if (typeof prev?.sel === 'number' && prev.sel < snap.cars.length) sel = prev.sel;
  } catch {}
  file.create({ overwrite: true });
  file.write(JSON.stringify({ ...snap, sel }));
  const { refreshAndroidWidgets } = require('./android') as typeof import('./android');
  await refreshAndroidWidgets();
}

let timer: ReturnType<typeof setTimeout> | undefined;
const soon = () => {
  clearTimeout(timer);
  timer = setTimeout(() => syncWidgets(), 1500);
};

/** Subscribe to everything that changes what a widget shows. Call once at startup. */
export function startWidgetSync() {
  if (Platform.OS === 'web') return;
  queryClient.getQueryCache().subscribe(soon);
  useSettings.subscribe(soon);
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') return;
    // A widget may have changed the data while the app was closed: refetch first, then push.
    for (const key of ['vehicles', 'logs', 'snoozes']) queryClient.invalidateQueries({ queryKey: [key] });
    syncWidgets();
  });
  // Signed out: nothing of the owner's may stay on the home screen, and the widget key goes with it.
  supabase.auth.onAuthStateChange((e) => {
    if (e !== 'SIGNED_OUT') return;
    lastSent = '';
    AsyncStorage.removeItem(KEY_STORE).catch(() => {});
    const dir = widgetDir();
    if (!dir) return;
    dir.create({ idempotent: true, intermediates: true });
    const snap = emptySnapshot(i18n.language === 'en' ? 'en' : 'ar');
    if (Platform.OS === 'ios') pushIos(snap);
    else pushAndroid(snap, dir);
  });
}
