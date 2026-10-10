// Reads the odometer from a still of the dashboard, for the displays the phone's own reader cannot read
// (digital segment digits). The scanner (src/components/OdometerScanner.tsx) asks only after the phone has
// failed, and the owner confirms the number before anything is saved: this function only returns a suggestion.
//
// One Gemini call (read.ts, shared with scripts/odometer-eval.ts), same endpoint and key as process-voice-log.
// Secrets (supabase secrets set …): GEMINI_API_KEY; optionally GEMINI_MODEL to switch models, and
// SCAN_DAILY_LIMIT to change the limit.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { DEFAULT_MODEL, readOdometer } from './read.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL;
const DAILY_LIMIT = Number(Deno.env.get('SCAN_DAILY_LIMIT')) || 20; // AI reads per user per day (Cairo time); a bad value must never mean "no limit"
const MAX_IMAGE_B64 = 600_000; // ≈450 KB of JPEG; the app sends a cropped still far under 300 KB

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_B64 + 10_000) return json({ error: 'too_large' }, 413);

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser(auth.replace(/^Bearer /i, ''));
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (user.is_anonymous) return json({ error: 'guest' }, 403); // guests could mint accounts to dodge the daily limit

  const body = await req.json().catch(() => null);
  const image = typeof body?.image_base64 === 'string' ? body.image_base64 : '';
  if (image.length > MAX_IMAGE_B64) return json({ error: 'too_large' }, 413);
  if (!image.startsWith('/9j/')) return json({ error: 'bad_request' }, 400); // a JPEG, in base64

  // Count before spending: a failed AI call still counts, so retries can't be used to hammer the API.
  const used = await supabase.rpc('bump_scan_usage');
  if (used.error) return json({ error: 'server' }, 500);
  if (used.data > DAILY_LIMIT) return json({ error: 'limit' }, 429);

  try {
    const started = Date.now();
    const reading = await readOdometer(image, Deno.env.get('GEMINI_API_KEY')!, MODEL);
    return json({ reading, ms: { ai: Date.now() - started } }); // the app logs it in development (speed checks)
  } catch (e) {
    console.error('gemini', e instanceof Error ? e.message : e);
    return json({ error: 'ai' }, 502);
  }
});
