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

export type AuthLinkType = 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change' | null;

/**
 * Email links (confirm sign-up, reset password) reopen the app as bestim://…#access_token=…&refresh_token=…&type=…
 * Restores the session from the URL fragment and returns the link type, or null if the URL isn't an auth link.
 */
export async function sessionFromUrl(url: string): Promise<AuthLinkType> {
  const params = new URLSearchParams(url.split('#')[1] ?? '');
  const error = params.get('error_description');
  if (error) throw new Error(error);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (setError) throw setError;
  return (params.get('type') as AuthLinkType) ?? null;
}
