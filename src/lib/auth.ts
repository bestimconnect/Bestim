import { supabase } from './supabase';

// Native Google sign-in → identity token → Supabase session (spec §6). Returns false when the user
// cancels. The module loads lazily so builds without it still start.

export async function continueAsGuest() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new Error('Google sign-in is not configured yet');
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return false;
  if (!res.data.idToken) throw new Error('Google returned no identity token');
  const credentials = { provider: 'google', token: res.data.idToken } as const;
  // A guest (anonymous account, decisions Q17) links Google to the same user, so their vehicles stay.
  const { data } = await supabase.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity(credentials);
    if (error) throw error;
    if (res.data.user.name)
      await supabase.from('profiles').update({ full_name: res.data.user.name }).eq('id', data.user.id);
    return true;
  }
  const { error } = await supabase.auth.signInWithIdToken(credentials);
  if (error) throw error;
  return true;
}

/** Sign out and drop everything cached for this user (Q33/Q48). Language, theme and the tour flag stay. */
export async function signOut() {
  const { queryClient } = await import('./queryClient');
  const { syncNotifications } = await import('./notifications');
  const { useSettings } = await import('@/stores/settingsStore');
  await supabase.auth.signOut();
  queryClient.clear();
  useSettings.getState().setCurrentVehicle(null);
  useSettings.getState().set({ pendingShareToken: null });
  syncNotifications(); // no user → cancels every scheduled reminder
}
