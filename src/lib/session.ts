import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/** undefined = still loading, null = signed out (guest). */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/**
 * Email links (confirm sign-up, reset password) reopen the app as bestim://…?code=…
 * The code is worth nothing without the secret this phone saved when it asked for the email, so a link someone
 * else crafted (or intercepted) can't sign anyone in. Tokens in a link are never accepted.
 * Returns 'recovery' for a reset-password link, or null if the URL isn't an auth link.
 */
export async function sessionFromUrl(url: string): Promise<string | null> {
  // Supabase puts the code in the query and (for a failed link) the error in the query or the fragment.
  const params = new URLSearchParams(url.replace(/^[^?#]*[?#]?/, '').replace('#', '&'));
  const error = params.get('error_description') ?? params.get('error');
  if (error) throw new Error(error);
  const code = params.get('code');
  if (!code) return null;
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  // The library returns the link's kind here ('recovery' for a reset link) but leaves it out of its types.
  return (data as { redirectType?: string | null }).redirectType ?? null;
}
