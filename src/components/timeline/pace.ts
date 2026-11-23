import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Km (or mi) driven per day, from the odometer readings (any order). null when there is not a week of data yet. */
export function pace(readings: { reading: number; created_at: string }[]): number | null {
  if (readings.length < 2) return null;
  const sorted = [...readings].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = differenceInCalendarDays(parseISO(last.created_at), parseISO(first.created_at));
  const km = last.reading - first.reading;
  return days >= 7 && km > 0 ? km / days : null;
}

/** Whole weeks until a part is due: by distance at the owner's pace when known, else by the calendar. null = unknown. */
export function weeksLeft(s: { remainingKm: number | null; remainingDays: number | null }, perDay: number | null): number | null {
  const days = s.remainingKm != null && perDay ? s.remainingKm / perDay : s.remainingDays;
  return days == null ? null : Math.max(0, Math.round(days / 7));
}
