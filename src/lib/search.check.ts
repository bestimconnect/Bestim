// Run: node --experimental-strip-types src/lib/search.check.ts
import assert from 'node:assert/strict';

import { matches } from './search.ts';

assert.ok(matches('crv', 'CR-V'));
assert.ok(matches('CR V', 'CR-V'));
assert.ok(matches('land cru', 'Land Cruiser'));
assert.ok(matches('', 'anything'));
assert.ok(!matches('civic', 'Corolla'));

// Arabic spelling variants and tashkeel.
assert.ok(matches('اكسنت', 'أكسنت'));
assert.ok(matches('مرسيدس', 'مَرسيدس'));
assert.ok(matches('كيا', 'كـيا'));
assert.ok(matches('مكة', 'مكه'));
assert.ok(matches('موسي', 'موسى'));

// Either label counts.
assert.ok(matches('toy', 'تويوتا', 'Toyota'));
assert.ok(matches('تويو', 'تويوتا', 'Toyota'));
assert.ok(!matches('bmw', 'تويوتا', 'Toyota'));

console.log('search ok');
