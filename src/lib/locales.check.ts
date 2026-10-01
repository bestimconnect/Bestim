// Run: node --experimental-strip-types src/lib/locales.check.ts
// A label used in the app but missing from a locale file shows up as a raw key ("account.subtitle") on screen.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

const flat = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const ar = new Set(flat(JSON.parse(readFileSync('src/locales/ar.json', 'utf8'))));
const en = new Set(flat(JSON.parse(readFileSync('src/locales/en.json', 'utf8'))));

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
