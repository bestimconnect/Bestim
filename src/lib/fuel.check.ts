// Run: node --experimental-strip-types src/lib/fuel.check.ts
import assert from 'node:assert/strict';

import { consumption } from './fuel.ts';

const fill = (odometer_reading: number | null, liters: number | null, amount: number) => ({ odometer_reading, liters, amount });

assert.equal(consumption([]), null);
assert.equal(consumption([fill(1000, 40, 400)]), null); // one fill-up is not a pair
assert.equal(consumption([fill(1000, 40, 400), fill(1400, null, 400), fill(null, 30, 300)]), null); // litres or reading missing: not counted

// Out of order on purpose: 1000 → 1400 (30 L, 300 EGP) → 1900 (40 L, 480 EGP).
const c = consumption([fill(1900, 40, 480), fill(1000, 40, 400), fill(1400, 30, 300)])!;
assert.equal(c.pairs, 2);
assert.deepEqual(c.latest, { kmPerLiter: 500 / 40, costPerKm: 480 / 500 });
assert.deepEqual(c.average, { kmPerLiter: (400 / 30 + 500 / 40) / 2, costPerKm: (300 / 400 + 480 / 500) / 2 });

// Same reading twice (a pair with no distance) is ignored.
assert.equal(consumption([fill(1000, 40, 400), fill(1000, 35, 350)]), null);

console.log('fuel ok');
