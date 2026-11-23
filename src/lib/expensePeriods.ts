// Pure maths behind the Expenses tab: one month (a point per day) or one year (a point per month).
// A period is named by its date prefix: '2026-10' (month) or '2026' (year); expense_date is 'YYYY-MM-DD', so startsWith picks a period.
export type Mode = 'month' | 'year';
export type Spend = { expense_date: string; amount: number | string; category: string };
export type Point = { n: number; total: number; future: boolean };

/** Whole number with Latin digits, in Arabic too. */
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pad = (n: number) => String(n).padStart(2, '0');
const sum = (list: Spend[]) => list.reduce((s, e) => s + Number(e.amount), 0);

/** The period containing `d` ('2026-10' or '2026'). */
export const keyOf = (mode: Mode, d = new Date()) => (mode === 'year' ? String(d.getFullYear()) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`);

/** The period `by` steps away (negative = earlier). */
export const shift = (mode: Mode, key: string, by: number) =>
  mode === 'year' ? String(Number(key) + by) : keyOf('month', new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + by, 1));

export const inPeriod = <T extends Spend>(list: T[], key: string) => list.filter((e) => e.expense_date.startsWith(key));

export const periodTotal = (list: Spend[], key: string) => sum(inPeriod(list, key));

/** Total of the expenses whose category is one of `cats`. */
export const sumCats = (list: Spend[], cats: readonly string[]) => sum(list.filter((e) => cats.includes(e.category)));

/** Oldest expense date, or null when there are none. */
export const earliest = (list: Spend[]) => list.reduce<string | null>((m, e) => (m == null || e.expense_date < m ? e.expense_date : m), null);

/** Is there anything before this period? Drives the "older" arrow. */
export const hasOlder = (list: Spend[], key: string) => {
  const first = earliest(list);
  return first != null && first.slice(0, key.length) < key;
};

/** Day points of a month / month points of a year. A point after `today` is `future` (not drawn) unless money is already booked on it. */
export function series(list: Spend[], mode: Mode, key: string, today = new Date()): Point[] {
  const len = mode === 'year' ? 12 : new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
  const totals = Array<number>(len).fill(0);
  for (const e of inPeriod(list, key)) totals[Number(mode === 'year' ? e.expense_date.slice(5, 7) : e.expense_date.slice(8, 10)) - 1] += Number(e.amount);
  const now = mode === 'year' ? keyOf('month', today) : `${keyOf('month', today)}-${pad(today.getDate())}`;
  return totals.map((total, i) => ({ n: i + 1, total, future: `${key}-${pad(i + 1)}` > now && !total }));
}

/** Average per elapsed point and the highest point of a series. */
export function stats(points: Point[]) {
  const live = points.filter((p) => !p.future);
  const total = live.reduce((s, p) => s + p.total, 0);
  return { avg: total / Math.max(1, live.length), top: live.reduce((m, p) => (p.total > m ? p.total : m), 0) };
}

/** Change against the previous period in whole percent; null when there is nothing to compare with. */
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
