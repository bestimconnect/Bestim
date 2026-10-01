// Run: node --experimental-strip-types src/lib/reminderPlan.check.ts
import assert from 'node:assert/strict';

import { partStatus } from './parts.ts';
import { alertHour, DEFAULT_PREFS, planNotifications, type PlanPart } from './reminderPlan.ts';

const now = new Date(2026, 8, 29, 12, 0); // 29 Sep 2026, noon (local)
const part = (over: Partial<Parameters<typeof partStatus>[0]>, extra: Partial<PlanPart> = {}): PlanPart => ({
  vehicleId: 'v', serviceTypeId: 's', name: 'Oil', vehicleName: 'Hilux', unit: 'km', snoozedUntil: null,
  status: partStatus({ odometer: 100000, unit: 'km', lastReading: 95000, lastDate: '2026-04-20', intervalKm: 10000, intervalMonths: 6, today: now, ...over })!,
  ...extra,
});
const iso = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}h`;

// Due 20 Oct 2026 by date, 5000 km left: alerts 3 days before and the day after, at 9:00.
let r = planNotifications([part({})], [], DEFAULT_PREFS, {}, now);
assert.deepEqual(r.planned.map((p) => p.kind === 'weekly' ? '' : `${p.kind} ${iso(p.at)}`), ['soon 2026-10-17 9h', 'overdue 2026-10-21 9h']);

// Distance crossed while the app is open: one alert next morning, and re-syncing keeps the same time.
r = planNotifications([part({ odometer: 104500, intervalMonths: null })], [], DEFAULT_PREFS, {}, now);
assert.deepEqual(r.planned.map((p) => p.kind === 'weekly' ? '' : `${p.kind} ${iso(p.at)}`), ['soon 2026-9-30 9h']);
const again = planNotifications([part({ odometer: 104500, intervalMonths: null })], [], DEFAULT_PREFS, r.sent, now);
assert.equal(again.planned.length, 1);
// After it fired, the same state never alerts again ("no daily repeat").
const later = new Date(2026, 9, 2, 12, 0);
assert.equal(planNotifications([part({ odometer: 104500, intervalMonths: null, today: later })], [], DEFAULT_PREFS, r.sent, later).planned.length, 0);
// Going overdue by distance is a new state → a new alert.
assert.equal(planNotifications([part({ odometer: 105200, intervalMonths: null, today: later })], [], DEFAULT_PREFS, r.sent, later).planned[0].kind, 'overdue');

// Snoozed parts and switched-off prefs produce nothing.
assert.equal(planNotifications([part({}, { snoozedUntil: '2026-10-06' })], [], DEFAULT_PREFS, {}, now).planned.length, 0);
assert.equal(planNotifications([part({})], [], { ...DEFAULT_PREFS, due_soon: false, overdue: false }, {}, now).planned.length, 0);

// Odometer nudge 14 days after the last reading; weekly only when enabled.
const v = [{ id: 'v', name: 'Hilux', odometerUpdatedAt: new Date(2026, 8, 25, 10, 0).toISOString() }];
r = planNotifications([], v, { ...DEFAULT_PREFS, weekly: true }, {}, now);
assert.deepEqual(r.planned.map((p) => p.kind), ['odometer', 'weekly']);
assert.equal(r.planned[0].kind === 'odometer' && iso(r.planned[0].at), '2026-10-9 9h');

// Quiet hours: 9:00 inside the window moves to its end; from === to means off.
assert.equal(alertHour(DEFAULT_PREFS), 9);
assert.equal(alertHour({ ...DEFAULT_PREFS, quiet_from: 23, quiet_to: 10 }), 10);
assert.equal(alertHour({ ...DEFAULT_PREFS, quiet_from: 0, quiet_to: 12 }), 12);
assert.equal(alertHour({ ...DEFAULT_PREFS, quiet_from: null, quiet_to: null }), 9);

console.log('reminderPlan ok');
