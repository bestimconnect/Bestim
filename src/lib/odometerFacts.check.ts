// Run: node --experimental-strip-types --no-warnings src/lib/odometerFacts.check.ts
import assert from 'node:assert/strict';

import { dailyAverage, nextServiceIn } from './odometerFacts.ts';

const today = new Date(2026, 10, 3, 12);
const r = (reading: number, d: string) => ({ reading, created_at: `${d}T10:00:00` });

assert.equal(dailyAverage([r(1300, '2026-11-02'), r(1000, '2026-10-23')], today), 30); // 300 km over 10 days
assert.equal(dailyAverage([r(1300, '2026-11-02')], today), null); // one reading
assert.equal(dailyAverage([r(1300, '2026-11-02'), r(1200, '2026-11-01')], today), null); // under 3 days
assert.equal(dailyAverage([r(900, '2026-11-02'), r(1000, '2026-10-01')], today), null); // no growth
assert.equal(dailyAverage([r(1300, '2026-11-02'), r(100, '2026-05-01')], today), null); // old reading ignored, one left

assert.equal(nextServiceIn([{ status: { remainingKm: 4200 } }, { status: { remainingKm: 900 } }, { status: { remainingKm: null } }]), 900);
assert.equal(nextServiceIn([{ status: { remainingKm: 900 } }], 300), 600);
assert.equal(nextServiceIn([{ status: { remainingKm: -50 } }]), 0);
assert.equal(nextServiceIn([{ status: { remainingKm: null } }]), null);
console.log('odometerFacts ok');
