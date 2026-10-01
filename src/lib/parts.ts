import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';

// Part = a service type the vehicle has a log for. Its status comes from the latest log + the interval
// (the log's own interval, else the service type default). Thresholds: decisions.md Q10.
// Pure (no RN imports) so `node --experimental-strip-types src/lib/parts.check.ts` can run it.

export type Unit = 'km' | 'mi' | 'h';
export type PartState = 'ok' | 'soon' | 'overdue';

export const SOON_DISTANCE: Record<Unit, number> = { km: 1000, mi: 1000, h: 50 };
export const SOON_DAYS = 30;

export type PartInput = {
  odometer: number; // vehicle's current reading
  unit: Unit;
  lastReading: number | null; // reading on the latest log of this type
  lastDate: string; // ISO date of that log
  intervalKm: number | null;
  intervalMonths: number | null;
  today?: Date;
};

export type PartStatus = {
  state: PartState;
  remainingKm: number | null; // negative = overdue by that much
  remainingDays: number | null;
  dueOdometer: number | null;
  dueDate: string | null;
  urgency: number; // smallest remaining fraction of the interval; sort ascending (overdue < 0 first)
};

/** null when the part has no interval to measure against (never listed, Q10). */
export function partStatus(p: PartInput): PartStatus | null {
  const today = p.today ?? new Date();
  const hasKm = p.intervalKm != null && p.lastReading != null;
  const hasDays = p.intervalMonths != null;
  if (!hasKm && !hasDays) return null;

  const dueOdometer = hasKm ? p.lastReading! + p.intervalKm! : null;
  const remainingKm = dueOdometer != null ? dueOdometer - p.odometer : null;

  const last = parseISO(p.lastDate);
  const due = hasDays ? addMonths(last, p.intervalMonths!) : null;
  const remainingDays = due ? differenceInCalendarDays(due, today) : null;

  const fractions = [
    remainingKm != null ? remainingKm / p.intervalKm! : Infinity,
    due ? remainingDays! / Math.max(differenceInCalendarDays(due, last), 1) : Infinity,
  ];
  const state: PartState =
    (remainingKm != null && remainingKm <= 0) || (remainingDays != null && remainingDays <= 0)
      ? 'overdue'
      : (remainingKm != null && remainingKm <= SOON_DISTANCE[p.unit]) || (remainingDays != null && remainingDays <= SOON_DAYS)
        ? 'soon'
        : 'ok';

  return {
    state,
    remainingKm,
    remainingDays,
    dueOdometer,
    dueDate: due ? due.toISOString().slice(0, 10) : null,
    urgency: Math.min(...fractions),
  };
}

/** Latest log per service type (logs must be sorted newest first). */
export function latestPerType<T extends { service_type_id: string | null }>(logs: T[]): T[] {
  const seen = new Set<string>();
  return logs.filter((l) => l.service_type_id != null && !seen.has(l.service_type_id) && seen.add(l.service_type_id));
}
