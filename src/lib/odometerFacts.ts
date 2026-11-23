import { differenceInCalendarDays, parseISO, subDays } from 'date-fns';

/** Average distance per day over the last 90 days of readings (newest first). null with under 3 days of history or no growth. */
export function dailyAverage(readings: { reading: number; created_at: string }[], today = new Date()): number | null {
  const recent = readings.filter((r) => parseISO(r.created_at) >= subDays(today, 90));
  if (recent.length < 2) return null;
  const newest = recent[0];
  const oldest = recent[recent.length - 1];
  const days = differenceInCalendarDays(parseISO(newest.created_at), parseISO(oldest.created_at));
  const gained = newest.reading - oldest.reading;
  return days < 3 || gained <= 0 ? null : Math.round(gained / days);
}

/** Distance left to the nearest due part, shifted by how far the reading has moved since the parts were measured (0 = due now). null with no part measured in distance. */
export function nextServiceIn(parts: { status: { remainingKm: number | null } }[], moved = 0): number | null {
  const left = parts.flatMap((p) => (p.status.remainingKm == null ? [] : [p.status.remainingKm]));
  return left.length ? Math.max(0, Math.min(...left) - moved) : null;
}
