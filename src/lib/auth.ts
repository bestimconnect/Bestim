import { supabase } from './supabase';

// Native sign-in → identity token → Supabase session (spec §6). Both return false when the user
// cancels the native sheet. Modules load lazily so builds without them still start.

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

export async function signInWithApple(): Promise<boolean> {
  const Apple = await import('expo-apple-authentication');
  let credential;
  try {
    credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple returned no identity token');
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw error;
  // Apple shares the name only on the very first sign-in; keep it.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name) await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  return true;
}
