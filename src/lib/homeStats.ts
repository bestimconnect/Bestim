// Figures for Home (decisions Q94). Pure, so `node --experimental-strip-types src/lib/homeStats.check.ts` can run it.

type StatusLike = { status: { state: 'ok' | 'soon' | 'overdue'; urgency: number }; snoozedUntil: string | null };

/** Overdue and coming-up parts, snoozed ones left out (the same parts as "Today's priority"). */
export function statusCounts(parts: StatusLike[]) {
  const live = parts.filter((p) => !p.snoozedUntil);
  return { overdue: live.filter((p) => p.status.state === 'overdue').length, soon: live.filter((p) => p.status.state === 'soon').length };
}

/**
 * The next service to show beside the numbers: the most urgent part not already in the priority list (its first
 * `shown` rows), so Home doesn't say the same thing twice; when every part is listed there, the most urgent one.
 */
export function nextDue<P extends StatusLike>(parts: P[], shown: P[]): P | null {
  const sorted = [...parts].sort((a, b) => a.status.urgency - b.status.urgency);
  return sorted.find((p) => !shown.includes(p)) ?? sorted[0] ?? null;
}

/**
 * Distance driven this calendar month: the current reading minus the last reading saved before the 1st,
 * else minus the first reading of this month. null with no history (a hint shows instead of a 0).
 */
export function kmThisMonth(readings: { reading: number; created_at: string }[], current: number, now = new Date()): number | null {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const sorted = [...readings].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const before = sorted.filter((r) => new Date(r.created_at) < start).pop();
  const base = before ?? sorted.find((r) => new Date(r.created_at) >= start);
  if (!base) return null;
  return Math.max(0, current - base.reading);
}
