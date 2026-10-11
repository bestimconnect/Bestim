// Run: node --experimental-strip-types src/lib/quickAdd.check.ts
import assert from 'node:assert/strict';

import { expenseChip, isFresh, topChips } from './quickAdd.ts';

const defaults = ['oil', 'x:fuel', 'x:wash', 'tyres', 'brakes', 'battery'];
const log = (service_type_id: string | null) => ({ service_type_id });
const cost = (category: string, from_log = false) => ({ category, from_log });

assert.deepEqual(topChips([], [], defaults), defaults); // a new owner gets the defaults
// Most used first, no duplicates, cut at 6.
assert.deepEqual(topChips([log('belt'), log('brakes'), log('belt')], [cost('fuel'), cost('fuel'), cost('fuel')], defaults), ['x:fuel', 'belt', 'brakes', 'oil', 'x:wash', 'tyres']);
assert.deepEqual(topChips([log('belt'), log('filter')], [], defaults), ['belt', 'filter', 'oil', 'x:fuel', 'x:wash', 'tyres']); // ties: first seen first
// A log's own cost and an empty service don't count as running costs / services.
assert.deepEqual(topChips([log(null)], [cost('maintenance'), cost('wash', true)], defaults), defaults);
assert.equal(expenseChip('fuel'), 'x:fuel');
// 24-hour edit window.
const now = Date.parse('2026-10-12T12:00:00Z');
assert.equal(isFresh('2026-10-12T11:00:00Z', now), true);
assert.equal(isFresh('2026-10-11T12:00:01Z', now), true);
assert.equal(isFresh('2026-10-11T12:00:00Z', now), false); // exactly 24 hours: reason needed
assert.equal(isFresh('2026-10-01T00:00:00Z', now), false);
console.log('quickAdd ok');
