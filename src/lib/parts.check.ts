// Run: node --experimental-strip-types src/lib/parts.check.ts
import assert from 'node:assert/strict';

import { latestPerType, partStatus } from './parts.ts';

const today = new Date('2026-09-29');
const base = { odometer: 134550, unit: 'km' as const, lastDate: '2026-06-07', today };

// Design 06: 450 km left → soon.
const soon = partStatus({ ...base, lastReading: 125000, intervalKm: 10000, intervalMonths: null })!;
assert.equal(soon.remainingKm, 450);
assert.equal(soon.state, 'soon');

// Overdue by 800 km.
const late = partStatus({ ...base, lastReading: 93750, intervalKm: 40000, intervalMonths: null })!;
assert.equal(late.remainingKm, -800);
assert.equal(late.state, 'overdue');

// Time alone makes it overdue; plenty of km left.
assert.equal(partStatus({ ...base, lastReading: 134000, intervalKm: 5000, intervalMonths: 3 })!.state, 'overdue');
// 12 days left → soon.
assert.equal(partStatus({ ...base, lastDate: '2026-04-11', lastReading: null, intervalKm: 5000, intervalMonths: 6 })!.remainingDays, 12);
// Far from due → ok. Hours use the 50 h threshold.
assert.equal(partStatus({ ...base, lastReading: 134000, intervalKm: 10000, intervalMonths: 12 })!.state, 'ok');
assert.equal(partStatus({ ...base, unit: 'h', odometer: 1240, lastReading: 1200, intervalKm: 80, intervalMonths: null })!.state, 'soon');
// No interval → not a tracked part.
assert.equal(partStatus({ ...base, lastReading: 1, intervalKm: null, intervalMonths: null }), null);
// Overdue sorts before soon.
assert.ok(late.urgency < soon.urgency);

assert.deepEqual(
  latestPerType([
    { id: 1, service_type_id: 'a' },
    { id: 2, service_type_id: 'b' },
    { id: 3, service_type_id: 'a' },
    { id: 4, service_type_id: null },
  ]).map((l) => l.id),
  [1, 2],
);

console.log('parts ok');
