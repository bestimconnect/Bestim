import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

const storageKey = `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;

/**
 * Offline, an expired access token can't be refreshed, so getSession() says null even though the login is still
 * saved. Supabase only deletes the saved login when the server rejects it, so a saved one means "still signed in".
 */
async function load(): Promise<Session | null> {
  // Offline, getSession() keeps retrying the refresh for many seconds (splash stuck), so give it 1.5 s.
  const wait = new Promise<null>((done) => setTimeout(() => done(null), 1500));
  const session = await Promise.race([supabase.auth.getSession().then(({ data }) => data.session), wait]);
  if (session) return session;
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(storageKey)) ?? 'null') as Session | null;
    return saved?.user && saved.refresh_token ? saved : null;
  } catch {
    return null;
  }
}

/** undefined = still loading, null = signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => load().then(setSession);
    refresh();
    // Back online: get the real (refreshed) session instead of the saved one.
    const offOnline = onlineManager.subscribe((online) => online && refresh());
    const { data } = supabase.auth.onAuthStateChange((e, s) =>
      // offline, supabase reports "no session" at start-up because it could not refresh: keep the saved login
      setSession((prev) => (e === 'INITIAL_SESSION' && !s && !onlineManager.isOnline() ? prev : s)),
    );
    return () => {
      offOnline();
      data.subscription.unsubscribe();
    };
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
