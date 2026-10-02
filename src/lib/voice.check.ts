// Run: node --experimental-strip-types src/lib/voice.check.ts
import assert from 'node:assert/strict';

import { parseReading, parseTranscript } from './voice.ts';

// Design 14/15.
let r = parseTranscript('غيّرت زيت المحرك عند 125 ألف ودفعت 1200 جنيه');
assert.equal(r.service_type, 'Oil Change');
assert.equal(r.odometer, 125000);
assert.equal(r.cost, 1200);
assert.equal(r.needs_clarification, false);

// Design 17: "Mobil 10 thousand" is an interval or a product name.
r = parseTranscript('غيرت الزيت موبيل 10 آلاف عند 125 ألف بـ1200 جنيه');
assert.equal(r.odometer, 125000);
assert.equal(r.cost, 1200);
assert.equal(r.needs_clarification, true);
assert.equal(r.questions[0].value, 10000);
assert.deepEqual(r.parts, [{ name: 'موبيل' }]);

// Arabic-Indic digits, English, specific-before-generic keywords.
assert.equal(parseTranscript('غيرت فلتر الزيت عند ١٣٠٬٠٠٠ كم').odometer, 130000);
assert.equal(parseTranscript('غيرت فلتر الزيت').service_type, 'Oil Filter');
r = parseTranscript('Replaced front brake pads at 124,200 km, paid 850 pounds');
assert.equal(r.service_type, 'Brake Pad Replacement');
assert.equal(r.odometer, 124200);
assert.equal(r.cost, 850);

// Nothing recognisable → all empty, no question.
r = parseTranscript('مرحبا');
assert.equal(r.service_type, null);
assert.equal(r.odometer, null);
assert.equal(r.cost, null);

// Update-odometer by voice (decisions Q53).
assert.equal(parseReading('العداد ١٣٤٬٥٥٠'), 134550);
assert.equal(parseReading('134 550 km'), 134550);
assert.equal(parseReading('125 ألف و300'), 125300);
assert.equal(parseReading('one hundred thousand'), null);

console.log('voice ok');
