// Run: node --experimental-strip-types src/lib/homeStats.check.ts
import assert from 'node:assert/strict';

import { kmThisMonth, nextDue, statusCounts } from './homeStats.ts';

const part = (state: 'ok' | 'soon' | 'overdue', urgency: number, snoozedUntil: string | null = null) => ({ status: { state, urgency }, snoozedUntil });

const over = part('overdue', -0.2);
const soon = part('soon', 0.05);
const snoozed = part('overdue', -0.5, '2026-12-01');
const ok1 = part('ok', 0.4);
const ok2 = part('ok', 0.8);
assert.deepEqual(statusCounts([over, soon, snoozed, ok1, ok2]), { overdue: 1, soon: 1 });

// Not repeated: the priority list already shows the overdue and the soon one.
assert.equal(nextDue([ok2, over, ok1, soon], [over, soon]), ok1);
// Everything is already listed: the most urgent.
assert.equal(nextDue([soon, over], [over, soon]), over);
assert.equal(nextDue([], []), null);

const now = new Date(2026, 9, 11); // 11 Oct 2026
const r = (reading: number, y: number, m: number, d: number) => ({ reading, created_at: new Date(y, m, d, 12).toISOString() });
// Last reading before the 1st is the base.
assert.equal(kmThisMonth([r(1000, 2026, 8, 20), r(1200, 2026, 8, 29), r(1500, 2026, 9, 5)], 1700, now), 500);
// Only readings this month: from the first one.
assert.equal(kmThisMonth([r(1500, 2026, 9, 5), r(1600, 2026, 9, 8)], 1700, now), 200);
// No history.
assert.equal(kmThisMonth([], 1700, now), null);

console.log('homeStats ok');
