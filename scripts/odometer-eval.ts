// Runs dashboard photos through the odometer AI backup (the very code of supabase/functions/read-odometer/read.ts)
// at each thinking level, and prints how many it read right and how long it took. It runs on this computer: no test
// account, no deployed function.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings scripts/odometer-eval.ts
//
// Keys in .env.local (never committed): GEMINI_API_KEY; optionally GEMINI_MODEL, and ODOMETER_LEVELS (default "low,medium").
// Photos: JPEGs in scripts/odometer-eval/ (git-ignored: they are real dashboards), named after the correct reading:
// "123456.jpg", or "123456-night.jpg" for a second photo of the same number; "none-….jpg" when no odometer is readable.
// For speeds like the app's, use stills like the ones it sends: about 960 px wide, cropped around the odometer.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_MODEL, readOdometer } from '../supabase/functions/read-odometer/read.ts';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log('GEMINI_API_KEY is not set (put it in .env.local).');
  process.exit(1);
}
const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const levels = (process.env.ODOMETER_LEVELS || 'low,medium').split(',').map((l) => l.trim()) as ('minimal' | 'low' | 'medium' | 'high')[];
const dir = join(import.meta.dirname, 'odometer-eval');
const photos = existsSync(dir) ? readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort() : [];
if (!photos.length) {
  console.log(`No photos in ${dir}. Add JPEGs named after their reading, e.g. 123456.jpg.`);
  process.exit(1);
}

const expected = (name: string) => (name.startsWith('none') ? null : Number(name.match(/^\d+/)?.[0] ?? NaN));
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

console.log(`${photos.length} photos · ${model}\n`);
for (const level of levels) {
  const times: number[] = [];
  const wrong: string[] = [];
  for (const photo of photos) {
    const image = readFileSync(join(dir, photo)).toString('base64');
    const started = Date.now();
    try {
      const got = await readOdometer(image, key, model, level);
      times.push(Date.now() - started);
      if (got !== expected(photo)) wrong.push(`${photo} → ${got ?? 'nothing'}`);
    } catch (e) {
      times.push(Date.now() - started);
      wrong.push(`${photo} → error: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }
  console.log(`thinking ${level}: ${photos.length - wrong.length}/${photos.length} right · typical ${s(median(times))} · slowest ${s(Math.max(...times))}`);
  wrong.forEach((w) => console.log(`  ✗ ${w}`));
}
