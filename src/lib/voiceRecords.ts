// What the `process-voice-log` Edge Function returns, cleaned up for the review list (capture/review-all).
// Pure (no RN imports) so `node --experimental-strip-types src/lib/voiceRecords.check.ts` can run it.
// The answer comes from an AI model: nothing in it is trusted until it has been through normalizeRecords().

export const EXPENSE_CATEGORIES = ['fuel', 'parts', 'insurance', 'registration', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type MaintenanceRecord = {
  kind: 'maintenance';
  vehicleId: string;
  serviceType: string | null; // service_types.name_en
  title: string; // empty when the service type names it
  odometer: number | null;
  cost: number | null;
  date: string | null; // YYYY-MM-DD; null = not mentioned (the app uses today)
  location: string;
  parts: { name: string }[];
  intervalKm: number | null;
  intervalMonths: number | null;
  photoUri: string | null; // receipt photo added on the edit form
};
export type ExpenseRecord = {
  kind: 'expense';
  vehicleId: string;
  category: ExpenseCategory;
  amount: number | null; // required to save; null = the user must fill it in
  date: string | null;
  place: string;
};
export type OdometerRecord = { kind: 'odometer'; vehicleId: string; reading: number };
export type VoiceRecord = MaintenanceRecord | ExpenseRecord | OdometerRecord;

const MAX_RECORDS = 20;
const MAX_READING = 5_000_000;
const MAX_AMOUNT = 99_999_999; // numeric(10,2)

const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
const amount = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_AMOUNT ? Math.round(v * 100) / 100 : null;
const whole = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? Math.round(v) : null;

type Context = { vehicleIds: string[]; fallbackVehicleId: string; serviceNames: string[]; today: string };

export function normalizeRecords(raw: unknown, ctx: Context): VoiceRecord[] {
  if (!Array.isArray(raw)) return [];
  const date = (v: unknown) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && v <= ctx.today ? v : null;

  const out: VoiceRecord[] = [];
  for (const r of raw.slice(0, MAX_RECORDS)) {
    if (!r || typeof r !== 'object') continue;
    const vehicleId = ctx.vehicleIds.includes(r.vehicle_id) ? (r.vehicle_id as string) : ctx.fallbackVehicleId;

    if (r.kind === 'maintenance') {
      const serviceType = ctx.serviceNames.includes(r.service_type) ? (r.service_type as string) : null;
      const title = text(r.title);
      if (!serviceType && !title) continue; // nothing to call it
      out.push({
        kind: 'maintenance',
        vehicleId,
        serviceType,
        title,
        odometer: whole(r.odometer, MAX_READING),
        cost: amount(r.amount),
        date: date(r.date),
        location: text(r.location),
        parts: (Array.isArray(r.parts) ? r.parts : []).map(text).filter(Boolean).slice(0, 10).map((name: string) => ({ name })),
        intervalKm: whole(r.interval_km, 500_000),
        intervalMonths: whole(r.interval_months, 120),
        photoUri: null,
      });
    } else if (r.kind === 'expense') {
      const category = EXPENSE_CATEGORIES.includes(r.category) ? (r.category as ExpenseCategory) : 'other';
      // The category already names a fuel/insurance/… expense; only "other" needs the label to say what it was.
      const place = text(r.location) || (category === 'other' ? text(r.title) : '');
      const value = amount(r.amount);
      if (value == null && category === 'other' && !place) continue; // an empty shell
      out.push({ kind: 'expense', vehicleId, category, amount: value, date: date(r.date), place });
    } else if (r.kind === 'odometer') {
      const reading = whole(r.odometer, MAX_READING);
      if (reading != null) out.push({ kind: 'odometer', vehicleId, reading });
    }
  }
  // A reading already carried by a maintenance record is not a second, separate update.
  return out.filter(
    (r) => r.kind !== 'odometer' || !out.some((m) => m.kind === 'maintenance' && m.vehicleId === r.vehicleId && m.odometer === r.reading),
  );
}

/** Can this card be saved as it is? (An expense needs an amount; the rest is optional.) */
export const isComplete = (r: VoiceRecord) => r.kind !== 'expense' || r.amount != null;
