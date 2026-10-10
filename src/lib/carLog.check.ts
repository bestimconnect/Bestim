// Run: node --experimental-strip-types src/lib/carLog.check.ts
import assert from 'node:assert/strict';

import { carLog, scopeOf } from './carLog.ts';

const cats = [
  { id: 'eng', parent_id: null, expense_code: null },
  { id: 'oil', parent_id: 'eng', expense_code: null },
  { id: 'fuelTop', parent_id: null, expense_code: null },
  { id: 'fuel', parent_id: 'fuelTop', expense_code: 'fuel' },
];
const services = [{ id: 'oilChange', category_id: 'oil' }, { id: 'carWash', category_id: null }];
const noon = (d: string) => `${d}T12:00:00`;
const log = (id: string, d: string, odo: number | null, service: string | null) => ({ id, service_date: d, created_at: noon(d), odometer_reading: odo, service_type_id: service });
const logs = [log('oil1', '2026-09-10', 80000, 'oilChange'), log('wash1', '2026-08-01', null, 'carWash')];
const costs = [
  { id: 'f1', expense_date: '2026-09-20', created_at: noon('2026-09-20'), category: 'fuel', from_log: false },
  { id: 'fromLog', expense_date: '2026-09-10', created_at: noon('2026-09-10'), category: 'maintenance', from_log: true },
];
const readings = [
  { id: 'r1', reading: 80000, created_at: noon('2026-09-10') }, // the oil change's own reading
  { id: 'r2', reading: 80400, created_at: noon('2026-09-25') },
  { id: 'r3', reading: 80000, created_at: noon('2026-09-26') }, // same number, another day: listed
];
const ids = (kind: Parameters<typeof carLog>[3], scope = null as ReturnType<typeof scopeOf>) =>
  carLog(logs, costs, readings, kind, scope).map((e) => e.item.id);

assert.deepEqual(ids('all'), ['r3', 'r2', 'f1', 'oil1', 'wash1']); // newest first; cost from a log and the same-day reading are not listed twice
assert.deepEqual(ids('maintenance'), ['oil1', 'wash1']);
assert.deepEqual(ids('cost'), ['f1']);
assert.deepEqual(ids('reading'), ['r3', 'r2']);

// Filters: a category reaches its subcategories' services and costs; a service only itself; readings drop out.
assert.deepEqual(ids('all', scopeOf('eng', cats, services)), ['oil1']);
assert.deepEqual(ids('all', scopeOf('oil', cats, services)), ['oil1']);
assert.deepEqual(ids('all', scopeOf('oilChange', cats, services)), ['oil1']);
assert.deepEqual(ids('all', scopeOf('fuelTop', cats, services)), ['f1']);
assert.deepEqual(ids('all', scopeOf('fuel', cats, services)), ['f1']);
assert.deepEqual(ids('cost', scopeOf('eng', cats, services)), []);
assert.equal(scopeOf(null, cats, services), null);

console.log('carLog ok');
