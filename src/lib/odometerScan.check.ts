// Run: node --experimental-strip-types src/lib/odometerScan.check.ts
import assert from 'node:assert/strict';

import { candidates, cleanLine, maxJump, NO_VOTES, pickOutlier, pickReading, vote, type Votes } from './odometerScan.ts';

const values = (lines: string[]) => candidates(lines).filter((s) => !s.joined).map((s) => s.value);

const KM = maxJump('km', 10); // 10 days since the last update → up to 10,000 km

// The founder's four reference dashboards, as a text reader would see them.
// 1. Mechanical-style counter at 000001 on a new car.
assert.equal(pickReading(['10 20 30 40 50 60 70 80 90 100 110 120 130 140', 'mph', '000001', 'x 1000 r/m', 'F', 'E'], 0, KM), 1);
// 2. Digital 031308 under an MPH dial with a km/h inner ring.
assert.equal(pickReading(['0 10 20 30 40 50 60 70 80 90 100 110 120', '20 60 100 140 180', 'MPH km/h', '031308', '6', '7', '40', '100'], 30900, KM), 31308);
// 3. Orange digital 205343, RPM dial and gear letters beside it.
assert.equal(pickReading(['20 40 60 80 100 120 140 160 180 200 220 240', 'km/h', '205343', 'x1000r/min', '1 2 3 4 5 6 7 8', 'P R N D D3'], 204000, KM), 205343);
// 4. LCD with the outside temperature above the reading.
assert.equal(pickReading(['OUT SIDE 74°F', '20000', 'MPH', '10 20 30 40 50 60 70 80 90 100 110', 'x1000 RPM'], 19500, KM), 20000);

// Separate wheels read as separate digits are one number; speed marks are not.
assert.deepEqual(values(['0 3 1 3 0 8']), [31308]);
assert.deepEqual(values(['100 120']), [100, 120]);
// Thousands separators, a trip counter, a clock, units glued on.
assert.deepEqual(values(['20,000', '20.000', 'TRIP A 412.6', '12:45', '74°F', '180km/h']), [20000, 20000]);

// A trip counter or anything below the current reading is never the odometer.
assert.equal(pickReading(['TRIP 4126', '205343'], 204000, KM), 205343);
assert.equal(pickReading(['205343'], 210000, KM), null);
// Too far above to believe (a misread digit): 905343 after 204,000 ten days ago.
assert.equal(pickReading(['905343'], 204000, KM), null);
// The closest fit wins when two numbers pass.
assert.equal(pickReading(['205343', '206000'], 204000, KM), 205343);
// Nothing readable.
assert.equal(pickReading(['MPH', 'km/h'], 204000, KM), null);

// Nothing fits, but a display-like number is in view: the scanner offers it instead of ignoring it (Q73).
assert.equal(pickOutlier(['100 120', 'km/h', '205343']), 205343); // lower than a saved 250,500
assert.equal(pickOutlier(['000001', '140']), 1); // six digits on the display, leading zeros count
assert.equal(pickOutlier(['50 60 70', 'MPH']), null); // speed marks are never offered

assert.equal(maxJump('km', 0), 5000);
assert.equal(maxJump('km', 30), 30000);
assert.equal(maxJump('h', 2), 100);

// Q97: what the reader really hands back on segment / LCD displays and labelled clusters.
assert.equal(cleanLine('ODO134550km'), ' 134550 ');
assert.equal(pickReading(['ODO 134550 km'], 134000, KM), 134550);
assert.equal(pickReading(['ODO134550km'], 134000, KM), 134550);
assert.equal(pickReading(['TOTAL 134550KM'], 134000, KM), 134550);
assert.equal(pickReading(['1345S0'], 134000, KM), 134550); // S for 5
assert.equal(pickReading(['O31308'], 30900, KM), 31308); // O for 0
assert.equal(pickReading(['2O5343'], 204000, KM), 205343);
assert.equal(pickReading(['1B4550'], 180000, maxJump('km', 400)), 184550); // B for 8
assert.equal(pickReading(['l34550'], 134000, KM), 134550); // l for 1
assert.equal(pickReading(['134 550'], 134000, KM), 134550); // split in two
assert.equal(pickReading(['134,550 km'], 134000, KM), 134550);
assert.equal(pickReading(['كم 134550'], 134000, KM), 134550);
// Gears, speeds and words are left alone.
assert.deepEqual(values(['P R N D D3']), []); // a gear is not a number
assert.deepEqual(values(['180km/h']), []);
assert.equal(pickReading(['TRIP A 412.6', 'ODO 134550'], 134000, KM), 134550);
// A speed scale is never joined into a reading, and a joined number is never offered on its own.
assert.equal(pickReading(['100 120 140 160'], 100000, KM), null);
assert.equal(pickOutlier(['134 550']), null);
assert.ok(candidates(['134 550']).some((c) => c.joined && c.value === 134550));

// A number counts when it wins 3 of the last 5 reads, sampled at most every 200 ms (the camera started at 0).
let v: Votes = NO_VOTES;
const step = (reading: number | null, now: number, since = 0) => {
  const r = vote(v, reading, now, since);
  v = r.votes;
  return r.accept;
};
assert.equal(step(205343, 1000), null); // one read is never enough
assert.equal(step(205343, 1100), null); // too soon: the same read handed back, not counted
assert.deepEqual(v.values, [205343]);
assert.equal(step(205843, 1200), null); // a misread in between
assert.equal(step(205343, 1400), null); // 2 of 3
assert.equal(step(205343, 1600), 205343); // 3 of 4: read for real
v = NO_VOTES;
assert.equal(step(1, 1000), null);
assert.equal(step(2, 1200), null);
assert.equal(step(3, 1400), null);
assert.equal(step(4, 1600), null);
assert.equal(step(5, 1800), null); // never the same twice: nothing
// "Look again" at 1000: for 400 ms nothing counts.
v = NO_VOTES;
assert.equal(step(7, 1100, 1000), null);
assert.deepEqual(v.values, []);

console.log('odometerScan ok');
