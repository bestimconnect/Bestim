import { supabase } from './supabase';

// Saving a visit (flow 14) is a TanStack mutation default, like saveLog: written offline it is paused, kept on the phone
// and sent when the connection is back. ponytail: save_visit has no idempotency key, so a send whose answer was lost can add the visit twice.

export type VisitItem = { type: string; catalog_item_id?: string; name: string; qty?: number; total: number };
export type VisitJob = { specialist_key: string; job_type_id?: string; custom_name?: string; items: VisitItem[] };
export type SaveVisitInput = { vehicle_id: string; visit_date: string; odometer: number | null; workshop_name: string; workshop_phone: string; notes: string; photoUri: string | null; jobs: VisitJob[] };

export const SAVE_VISIT_KEY = ['saveVisit'] as const;

/** Returns the new visit's id (for Undo). Errors: lower_reading, labor_required, jobs_required come from the database. */
export async function saveVisit(d: SaveVisitInput): Promise<string> {
  const { data } = await supabase.auth.getSession();
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
  const { photoUri: _p, ...rest } = d;
  const { data: id, error } = await supabase.rpc('save_visit', { p: { ...rest, photos } });
  if (error) {
    if (photos.length) await supabase.storage.from('receipts').remove(photos);
    throw error;
  }
  return id;
}
