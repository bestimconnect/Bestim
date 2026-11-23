// Writes the v2 Services seed migrations from supabase/seed-data/{parts-tree,services-catalog}.json
// and supabase/seed-data/dedupe-report.md. Run: node scripts/v2-seed.mjs (from bestim-app/).
// Ids are md5(natural key)::uuid, so re-running the migrations never duplicates a row (on conflict do nothing),
// and the same id can be written here and recomputed in SQL.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const APP = new URL('..', import.meta.url).pathname;
const SEED = `${APP}supabase/seed-data/`;
const MIG = `${APP}supabase/migrations/`;
const tree = JSON.parse(readFileSync(`${SEED}parts-tree.json`, 'utf8'));
const cat = JSON.parse(readFileSync(`${SEED}services-catalog.json`, 'utf8'));

// ─── Catalog category -> tree system (1..16). Documented in 20261121090000_v2_services_schema.sql. ───
const CATEGORY_SYSTEM = {
  'PERIODIC SERVICE': 1, 'BELTS & TIMING': 1, 'ENGINE REPAIR': 1, IGNITION: 1, MACHINING: 1, 'QUICK SERVICE': 1,
  INJECTION: 2, 'FUEL SYSTEM': 2, CARBURETTOR: 2, CNG: 2,
  'EXHAUST SYSTEM': 3,
  'COOLING SYSTEM': 4,
  'CV JOINTS': 5, 'CARDAN & DIFFERENTIAL (RWD / 4X4)': 5, 'CLUTCH (MANUAL)': 5, 'MANUAL GEARBOX': 5, 'AUTOMATIC / CVT GEARBOX': 5,
  'BATTERY & CHARGING': 7, STARTING: 7, 'WIRING & FUSES': 7,
  LIGHTING: 8, 'HEADLIGHTS & TAIL LIGHTS': 8,
  SENSORS: 9, DIAGNOSTICS: 9, 'COMFORT & BODY ELECTRICS': 9, GAUGES: 9,
  'FRONT BRAKES': 10, 'REAR BRAKES': 10, 'HYDRAULICS & ABS': 10,
  STEERING: 11,
  'FRONT SUSPENSION': 12, 'REAR SUSPENSION': 12,
  'ALIGNMENT & BALANCING': 13, 'TYRES & WHEELS': 13,
  'A/C SYSTEM': 14,
  BODYWORK: 15, 'PAINT & FINISHING': 15, 'BUMPERS & AIRBAGS': 15, GLASS: 15, 'LOCKS & KEYS': 15, CLEANING: 15,
  'INTERIOR TRIM': 16, ACCESSORIES: 16,
  ROADSIDE: null, INSPECTION: null, // whole-car jobs: no single system
};
// Jobs whose own system differs from their category's (the tree puts these parts elsewhere).
const JOB_SYSTEM = {
  'Air filter replacement': 3, 'Cabin (A/C) filter replacement': 14, 'Fuel filter replacement': 2,
  'Throttle body cleaning': 3, 'Horn replacement': 7, 'Wiper motor replacement': 15, 'Wiper blades replacement': 15,
  'Washer pump replacement': 15, 'Power mirror repair': 15, 'Airbag replacement': 16, 'Remote / alarm installation': 9,
  'Key / immobilizer programming': 9, 'Interior cleaning': 16, 'Multimedia screen installation': 16,
  'Roof rack / tow hook': 15, 'Car cover': 15,
};
const HEALTH_WEIGHT = { 10: 2, 13: 2 }; // brakes (incl. brake fluid), wheels & tyres; everything else 1
// Spelling groups the PDF does not list but the founder uses (task brief: جوان = وش = راس السلندر).
const EXTRA_ALIAS_GROUPS = [
  { en: 'Cylinder head', ar: ['وش السلندر', 'راس السلندر', 'وش'] },
  { en: 'Head gasket', ar: ['جوان وش', 'جوان راس السلندر', 'جوان'] },
];

// ─── helpers ───
const md5uuid = (k) => {
  const h = createHash('md5').update(k, 'utf8').digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const lit = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a, type = 'text') => (a == null ? 'null' : a.length ? `array[${a.map(lit).join(', ')}]::${type}[]` : `'{}'::${type}[]`);
const num = (n) => (n == null ? 'null' : String(n));
// Same as public.normalize_ar in SQL (tashkeel, tatweel, alef forms, yaa, taa marbuta, lowercase, spaces).
const normAr = (s) =>
  (s ?? '')
    .replace(/[ً-ٰٟـ]/g, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim();
// English key for the dedupe rule: lowercase, punctuation to spaces, crude plural strip (pads = pad).
const normEn = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');

const groups = [...cat.aliasGroups, ...EXTRA_ALIAS_GROUPS].map((g) => ({ key: ` ${normEn(g.en)} `, ar: g.ar, arN: g.ar.map(normAr) }));
function withAliases(en, ar, own = []) {
  const e = ` ${normEn(en)} `, a = normAr(ar);
  const out = [...own];
  for (const g of groups) if (e.includes(g.key) || g.arN.includes(a)) out.push(...g.ar);
  const seen = new Set([a]);
  return out.filter((x) => { const n = normAr(x); return !seen.has(n) && seen.add(n); });
}
const fuelOf = (flags) => { const f = ['diesel', 'hybrid', 'ev'].filter((x) => flags.includes(x)); return f.length ? f : null; };

// ─── catalog_items: tree parts first ───
const items = []; // { id, system, subsystem, subsystem_ar, group, group_ar, en, ar, aliases, fuel, flags, type }
const byKey = new Map(); // `${system}|${normEn}` -> first item (tree first, then catalog-only)
for (const sy of tree.systems)
  for (const ss of sy.subsystems)
    for (const gr of ss.groups)
      for (const p of gr.parts) {
        const it = {
          id: md5uuid(`tree|${ss.code}|${gr.en}|${p.en}`), system: sy.no, subsystem: ss.en, subsystem_ar: ss.ar,
          group: gr.en, group_ar: gr.ar, en: p.en, ar: p.ar, aliases: withAliases(p.en, p.ar),
          fuel: fuelOf([...gr.flags, ...p.flags]), flags: p.flags.includes('check_catalog') ? ['check_catalog'] : [], type: 'part',
        };
        items.push(it);
        const k = `${it.system}|${normEn(it.en)}`;
        if (!byKey.has(k)) byKey.set(k, it);
      }
const treeCount = items.length;

// ─── catalog suggested items, deduped against the tree (same normalised English name in the same system) ───
const merged = []; // report rows
const mergedSeen = new Set();
const addAlias = (it, ar) => { if (normAr(ar) !== normAr(it.ar) && !it.aliases.some((x) => normAr(x) === normAr(ar))) it.aliases.push(ar); };
const jobs = [];
let sort = 0;
cat.specialists.forEach((s) => s.categories.forEach((c) => c.jobs.forEach((j) => {
  if (!(c.en in CATEGORY_SYSTEM)) throw new Error(`no system for category ${c.en}`);
  const system = j.en in JOB_SYSTEM ? JOB_SYSTEM[j.en] : CATEGORY_SYSTEM[c.en];
  const suggested = [];
  for (const i of j.items) {
    const k = `${system}|${normEn(i.en)}`;
    let it = byKey.get(k);
    if (!it) {
      it = {
        id: md5uuid(`catalog|${k}`), system, subsystem: null, subsystem_ar: null, group: null, group_ar: null,
        en: i.en, ar: i.ar, aliases: withAliases(i.en, i.ar, i.aliases), fuel: null, flags: [], type: i.type, fromCatalog: true,
      };
      items.push(it);
      byKey.set(k, it);
    } else {
      addAlias(it, i.ar);
      for (const a of i.aliases) addAlias(it, a);
      if (!it.fromCatalog) {
        if (it.type === 'part' && i.type !== 'part') it.type = i.type; // the catalog knows consumables / services; the tree does not
        const rk = `${it.id}|${i.en}|${i.ar}`;
        if (!mergedSeen.has(rk)) { mergedSeen.add(rk); merged.push({ system, catalogEn: i.en, catalogAr: i.ar, treeEn: it.en, treeAr: it.ar, where: `${it.subsystem} > ${it.group}` }); }
      }
    }
    if (!suggested.includes(it.id)) suggested.push(it.id);
  }
  jobs.push({
    id: md5uuid(`job|${j.en}`), specialist: s.key, category_en: c.en, category_ar: c.ar, system, en: j.en, ar: j.ar,
    aliases: withAliases(j.en, j.ar, j.aliases), tracked: j.tracked, km: j.intervalKm, months: j.intervalMonths,
    fuel: j.fuel ?? null, suggested, sort: ++sort,
  });
})));
const catalogOnly = items.length - treeCount;

// ─── quick-add consumables: flag an existing row with the same English name, else add one with no system ───
const quick = [];
for (const c of cat.quickAddConsumables) {
  const n = normEn(c.en);
  let it = items.find((x) => x.fromCatalog && normEn(x.en) === n) ?? items.find((x) => normEn(x.en) === n);
  if (it) { addAlias(it, c.ar); quick.push({ en: c.en, into: `${it.en} (system ${it.system ?? '-'})` }); }
  else {
    it = { id: md5uuid(`quick|${n}`), system: null, subsystem: null, subsystem_ar: null, group: null, group_ar: null, en: c.en, ar: c.ar, aliases: withAliases(c.en, c.ar), fuel: null, flags: [], type: 'consumable', fromCatalog: true };
    items.push(it);
  }
  if (!it.flags.includes('quick_add')) it.flags.push('quick_add');
}

// ─── SQL ───
const HEAD = '-- Generated by scripts/v2-seed.mjs from supabase/seed-data/*.json. Do not edit by hand; re-run the script.\n';
const file = (name, body) => writeFileSync(`${MIG}${name}`, HEAD + body);

file('20261121090100_v2_seed_reference.sql',
  `insert into public.systems (id, name_en, name_ar, health_weight, sort) values\n` +
  tree.systems.map((s) => `  (${s.no}, ${lit(s.en)}, ${lit(s.ar)}, ${HEALTH_WEIGHT[s.no] ?? 1}, ${s.no})`).join(',\n') +
  `\non conflict (id) do nothing;\n\n` +
  `insert into public.specialists (key, name_en, name_ar, shows_all_jobs, sort) values\n` +
  cat.specialists.map((s, i) => `  (${lit(s.key)}, ${lit(s.en)}, ${lit(s.ar)}, ${s.showsAllJobs ? 'true' : 'false'}, ${i + 1})`).join(',\n') +
  `\non conflict (key) do nothing;\n`);

const CHUNK = 700;
const chunks = [];
for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));
chunks.forEach((ch, i) => file(`2026112109020${i}_v2_seed_catalog_${i + 1}.sql`,
  `insert into public.catalog_items (id, system_id, subsystem, subsystem_ar, group_name, group_ar, name_en, name_ar, aliases, fuel_types, flags, item_type) values\n` +
  ch.map((it) => `  (${lit(it.id)}, ${num(it.system)}, ${lit(it.subsystem)}, ${lit(it.subsystem_ar)}, ${lit(it.group)}, ${lit(it.group_ar)}, ${lit(it.en)}, ${lit(it.ar)}, ${arr(it.aliases)}, ${arr(it.fuel)}, ${arr(it.flags)}, ${lit(it.type)})`).join(',\n') +
  `\non conflict (id) do nothing;\n`));

file('20261121090300_v2_seed_job_types.sql',
  `insert into public.job_types (id, specialist_key, category_en, category_ar, system_id, name_en, name_ar, aliases, tracked, default_interval_km, default_interval_months, fuel_types, suggested_items, sort) values\n` +
  jobs.map((j) => `  (${lit(j.id)}, ${lit(j.specialist)}, ${lit(j.category_en)}, ${lit(j.category_ar)}, ${num(j.system)}, ${lit(j.en)}, ${lit(j.ar)}, ${arr(j.aliases)}, ${j.tracked}, ${num(j.km)}, ${num(j.months)}, ${arr(j.fuel)}, ${arr(j.suggested, 'uuid')}, ${j.sort})`).join(',\n') +
  `\non conflict (id) do nothing;\n`);

// ─── report ───
const counts = { systems: tree.systems.length, specialists: cat.specialists.length, job_types: jobs.length, catalog_items: items.length, tree: treeCount, catalogOnly, quickOnly: items.length - treeCount - catalogOnly };
writeFileSync(`${SEED}dedupe-report.md`, `# Tree vs specialist catalog: dedupe report
Generated by \`scripts/v2-seed.mjs\`. Rule: a specialist-catalog suggested item with the same normalised English name
(lowercase, punctuation removed, simple plural "s" dropped) as a tree part **in the same system** becomes that tree row;
the catalog's Arabic name is kept as an alias, and the catalog's item type (consumable / service) wins over the tree's default "part".
Quick-add consumables flag an existing row with the same English name (any system) instead of adding a new one.

## Counts
| | rows |
|---|---|
| systems | ${counts.systems} |
| specialists | ${counts.specialists} |
| job types | ${counts.job_types} |
| catalog items (total) | ${counts.catalog_items} |
| from the tree | ${counts.tree} |
| catalog-only suggested items | ${counts.catalogOnly} |
| quick-add-only consumables | ${counts.quickOnly} |
| catalog items merged into a tree row | ${merged.length} |

## Merged into a tree row (${merged.length})
| System | Catalog item | Catalog Arabic | Tree part | Tree Arabic | Tree place |
|---|---|---|---|---|---|
${merged.map((m) => `| ${m.system} | ${m.catalogEn} | ${m.catalogAr} | ${m.treeEn} | ${m.treeAr} | ${m.where} |`).join('\n')}

## Quick-add consumables matched to an existing row (${quick.length})
${quick.map((q) => `- ${q.en} -> ${q.into}`).join('\n')}
`);
console.log(counts, 'merged', merged.length, 'quick matched', quick.length, 'catalog chunks', chunks.length);
