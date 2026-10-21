// Run: node --experimental-strip-types src/lib/expensePeriods.check.ts
import assert from 'node:assert/strict';

import { changePct, earliest, hasOlder, keyOf, periodTotal, series, shift, stats, sumCats } from './expensePeriods.ts';

const e = (expense_date: string, amount: number, category = 'fuel') => ({ expense_date, amount, category });
const list = [e('2026-10-05', 100), e('2026-10-05', '50' as unknown as number, 'wash'), e('2026-10-20', 30), e('2026-09-30', 200), e('2025-12-31', 400, 'parts')];
const today = new Date(2026, 9, 22); // 22 Oct 2026

assert.equal(keyOf('month', today), '2026-10');
assert.equal(keyOf('year', today), '2026');
assert.equal(shift('month', '2026-01', -1), '2025-12');
assert.equal(shift('month', '2026-12', 1), '2027-01');
assert.equal(shift('year', '2026', -1), '2025');

assert.equal(periodTotal(list, '2026-10'), 180);
assert.equal(periodTotal(list, '2026'), 380);
assert.equal(sumCats(list, ['fuel', 'wash']), 380);
assert.equal(sumCats(list, ['parts']), 400);

assert.equal(earliest(list), '2025-12-31');
assert.equal(earliest([]), null);
assert.equal(hasOlder(list, '2025-12'), false);
assert.equal(hasOlder(list, '2026-01'), true);
assert.equal(hasOlder(list, '2025'), false);
assert.equal(hasOlder(list, '2026'), true);
assert.equal(hasOlder([], '2026'), false);

// Month: one point per day, days after today are future.
const days = series(list, 'month', '2026-10', today);
assert.equal(days.length, 31);
assert.equal(days[4].total, 150);
assert.equal(days[19].total, 30);
assert.equal(days[21].future, false); // today
assert.equal(days[22].future, true);
assert.equal(series(list, 'month', '2026-02', today).length, 28);
assert.equal(series(list, 'month', '2026-09', today).some((p) => p.future), false); // a past month is complete

// Year: one point per month, months after this one are future.
const months = series(list, 'year', '2026', today);
assert.equal(months.length, 12);
assert.equal(months[9].total, 180);
assert.equal(months[8].total, 200);
assert.equal(months[9].future, false);
assert.equal(months[10].future, true);
assert.equal(series(list, 'year', '2025', today).some((p) => p.future), false);

// Money booked on a future day still shows.
assert.equal(series([e('2026-10-28', 10)], 'month', '2026-10', today)[27].future, false);

assert.deepEqual(stats(days), { avg: 180 / 22, top: 150 });
assert.deepEqual(stats(series([], 'month', '2026-10', today)), { avg: 0, top: 0 });

assert.equal(changePct(180, 200), -10);
assert.equal(changePct(150, 100), 50);
assert.equal(changePct(50, 0), null);

console.log('expensePeriods ok');
