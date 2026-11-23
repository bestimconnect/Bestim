// Run: node --experimental-strip-types src/lib/locales.check.ts
// A label used in the app but missing from a locale file shows up as a raw key ("account.subtitle") on screen.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

const flat = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const arAll = flat(JSON.parse(readFileSync('src/locales/ar.json', 'utf8')));
const enAll = flat(JSON.parse(readFileSync('src/locales/en.json', 'utf8')));
// Plural forms differ per language (Arabic has six): compare the base key, then check each language has the forms it needs.
const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (k: string) => k.replace(PLURAL, '');
const ar = new Set(arAll.map(base));
const en = new Set(enAll.map(base));
const forms = (all: string[]) => {
  const m = new Map<string, Set<string>>();
  for (const k of all) if (PLURAL.test(k)) m.set(base(k), (m.get(base(k)) ?? new Set()).add(k.match(PLURAL)![1]));
  return m;
};
// A missing plural form shows the raw key on screen (Arabic 11–99 needs `many`, 0 needs `zero`).
for (const [lang, need] of [['ar', ['zero', 'one', 'two', 'few', 'many', 'other']], ['en', ['one', 'other']]] as const) {
  const missing = [...forms(lang === 'ar' ? arAll : enAll)].flatMap(([k, have]) => need.filter((f) => !have.has(f)).map((f) => `${k}_${f}`));
  assert.deepEqual(missing, [], `${lang}.json plural forms missing`);
}

assert.deepEqual([...ar].filter((k) => !en.has(k)), [], 'keys missing from en.json');
assert.deepEqual([...en].filter((k) => !ar.has(k)), [], 'keys missing from ar.json');

const source = globSync('src/**/*.{ts,tsx}').filter((f) => !f.endsWith('.check.ts')).map((f) => readFileSync(f, 'utf8')).join('\n');
const has = (prefix: string) => [...ar].some((k) => k === prefix || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}_`));
// t('a.b') and t(cond ? 'a.b' : 'a.c') …
const literal = [...source.matchAll(/'((?:[a-zA-Z][a-zA-Z0-9]*\.)+[a-zA-Z0-9_]+)'/g)].map((m) => m[1]);
const namespaces = new Set([...ar].map((k) => k.split('.')[0]));
assert.deepEqual([...new Set(literal.filter((k) => namespaces.has(k.split('.')[0]) && !has(k)))], [], 'keys used in code but not defined');
// … and t(`a.b.${x}`): the prefix must exist.
const dynamic = [...source.matchAll(/\bt\(\s*`((?:[a-zA-Z0-9_]+\.)+)\$\{/g)].map((m) => m[1].slice(0, -1));
assert.deepEqual([...new Set(dynamic.filter((p) => !has(p)))], [], 'dynamic key prefixes not defined');

console.log('locales ok');
