// Runs the same sentences and recordings through both AI services (Gemini and OpenAI) and prints, side by side,
// how many each got right and how long each took. It runs on this computer: no test account, no deployed function.
// It uses the very code the Edge Function uses (supabase/functions/process-voice-log/understand.ts) with one sample car.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings scripts/voice-eval.ts
//
// Keys in .env.local (never committed): GEMINI_API_KEY, OPENAI_API_KEY; optionally GEMINI_MODEL / OPENAI_MODEL to try
// another model. A service whose key is missing is skipped.
// Recordings: put the voice notes of docs/voice-test-sentences.md (01.m4a …; .wav and .mp3 also work) in
// scripts/voice-eval/. They are real voices, so that folder is git-ignored. A recording that is not there yet is skipped.
// An audio case may also carry "phone": what the phone's own speech recognition wrote for that recording. Those are
// run as text too ("phone text" rows), to see how far the phone's text alone would get.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, parse } from 'node:path';

import { gemini, GEMINI_MODEL, instructions, openai, OPENAI_MODEL, type Said, type Vehicle } from '../supabase/functions/process-voice-log/understand.ts';

type Expected = Record<string, string | number | null>;
type Case = { say?: string; audio?: string; phone?: string; expect: Expected[] };

const here = import.meta.dirname;
const cases: Case[] = JSON.parse(readFileSync(join(here, 'voice-eval.cases.json'), 'utf8'));
const MIME: Record<string, string> = { '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };
const files = existsSync(join(here, 'voice-eval')) ? readdirSync(join(here, 'voice-eval')) : [];
const fileOf = (name: string) => files.find((f) => parse(f).name === parse(name).name && MIME[extname(f).toLowerCase()]);

const CAR: Vehicle = { id: 'car-1', make: 'Toyota', model: 'Corolla', year: 2020, nickname: null, vehicle_type: 'sedan', odometer_unit: 'km', current_odometer: 60000 };
// The active services, as the catalog sheet lists them (what the database serves once it is filled from it).
const SERVICES = readFileSync(join(here, '../supabase/record-catalog.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((line) => line.split(','))
  .filter((c) => c[6] === 'maintenance')
  .map((c) => c[4]);
const system = instructions([CAR], SERVICES, CAR.id, 'ar');

const env = process.env;
const services = [
  { name: `gemini (${env.GEMINI_MODEL || GEMINI_MODEL})`, key: 'GEMINI_API_KEY', ask: (s: Said) => gemini(s, system, env.GEMINI_API_KEY!, env.GEMINI_MODEL || undefined) },
  { name: `openai (${env.OPENAI_MODEL || OPENAI_MODEL})`, key: 'OPENAI_API_KEY', ask: (s: Said) => openai(s, system, env.OPENAI_API_KEY!, env.OPENAI_MODEL || undefined) },
].filter((s) => env[s.key] || console.log(`${s.key} is not set: skipping ${s.name}`));

const day = (ago: number) => new Date(Date.now() - ago * 864e5).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
const DATES: Record<string, string> = { '@today': day(0), '@yesterday': day(1) };
// Every expected record must be matched by a different returned record, on the fields the case names; no extras.
// "@any" = the field must be filled, whatever it says (a note's wording is the model's own).
const matches = (got: Expected[], want: Expected[]) => {
  if (got.length !== want.length) return false;
  const left = [...got];
  return want.every((w) => {
    const i = left.findIndex((g) => Object.entries(w).every(([k, v]) => (v === '@any' ? !!g[k] : g[k] === (DATES[v as string] ?? v))));
    return i >= 0 && left.splice(i, 1);
  });
};

const ready = cases.filter((c) => !c.audio || fileOf(c.audio));
const phone = cases.filter((c) => c.audio && c.phone).map((c) => ({ say: c.phone, expect: c.expect }));

async function run(name: string, ask: (s: Said) => Promise<{ transcript?: string; records?: unknown[] }>, list: Case[]) {
  const times: number[] = [];
  const failed: string[] = [];
  for (const c of list) {
    const said: Said = c.audio
      ? { audio: readFileSync(join(here, 'voice-eval', fileOf(c.audio)!)).toString('base64'), mime: MIME[extname(fileOf(c.audio)!).toLowerCase()] }
      : { text: c.say! };
    const t0 = Date.now();
    const out = await ask(said).catch((e: Error) => e);
    times.push(Date.now() - t0);
    const records = (out instanceof Error ? [] : out.records ?? []) as Expected[];
    if (!(out instanceof Error) && matches(records, c.expect)) continue;
    failed.push(
      `FAIL  ${c.audio ?? c.say}` +
      (c.audio && !(out instanceof Error) ? `\n      heard:    ${out.transcript}` : '') +
      `\n      expected: ${JSON.stringify(c.expect)}` +
      `\n      got:      ${out instanceof Error ? `error: ${out.message}` : JSON.stringify(records.map(
        (r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => v != null && k !== 'vehicle_id' && !(Array.isArray(v) && !v.length))),
      ))}`,
    );
  }
  times.sort((a, b) => a - b);
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  return {
    row: { service: name, correct: `${list.length - failed.length} of ${list.length}`, typical: seconds(times[times.length >> 1] ?? 0), slowest: seconds(times.at(-1) ?? 0) },
    failed,
  };
}

// The two services at once (they don't share anything), each going through its cases one by one so the times are honest.
const results = await Promise.all(services.map(async (s) => [
  await run(s.name, s.ask, ready),
  ...(phone.length ? [await run(`${s.name}, phone text`, s.ask, phone)] : []),
]));
const all = results.flat();
if (all.length) console.table(all.map((r) => r.row));
for (const r of all) if (r.failed.length) console.log(`\n${r.row.service}\n${r.failed.join('\n')}`);
const skipped = cases.length - ready.length;
if (skipped) console.log(`\n${skipped} recordings are not in scripts/voice-eval/ yet: skipped.`);
