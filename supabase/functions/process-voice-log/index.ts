// Turns what a user said (the recording, or its text) into a list of records for the review screen
// (capture/review-all). The app saves nothing until the user confirms, and every save goes through RLS,
// so this function only reads the user's data and returns suggestions.
//
// The understanding itself (the instructions and the two AI services) lives in understand.ts.
// Secrets (supabase secrets set …): VOICE_PROVIDER picks the service, `gemini` (default) or `openai`;
// GEMINI_API_KEY / OPENAI_API_KEY; optionally GEMINI_MODEL / OPENAI_MODEL to switch models, and
// VOICE_DAILY_LIMIT to change the daily limit.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { AUDIO_MIME, gemini, instructions, openai, OPENAI_FILE, type Said } from './understand.ts';

const OPENAI = Deno.env.get('VOICE_PROVIDER') === 'openai';
const DAILY_LIMIT = Number(Deno.env.get('VOICE_DAILY_LIMIT')) || 30; // recordings per user per day (Cairo time); a bad value must never mean "no limit"
const MAX_AUDIO_B64 = 4_000_000; // ≈3 MB of audio: about 90 s of 16 kHz mono WAV
const MAX_TRANSCRIPT = 2000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_AUDIO_B64 + 10_000) return json({ error: 'too_large' }, 413);

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  // Everything that does not depend on anything else, at once: who is asking, what they sent, their cars, our service names.
  // The reads use the user's own token, so RLS decides what they may see.
  const [{ data: { user } }, body, vehicles, services] = await Promise.all([
    supabase.auth.getUser(auth.replace(/^Bearer /i, '')),
    req.json().catch(() => null),
    supabase.from('vehicles').select('id, user_id, make, model, year, nickname, vehicle_type, odometer_unit, current_odometer'),
    supabase.from('service_types').select('name_en').not('category_id', 'is', null), // retired services are not offered
  ]);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (user.is_anonymous) return json({ error: 'guest' }, 403); // guests could mint accounts to dodge the daily limit

  const audio = typeof body?.audio_base64 === 'string' ? body.audio_base64 : '';
  const typed = typeof body?.transcript === 'string' ? body.transcript.trim().slice(0, MAX_TRANSCRIPT) : '';
  const vehicleId = typeof body?.vehicle_id === 'string' ? body.vehicle_id : '';
  if (!vehicleId || (!audio && !typed)) return json({ error: 'bad_request' }, 400);
  if (audio.length > MAX_AUDIO_B64) return json({ error: 'too_large' }, 413);
  if (audio && !Object.hasOwn(AUDIO_MIME, body.mime)) return json({ error: 'bad_request' }, 400);

  if (vehicles.error || services.error) return json({ error: 'server' }, 500);
  const own = vehicles.data.filter((v) => v.user_id === user.id); // own cars only (not ones shared with them)
  if (!own.some((v) => v.id === vehicleId)) return json({ error: 'bad_request' }, 400);

  // Count before spending: a failed AI call still counts, so retries can't be used to hammer the API.
  const used = await supabase.rpc('bump_voice_usage');
  if (used.error) return json({ error: 'server' }, 500);
  if (used.data > DAILY_LIMIT) return json({ error: 'limit' }, 429);

  // The phone's own text is the fallback when there is no recording (simulator, older Android).
  const said: Said = audio ? { audio, mime: body.mime } : { text: typed };
  // OpenAI cannot read the raw AAC some Android phones record (understand.ts), so those recordings go to Gemini.
  const useOpenai = OPENAI && (!audio || Object.hasOwn(OPENAI_FILE, body.mime));
  const t1 = Date.now();
  try {
    const system = instructions(own, services.data.map((s) => s.name_en), vehicleId, body.lang === 'en' ? 'en' : 'ar');
    const out = useOpenai
      ? await openai(said, system, Deno.env.get('OPENAI_API_KEY')!, Deno.env.get('OPENAI_MODEL') || undefined)
      : await gemini(said, system, Deno.env.get('GEMINI_API_KEY')!, Deno.env.get('GEMINI_MODEL') || undefined);
    return json({
      transcript: String(out.transcript ?? typed).slice(0, MAX_TRANSCRIPT),
      records: out.records ?? [],
      ms: { prep: t1 - t0, ai: Date.now() - t1 }, // where the wait went: our own checks, then the AI service
    });
  } catch (e) {
    console.error('voice', e instanceof Error ? e.message : e);
    return json({ error: 'ai' }, 502);
  }
});
