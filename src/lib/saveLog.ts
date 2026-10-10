import { supabase } from './supabase';

// Saving a maintenance log lives here (not in the review screen) so it can be a TanStack mutation default:
// a log written offline is paused, persisted, and sent when the connection returns — even after an app restart.

/** The extra inputs a service can list (service_types.fields) → their keyboard. Labels: `capture.fields.<name>`. */
export const LOG_FIELDS: Record<string, 'default' | 'decimal-pad' | 'number-pad'> = {
  brand: 'default',
  grade: 'default',
  quantity: 'decimal-pad',
  size: 'default',
  count: 'number-pad',
  warranty_months: 'number-pad',
};

/** What is typed → what is saved in `details`: only the service's own fields, empty ones dropped, numeric ones as numbers. */
export function cleanDetails(typed: Record<string, string>, allowed: string[]) {
  const out: Record<string, string | number> = {};
  for (const f of allowed) {
    const v = typed[f]?.trim();
    if (v && f in LOG_FIELDS) out[f] = LOG_FIELDS[f] !== 'default' && !isNaN(Number(v)) ? Number(v) : v;
  }
  return out;
}

export type SaveLogInput = {
  vehicleId: string;
  serviceTypeId: string | null;
  title: string;
  odometer: number | null;
  cost: number | null;
  serviceDate: string;
  location: string;
  notes?: string; // optional so a log queued offline by an older build still saves
  source: 'manual' | 'voice';
  transcript: string | null;
  parts: { name: string }[];
  intervalKm: number | null;
  intervalMonths?: number | null; // only voice sets it ("every 6 months")
  details?: Record<string, string | number>; // optional so a log queued offline by an older build still saves
  photoUri: string | null;
};

export const SAVE_LOG_KEY = ['saveLog'] as const;

/** Returns the saved log's status, so the success screen can mention a reading that needs review. */
export async function saveLog(d: SaveLogInput) {
  const { data } = await supabase.auth.getSession(); // local, works offline (getUser would hit the network)
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');

  const photos: string[] = [];
  if (d.photoUri) {
    const path = `${userId}/${Date.now()}.jpg`;
    const body = await (await fetch(d.photoUri)).arrayBuffer();
    const { error } = await supabase.storage.from('receipts').upload(path, body, { contentType: 'image/jpeg' });
    if (error) throw error;
    photos.push(path);
  }
  const { data: log, error } = await supabase
    .from('maintenance_logs')
    .insert({
      vehicle_id: d.vehicleId,
      service_type_id: d.serviceTypeId,
      title: d.title,
      odometer_reading: d.odometer,
      cost: d.cost,
      service_date: d.serviceDate,
      location: d.location || null,
      description: d.notes?.trim() || null,
      source: d.source,
      voice_transcript: d.transcript,
      parts_replaced: d.parts,
      interval_km: d.intervalKm,
      interval_months: d.intervalMonths ?? null,
      details: d.details ?? {},
      photos,
    })
    .select('id, status')
    .single();
  if (error) throw error;
  return log;
}
