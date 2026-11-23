import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Admin push (Q147): after the OS allows notifications, the phone's Expo token is stored so the dashboard can reach it.
// Never throws: Expo Go, simulators and builds without push credentials simply have no token.
let mine: string | null = null;

export async function registerPushToken() {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    mine = data;
    await supabase.rpc('register_push_token', { p_token: data, p_platform: Platform.OS });
  } catch {}
}

/** Call BEFORE signing out (needs the session): the next user of this phone must not receive this account's messages. */
export async function forgetPushToken() {
  try {
    if (mine) await supabase.rpc('remove_push_token', { p_token: mine });
  } catch {}
}
