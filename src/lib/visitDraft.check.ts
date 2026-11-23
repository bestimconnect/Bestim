import assert from 'node:assert/strict';

import { buildJobs, jobTotal, type DraftJob } from './visitDraft.ts';

const base: DraftJob = { key: 'a', jobTypeId: 'j1', nameEn: 'Oil change', nameAr: 'تغيير زيت', specialist: 'oil_filters_station', cost: '450', detailed: false, labor: '', partsAmt: '', consumables: '', chosen: [] };

const quick = buildJobs([base], false)[0];
assert.equal(quick.items.filter((i) => i.type === 'labor').length, 1); // exactly one labor line, as save_visit requires
assert.equal(jobTotal(base), 450);
assert.equal(quick.items.reduce((s, i) => s + i.total, 0), 450);

const free = buildJobs([{ ...base, cost: '', jobTypeId: undefined, customName: 'شغلانة غريبة' }], true)[0];
assert.equal(free.custom_name, 'شغلانة غريبة');
assert.equal(free.items.length, 1); // no cost: only the zero labor line

const det: DraftJob = { ...base, detailed: true, labor: '100', partsAmt: '300', consumables: '50', chosen: [{ id: 'p1', name_en: 'Oil filter', name_ar: 'فلتر زيت' }, { id: 'p2', name_en: 'Drain washer', name_ar: 'وردة' }] };
const d = buildJobs([det], false)[0];
assert.equal(jobTotal(det), 450);
assert.equal(d.items.reduce((s, i) => s + i.total, 0), 450);
assert.equal(d.items.filter((i) => i.type === 'labor').length, 1);
assert.equal(d.items.find((i) => i.catalog_item_id === 'p1')?.total, 300);
const withLabor = buildJobs([{ ...base, cost: '450', labor: '100' }], false)[0]; // labor is inside the total
assert.equal(withLabor.items.find((i) => i.type === 'labor')?.total, 100);
assert.equal(withLabor.items.reduce((s, i) => s + i.total, 0), 450);
assert.equal(jobTotal({ ...base, cost: '', labor: '80' }), 80);
const arabicDigits = buildJobs([{ ...base, cost: '٤٥٠٫٥' }], false)[0]; // typed on an Arabic keyboard
assert.equal(arabicDigits.items.reduce((s, i) => s + i.total, 0), 450.5);
console.log('visitDraft ok');
