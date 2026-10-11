// Chips of the quick-add sheet. Pure, so `node --experimental-strip-types src/lib/quickAdd.check.ts` can run it.

/** A chip id is a service type's id, or `x:<expense_code>` for a running cost (fuel, car wash …). */
export const expenseChip = (code: string) => `x:${code}`;

/** Up to `max` chip ids: what the owner used most (ties keep the order first seen), then the defaults; never twice. */
export function topChips(
  logs: { service_type_id: string | null }[],
  expenses: { category: string; from_log?: boolean | null }[],
  defaults: string[],
  max = 6,
): string[] {
  const uses = new Map<string, number>();
  const bump = (id: string) => uses.set(id, (uses.get(id) ?? 0) + 1);
  for (const l of logs) if (l.service_type_id) bump(l.service_type_id);
  for (const e of expenses) if (!e.from_log && e.category !== 'maintenance') bump(expenseChip(e.category)); // a log's own cost is not a running cost
  const used = [...uses].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return [...new Set([...used, ...defaults])].slice(0, max);
}

/** A record stays freely editable for 24 hours after it was created; later changes need a reason (the database enforces the same). */
export const isFresh = (createdAt: string, now = Date.now()) => now - Date.parse(createdAt) < 24 * 60 * 60 * 1000;
