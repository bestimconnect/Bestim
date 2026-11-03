// Run: node --experimental-strip-types src/lib/planRules.check.ts
import assert from 'node:assert/strict';

import { can, limit, planRaising, planWith, trialPlan } from './planRules.ts';

const plan = (id: string, entitlements: Record<string, number | boolean | null>, trial_days = 0) => ({ id, entitlements, trial_days }) as never;
const basic = plan('basic', { max_cars: 2, share_history: false, export: false });
const pro = plan('pro', { max_cars: null, share_history: true, export: true }, 14);
const max = plan('max', { max_cars: null, share_history: true, export: true });
const plans = [basic, pro, max];
const ent = (plan_id: string | null, entitlements: Record<string, number | boolean | null>, trial_used = false) => ({ plan_id, entitlements, trial_used }) as never;

// No plan data (offline, loading) never blocks; a plan that lists a feature off does, and so does one that omits it.
assert.equal(can(null, 'export'), true);
assert.equal(can(ent(null, {}), 'export'), true);
assert.equal(can(ent('basic', { export: false }), 'export'), false);
assert.equal(can(ent('basic', {}), 'export'), false);
assert.equal(can(ent('pro', { export: true }), 'export'), true);

// A limit is the plan's number, null when unlimited or unknown.
assert.equal(limit(ent('basic', { max_cars: 2 }), 'max_cars'), 2);
assert.equal(limit(ent('pro', { max_cars: null }), 'max_cars'), null);
assert.equal(limit(null, 'max_cars'), null);

// Upgrade targets: the nearest plan above that adds the feature / lifts the limit.
assert.equal(planWith(plans, 'basic', 'export'), pro);
assert.equal(planWith(plans, 'pro', 'export'), max);
assert.equal(planWith(plans, 'max', 'export'), undefined);
assert.equal(planRaising(plans, basic, 'max_cars'), pro);
assert.equal(planRaising(plans, max, 'max_cars'), undefined); // nothing above the top plan

// A trial is offered once.
assert.equal(trialPlan(plans, ent('basic', {})), pro);
assert.equal(trialPlan(plans, ent('basic', {}, true)), undefined);
console.log('planRules ok');
