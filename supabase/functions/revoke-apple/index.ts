// Account deletion on an Apple-signed-in iPhone: exchanges the one-time code from "Sign in with Apple" for a token
// and revokes it, so Apple no longer lists Bestim for that person (App Store guideline 5.1.1(v)).
// Secrets (supabase secrets set …): APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (the .p8 file's text). Never in git.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5';

const CLIENT_ID = 'com.bestim.app';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser(auth.replace(/^Bearer /i, ''));
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code) return json({ error: 'bad_request' }, 400);

  const key = Deno.env.get('APPLE_PRIVATE_KEY');
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  if (!key || !teamId || !keyId) return json({ error: 'not_configured' }, 500);

  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId).setSubject(CLIENT_ID).setAudience('https://appleid.apple.com')
    .setIssuedAt().setExpirationTime('5m')
    .sign(await importPKCS8(key.replace(/\\n/g, '\n'), 'ES256'));

  const form = (o: Record<string, string>) => new URLSearchParams({ client_id: CLIENT_ID, client_secret: secret, ...o });
  const token = await fetch('https://appleid.apple.com/auth/token', { method: 'POST', body: form({ code, grant_type: 'authorization_code' }) });
  if (!token.ok) return json({ error: 'apple_token' }, 502);
  const { refresh_token } = await token.json();
  const revoke = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    body: form({ token: refresh_token, token_type_hint: 'refresh_token' }),
  });
  return revoke.ok ? json({ ok: true }) : json({ error: 'apple_revoke' }, 502);
});
