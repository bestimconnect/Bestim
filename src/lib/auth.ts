import { supabase } from './supabase';

// Native Google sign-in → identity token → Supabase session (spec §6). Returns false when the user
// cancels. The module loads lazily so builds without it still start.

export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new Error('Google sign-in is not configured yet');
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return false;
  if (!res.data.idToken) throw new Error('Google returned no identity token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.data.idToken });
  if (error) throw error;
  return true;
}
