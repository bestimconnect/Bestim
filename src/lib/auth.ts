import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Native Google sign-in → identity token → Supabase session (spec §6). Returns false when the user
// cancels. The module loads lazily so builds without it still start.

/** False on Android phones without Google services (Huawei): the Google button is hidden there (Q76). */
export function useGoogleAvailable() {
  const [available, setAvailable] = useState(Platform.OS !== 'android');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    import('@react-native-google-signin/google-signin')
      .then(({ GoogleSignin }) => GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }))
      .then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}

export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new Error('Google sign-in is not configured yet');
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signOut().catch(() => {}); // forget the last account so Google asks which one, every time
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return false;
  if (!res.data.idToken) throw new Error('Google returned no identity token');
  const credentials = { provider: 'google', token: res.data.idToken } as const;
  // A guest (anonymous account, decisions Q17) links Google to the same user, so their vehicles stay.
  const { data } = await supabase.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity(credentials);
    // This Google account already has a Bestim account: sign into it (the guest's trial car is left behind).
    if (error) {
      const { error: signInError } = await supabase.auth.signInWithIdToken(credentials);
      if (signInError) throw signInError;
      return true;
    }
    if (res.data.user.name)
      await supabase.from('profiles').update({ full_name: res.data.user.name }).eq('id', data.user.id);
    return true;
  }
  const { error } = await supabase.auth.signInWithIdToken(credentials);
  if (error) throw error;
  return true;
}

/** Apple's button shows on iPhones only (Q6: App Store guideline 4.8 wants it next to Google). False in the free-Apple-ID test build. */
export function useAppleAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    import('expo-apple-authentication')
      .then((Apple) => Apple.isAvailableAsync())
      .then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}

export async function signInWithApple(): Promise<boolean> {
  const Apple = await import('expo-apple-authentication');
  let credential;
  try {
    credential = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL] });
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

/** Sign out; the cache empties itself when the user changes (queryClient.ts). Language, theme and the tour flag stay. */
export async function signOut() {
  const { syncNotifications } = await import('./notifications');
  const { useSettings } = await import('@/stores/settingsStore');
  await supabase.auth.signOut();
  import('@react-native-google-signin/google-signin').then(({ GoogleSignin }) => GoogleSignin.signOut()).catch(() => {});
  useSettings.getState().setCurrentVehicle(null);
  useSettings.getState().set({ pendingShareToken: null });
  syncNotifications(); // no user → cancels every scheduled reminder
  const { useVoiceQueue } = await import('@/stores/voiceQueue');
  const { dropVoice } = await import('./voiceSend');
  useVoiceQueue.getState().items.forEach((i) => dropVoice(i.id)); // recordings belong to the account that made them
}
