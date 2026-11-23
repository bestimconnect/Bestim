import assert from 'node:assert/strict';

import { searchCatalog, type CatalogJob, type CatalogPart } from './catalogSearch.ts';

const job = (id: string, name_en: string, name_ar: string, aliases: string[] = [], extra: Partial<CatalogJob> = {}): CatalogJob =>
  ({ id, name_en, name_ar, aliases, specialist_key: 'mechanic', system_id: 1, suggested_items: [], tracked: true, fuel_types: null, ...extra });
const part = (id: string, name_en: string, name_ar: string, aliases: string[] = []): CatalogPart => ({ id, name_en, name_ar, aliases, system_id: 1, item_type: 'part', fuel_types: null });

const jobs = [
  job('oil', 'Oil change', 'تغيير زيت', ['زيت']),
  job('hg', 'Head gasket replacement', 'تغيير وش سلندر', ['جوان', 'راس السلندر']),
  job('plugs', 'Spark plugs replacement', 'تغيير شمعات', ['بوجيهات', 'بواجي']),
  job('diesel', 'Glow plugs', 'سخانات', [], { fuel_types: ['diesel'] }),
];
const parts = [part('gk', 'Head gasket', 'جوان وش'), part('pad', 'Brake pads', 'تيل فرامل')];

const ids = (q: string, fuel?: string) => searchCatalog(q, jobs, parts, fuel).map((h) => h.row.id);
assert.equal(ids('زيت')[0], 'oil'); // oil change first
assert.deepEqual(ids('جوان').slice(0, 2).sort(), ['gk', 'hg']); // alias finds the job and the part
assert.equal(ids('بواجي')[0], 'plugs'); // slang alias
assert.equal(ids('شمعات')[0], 'plugs');
assert.equal(ids('وش سلندر')[0], 'hg'); // every word must match
assert.equal(ids('brake')[0], 'pad');
assert.deepEqual(ids('سخانات', 'petrol'), []); // diesel-only job hidden on a petrol car
assert.deepEqual(ids('سخانات', 'diesel'), ['diesel']);
assert.deepEqual(ids('zzzz'), []);
assert.equal(searchCatalog('oil', jobs, parts, null, { due: new Set(['pad']) })[0].row.id, 'oil'); // exact/starts beats due boost
console.log('catalogSearch ok');
