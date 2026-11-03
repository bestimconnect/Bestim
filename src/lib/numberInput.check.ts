// Run: node --experimental-strip-types src/lib/numberInput.check.ts
// "12,5" or "١٢٫٥" used to become 125 (ten times too much money or fuel).
import assert from 'node:assert/strict';

import { clean } from './numberInput.ts';

assert.equal(clean('12.5', true), '12.5');
assert.equal(clean('12,5', true), '12.5');
assert.equal(clean('١٢٫٥', true), '12.5');
assert.equal(clean('1.2.3', true), '1.23');
assert.equal(clean('٤٥٠', true), '450');
assert.equal(clean('١٢٬٥٠٠', true), '12500');
assert.equal(clean('125,000', false), '125000');
assert.equal(clean('١٢٥٠٠٠', false), '125000');
assert.equal(clean('abc', true), '');

console.log('numberInput ok');
