// Run: node --experimental-strip-types src/lib/export.check.ts
import assert from 'node:assert/strict';

import { excludedCount, toCsv, toHtml, toJson, type ExportLabels, type ExportLog, type ExportOptions } from './export.ts';

const t: ExportLabels = {
  title: 'History', date: 'Date', service: 'Service', odometer: 'Odometer', cost: 'Cost', workshop: 'Workshop',
  receipt: 'Receipt', notes: 'Notes', status: 'Status', plate: 'Plate', vin: 'VIN', yes: 'Yes',
  excluded: '{{n}} details left out', rtl: false,
};
const v = { make: 'Toyota', model: 'Hilux', year: 2023, plate_number: 'ABC 123', vin: 'VIN9', current_odometer: 134550, odometer_unit: 'km' };
const logs: ExportLog[] = [
  { service_date: '2026-09-07', title: 'Oil, "Mobil 1"', odometer_reading: 125000, cost: 1200, currency: 'EGP', location: 'Al Nasr', description: 'secret note', status: 'verified', photos: ['a.jpg'] },
  { service_date: '2026-07-01', title: 'Check', odometer_reading: null, cost: null, currency: 'EGP', location: null, description: null, status: 'verified', photos: [] },
];
const all: ExportOptions = { costs: true, workshops: true, identifiers: true, notes: true };
const none: ExportOptions = { costs: false, workshops: false, identifiers: false, notes: false };

// Everything on: nothing excluded, private fields present.
assert.equal(excludedCount(v, logs, all), 0);
const full = toCsv(v, logs, all, t);
assert.ok(full.startsWith('﻿'));
assert.ok(full.includes('"Oil, ""Mobil 1"""')); // commas and quotes are escaped
assert.ok(full.includes('1200 EGP') && full.includes('Al Nasr') && full.includes('secret note'));

// Everything off: private content must not leak into any format; the count says what was left out.
assert.equal(excludedCount(v, logs, none), 6); // plate, vin, cost, workshop, receipt, note
for (const out of [toCsv(v, logs, none, t), toJson(v, logs, none), toHtml(v, logs, none, t)]) {
  for (const secret of ['1200', 'Al Nasr', 'secret note', 'ABC 123', 'VIN9']) assert.ok(!out.includes(secret), secret);
  assert.ok(out.includes('125000') || out.includes('125,000')); // logs are always included
}
assert.equal(JSON.parse(toJson(v, logs, none)).excluded_details, 6);
assert.ok(toHtml(v, logs, none, t).includes('6 details left out'));
assert.ok(toCsv(v, logs, none, t).endsWith('6 details left out'));

// HTML escapes user text.
assert.ok(!toHtml(v, [{ ...logs[0], title: '<script>x</script>' }], all, t).includes('<script>x'));

console.log('export ok');
