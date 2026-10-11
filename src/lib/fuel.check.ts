// Run: node --experimental-strip-types src/lib/fuel.check.ts
import assert from 'node:assert/strict';

import { consumption } from './fuel.ts';

const fill = (odometer_reading: number | null, liters: number | null, amount: number, full_tank = true, id?: string) => ({ odometer_reading, liters, amount, full_tank, id });

assert.equal(consumption([]), null);
assert.equal(consumption([fill(1000, 40, 400)]), null); // one fill-up is not a pair
assert.equal(consumption([fill(1000, 40, 400), fill(1400, null, 400), fill(null, 30, 300)]), null); // litres or reading missing: not counted

// Out of order on purpose: 1000 → 1400 (30 L, 300 EGP) → 1900 (40 L, 480 EGP).
const c = consumption([fill(1900, 40, 480), fill(1000, 40, 400), fill(1400, 30, 300)])!;
assert.equal(c.pairs, 2);
assert.deepEqual(c.latest, { kmPerLiter: 500 / 40, costPerKm: 480 / 500 });
assert.deepEqual(c.average, { kmPerLiter: (400 / 30 + 500 / 40) / 2, costPerKm: (300 / 400 + 480 / 500) / 2 });

// A partial fill-up adds its litres and money to the next full tank's figure; it never closes a pair itself.
// 1000 full → 1200 partial (10 L, 100) → 1600 full (20 L, 220): 600 km on 30 L, 320 EGP.
const p = consumption([fill(1000, 40, 400, true, 'a'), fill(1200, 10, 100, false, 'b'), fill(1600, 20, 220, true, 'c')])!;
assert.equal(p.pairs, 1);
assert.deepEqual(p.latest, { kmPerLiter: 600 / 30, costPerKm: 320 / 600 });
assert.deepEqual([...p.byFill.keys()], ['c']);

// Partial fill-ups before the first full tank don't count; ending on a partial gives no figure yet.
assert.equal(consumption([fill(900, 10, 100, false), fill(1000, 40, 400), fill(1300, 15, 150, false)]), null);

// Rows saved before the switch existed (no full_tank) count as full.
assert.equal(consumption([{ odometer_reading: 1000, liters: 40, amount: 400 }, { odometer_reading: 1400, liters: 32, amount: 320 }])!.latest.kmPerLiter, 400 / 32);

// Same reading twice (a pair with no distance) is ignored.
assert.equal(consumption([fill(1000, 40, 400), fill(1000, 35, 350)]), null);

console.log('fuel ok');
