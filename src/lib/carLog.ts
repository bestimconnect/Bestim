// The Car log: maintenance logs, running costs and odometer readings of one car as one newest-first timeline.
// Pure (no RN imports) so `node --experimental-strip-types src/lib/carLog.check.ts` can run it.

export type Kind = 'all' | 'maintenance' | 'cost' | 'reading';
type Log = { service_date: string; created_at: string; odometer_reading: number | null; service_type_id: string | null };
type Cost = { expense_date: string; created_at: string; category: string; from_log: boolean };
type Reading = { created_at: string; reading: number };
type Cat = { id: string; parent_id: string | null; expense_code: string | null };
type Svc = { id: string; category_id: string | null };

export type Entry<L, C, R> =
  | { type: 'log'; date: string; at: string; item: L }
  | { type: 'cost'; date: string; at: string; item: C }
  | { type: 'reading'; date: string; at: string; item: R };

/** What a filter (a category, a subcategory or a service id) lets through. */
export function scopeOf(id: string | null, cats: Cat[], services: Svc[]) {
  if (!id) return null;
  if (services.some((s) => s.id === id)) return { services: new Set([id]), codes: new Set<string>() };
  const top = cats.find((c) => c.id === id && !c.parent_id);
  const subs = cats.filter((c) => c.id === id || (top && c.parent_id === top.id));
  return {
    services: new Set(services.filter((s) => subs.some((c) => c.id === s.category_id)).map((s) => s.id)),
    codes: new Set(subs.flatMap((c) => (c.expense_code ? [c.expense_code] : []))),
  };
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // the owner's local day

export function carLog<L extends Log, C extends Cost, R extends Reading>(
  logs: L[],
  costs: C[],
  readings: R[],
  kind: Kind,
  scope: ReturnType<typeof scopeOf>,
): Entry<L, C, R>[] {
  const out: Entry<L, C, R>[] = [];
  if (kind === 'all' || kind === 'maintenance')
    for (const l of logs) if (!scope || (l.service_type_id && scope.services.has(l.service_type_id))) out.push({ type: 'log', date: l.service_date, at: l.created_at, item: l });
  // A cost that came from a maintenance log is already part of that log's row.
  if (kind === 'all' || kind === 'cost')
    for (const c of costs) if (!c.from_log && (!scope || scope.codes.has(c.category))) out.push({ type: 'cost', date: c.expense_date, at: c.created_at, item: c });
  // A reading has no category; and the reading a maintenance log leaves on the same day is that log's own.
  if (!scope && (kind === 'all' || kind === 'reading'))
    for (const r of readings)
      if (!logs.some((l) => l.odometer_reading === r.reading && l.service_date === day(r.created_at))) out.push({ type: 'reading', date: day(r.created_at), at: r.created_at, item: r });
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}
