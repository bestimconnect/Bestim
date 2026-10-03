// Run: node --experimental-strip-types src/lib/voiceRecords.check.ts
import assert from 'node:assert/strict';

import { isComplete, normalizeRecords } from './voiceRecords.ts';

const ctx = { vehicleIds: ['car', 'bike'], fallbackVehicleId: 'car', serviceNames: ['Oil Change', 'Oil Filter'], today: '2026-10-03' };
const blank = {
  vehicle_id: 'car', service_type: null, category: null, title: null, amount: null, odometer: null,
  date: null, location: null, parts: [], interval_km: null, interval_months: null,
};

// "Changed the oil and the filter at 125k for 1200, filled petrol for 500, the bike is at 8,000."
let r = normalizeRecords(
  [
    { ...blank, kind: 'maintenance', service_type: 'Oil Change', amount: 1200, odometer: 125000, parts: ['Mobil 1'], interval_km: 10000 },
    { ...blank, kind: 'maintenance', service_type: 'Oil Filter', odometer: 125000 },
    { ...blank, kind: 'expense', category: 'fuel', amount: 500, location: 'Shell', title: 'بنزين' },
    { ...blank, kind: 'odometer', vehicle_id: 'bike', odometer: 8000 },
    { ...blank, kind: 'odometer', odometer: 125000 }, // same reading as the oil change: not a separate update
  ],
  ctx,
);
assert.deepEqual(r.map((x) => x.kind), ['maintenance', 'maintenance', 'expense', 'odometer']);
assert.deepEqual(r[0], {
  kind: 'maintenance', vehicleId: 'car', serviceType: 'Oil Change', title: '', odometer: 125000, cost: 1200, date: null,
  location: '', parts: [{ name: 'Mobil 1' }], intervalKm: 10000, intervalMonths: null, photoUri: null,
});
assert.deepEqual(r[2], { kind: 'expense', vehicleId: 'car', category: 'fuel', amount: 500, date: null, place: 'Shell' });
assert.deepEqual(r[3], { kind: 'odometer', vehicleId: 'bike', reading: 8000 });

// The model's answer is never trusted: unknown vehicle, service, category and impossible values are corrected or dropped.
r = normalizeRecords(
  [
    { ...blank, kind: 'maintenance', vehicle_id: 'someone-else', service_type: 'Flux Capacitor', title: 'لحام الشكمان', amount: -5, odometer: 1e12, date: '2031-01-01' },
    { ...blank, kind: 'expense', category: 'bribes', amount: 99.999, date: '2026-10-02' },
    { ...blank, kind: 'maintenance' }, // no service and no title
    { ...blank, kind: 'expense' }, // empty shell
    { ...blank, kind: 'odometer', odometer: 0 },
    { ...blank, kind: 'drop table' },
    null,
    'nonsense',
  ],
  ctx,
);
assert.equal(r.length, 2);
assert.deepEqual(r[0], {
  kind: 'maintenance', vehicleId: 'car', serviceType: null, title: 'لحام الشكمان', odometer: null, cost: null, date: null,
  location: '', parts: [], intervalKm: null, intervalMonths: null, photoUri: null,
});
assert.deepEqual(r[1], { kind: 'expense', vehicleId: 'car', category: 'other', amount: 100, date: '2026-10-02', place: '' });
// A fuel expense's label ("petrol") is not a place; an "other" expense's label is all that says what it was.
const place = (category: string, title: string) =>
  (normalizeRecords([{ ...blank, kind: 'expense', category, amount: 1, title }], ctx)[0] as { place: string }).place;
assert.equal(place('fuel', 'بنزين'), '');
assert.equal(place('other', 'ركنة'), 'ركنة');

assert.deepEqual(normalizeRecords({ records: 'no' }, ctx), []);
assert.equal(normalizeRecords(Array(50).fill({ ...blank, kind: 'expense', amount: 1 }), ctx).length, 20);

// An expense with no amount stays on the list for the user to fill in, but cannot be saved yet.
r = normalizeRecords([{ ...blank, kind: 'expense', category: 'fuel' }], ctx);
assert.equal(r.length, 1);
assert.equal(isComplete(r[0]), false);

console.log('voiceRecords ok');
