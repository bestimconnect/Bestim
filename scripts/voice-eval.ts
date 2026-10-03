// Runs sentences and recordings through the deployed `process-voice-log` function and prints which came out right.
// Use it to compare models: set GEMINI_MODEL with `supabase secrets set` (e.g. gemini-2.5-flash-lite), run, compare.
//
//   VOICE_EVAL_EMAIL=… VOICE_EVAL_PASSWORD=… node --env-file=.env --experimental-strip-types scripts/voice-eval.ts
//
// The account must be a real (non-guest) test account with at least one vehicle. Each case is one call:
// raise VOICE_DAILY_LIMIT on the function for the test, then remove it.
// Recordings: put voice notes (.wav, .m4a, .mp3) in scripts/voice-eval/ and add { "audio": "name.m4a", "expect": […] }
// to voice-eval.cases.json. They are real voices, so that folder is git-ignored.
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

type Expected = Record<string, string | number | null>;
type Case = { say?: string; audio?: string; expect: Expected[] };

const here = import.meta.dirname;
const cases: Case[] = JSON.parse(readFileSync(join(here, 'voice-eval.cases.json'), 'utf8'));
const MIME: Record<string, string> = { '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);
const signIn = await supabase.auth.signInWithPassword({ email: process.env.VOICE_EVAL_EMAIL!, password: process.env.VOICE_EVAL_PASSWORD! });
if (signIn.error) throw signIn.error;
const { data: vehicles } = await supabase.from('vehicles').select('id').order('created_at').limit(1);
if (!vehicles?.length) throw new Error('The test account has no vehicle');

const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
// Every expected record must be matched by a different returned record, on the fields the case names; no extras.
const matches = (got: Expected[], want: Expected[]) => {
  if (got.length !== want.length) return false;
  const left = [...got];
  return want.every((w) => {
    const i = left.findIndex((g) => Object.entries(w).every(([k, v]) => g[k] === (v === '@yesterday' ? yesterday : v)));
    return i >= 0 && left.splice(i, 1);
  });
};

let passed = 0;
for (const c of cases) {
  const body = c.audio
    ? { audio_base64: readFileSync(join(here, 'voice-eval', c.audio)).toString('base64'), mime: MIME[extname(c.audio)] }
    : { transcript: c.say };
  const { data, error } = await supabase.functions.invoke('process-voice-log', { body: { ...body, vehicle_id: vehicles[0].id, lang: 'ar' } });
  const ok = !error && matches(data.records, c.expect);
  if (ok) passed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.audio ?? c.say}`);
  if (!ok) {
    if (c.audio && data) console.log('      heard:   ', data.transcript);
    console.log('      expected:', JSON.stringify(c.expect));
    console.log('      got:     ', error ? `error ${error.context?.status ?? error.message}` : JSON.stringify(data.records.map(
      (r: Expected) => Object.fromEntries(Object.entries(r).filter(([k, v]) => v != null && k !== 'vehicle_id' && !(Array.isArray(v) && !v.length))),
    )));
  }
}
console.log(`\n${passed} of ${cases.length} right`);
