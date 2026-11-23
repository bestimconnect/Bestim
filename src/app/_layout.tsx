import '@/global.css';

import { Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { useURL } from 'expo-linking';
import { useLastNotificationResponse } from 'expo-notifications';
import { type ErrorBoundaryProps, router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { KeyboardDone } from '@/components/KeyboardDone';
import { SplashOverlay } from '@/components/SplashOverlay';
import { Toast } from '@/components/Toast';
import { Button, Text } from '@/components/ui';
import { applyLanguage } from '@/lib/i18n';
import { initMonitoring, reportError, wrapRoot } from '@/lib/monitoring';
import { openedFromNotification, syncNotifications } from '@/lib/notifications';
import { useOnline } from '@/lib/online';
import { DAY, dehydrateOptions, persister, queryClient } from '@/lib/queryClient';
import { sessionFromUrl, useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries';
import { palette } from '@/lib/palette';
import { themeVars, useScheme } from '@/lib/theme';
import { processVoiceQueue } from '@/lib/voiceSend';
import { useSettings } from '@/stores/settingsStore';

SplashScreen.preventAutoHideAsync();
initMonitoring();

/** Shown instead of a blank screen when a screen crashes (Q81). expo-router picks this export up by name. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const scheme = useScheme();
  useEffect(() => {
    SplashScreen.hideAsync();
    reportError(error, 'screen crash');
  }, [error]);
  return (
    <View className="flex-1 justify-center gap-4 bg-paper p-6" style={themeVars[scheme]}>
      <Text variant="title">{t('errorScreen.title')}</Text>
      <Text className="text-muted">{t('errorScreen.body')}</Text>
      <Button title={t('errorScreen.retry')} onPress={retry} />
    </View>
  );
}

export default wrapRoot(function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * DAY, dehydrateOptions }}
      onSuccess={() => queryClient.resumePausedMutations()}>
      <App />
    </PersistQueryClientProvider>
  );
});

function App() {
  const scheme = useScheme();
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_700Bold });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const language = useSettings((s) => s.language);
  const pendingShareToken = useSettings((s) => s.pendingShareToken);
  const session = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const [splashDone, setSplashDone] = useState(false); // lives here, not in the overlay: the tree unmounts while a new sign-in loads
  const oldGuest = useRef<string | null>(null); // the guest sent to /register already, so a refetch doesn't pull them back from /login
  const endSplash = useCallback(() => setSplashDone(true), []);
  const online = useOnline();
  // Offline the profile query is paused, not failed: don't make the splash wait for it (Home shows its offline state).
  const ready = fontsLoaded && hydrated && session !== undefined && (!userId || !profile.isPending || !online);

  useEffect(() => useSettings.persist.onFinishHydration(() => setHydrated(true)), []);

  // Email links (confirm sign-up / reset password). Sign-up needs nothing more: the gate below routes new users to car setup.
  const url = useURL();
  const handledUrl = useRef<string | null>(null); // a code works once; `ready` flips again right after it signs the user in
  useEffect(() => {
    if (!ready || !url || handledUrl.current === url || !/[?&#](code|error)=/.test(url)) return;
    handledUrl.current = url;
    sessionFromUrl(url)
      .then((type) => type === 'recovery' && router.replace('/reset-password'))
      .catch(() => router.replace({ pathname: '/login', params: { notice: 'linkExpired' } }));
  }, [ready, url]);
  // A share link opened while signed out waits here until there's a full account (Q44; an old guest session counts as signed out).
  const shareToken = url?.match(/receive\?token=([\w-]+)/)?.[1];
  const fullAccount = !!userId && !session?.user.is_anonymous;
  useEffect(() => {
    if (ready && shareToken && !fullAccount) useSettings.getState().set({ pendingShareToken: shareToken });
  }, [ready, shareToken, fullAccount]);
  useEffect(() => {
    if (!ready || !fullAccount || !pendingShareToken || !profile.data?.onboarding_completed) return;
    useSettings.getState().set({ pendingShareToken: null });
    router.push({ pathname: '/receive', params: { token: pendingShareToken } });
  }, [ready, fullAccount, pendingShareToken, profile.data?.onboarding_completed]);

  // Reminders: schedule once the user is known; a tapped notification opens its screen (Q37).
  useEffect(() => {
    if (ready && userId) syncNotifications();
  }, [ready, userId]);
  // Q93: recordings made offline are written up when the connection is back, and whenever the app comes back.
  useEffect(() => {
    if (!ready || !fullAccount) return;
    processVoiceQueue();
    const offOnline = onlineManager.subscribe((online) => online && processVoiceQueue());
    const app = AppState.addEventListener('change', (s) => s === 'active' && processVoiceQueue());
    return () => {
      offOnline();
      app.remove();
    };
  }, [ready, fullAccount]);
  // A tapped system notification (also one that opened the app from closed) is marked read and opens its screen, like a row in the list.
  const tapped = useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !userId || !tapped) return;
    openedFromNotification(tapped).then((url) => url && router.push(url as never));
  }, [ready, userId, tapped]);

  useEffect(() => {
    if (!ready) return;
    // No language chosen yet: take the phone's (Arabic unless it is English). Saving it re-runs this effect, which applies it once;
    // after a right-to-left reload the saved language matches the layout, so nothing reloads again.
    if (!language) useSettings.getState().setLanguage(getLocales()[0]?.languageCode === 'en' ? 'en' : 'ar');
    else {
      applyLanguage(language);
      // Flow: welcome (intro) → sign up / sign in → name (if empty) → add car (odometer included) → home. No guest mode.
      // An old guest (anonymous account, Q17) is sent once to Create account, which upgrades them in place; Sign in stays reachable.
      if (!userId) router.replace('/intro');
      else if (session?.user.is_anonymous) {
        if (oldGuest.current !== userId) router.replace('/register');
        oldGuest.current = userId;
      } else if (profile.data?.deleted_at) router.replace('/restore-account'); // soft-deleted account: offer restore (flow 13 #7)
      else if (profile.data && !profile.data.full_name.trim()) router.replace('/profile-setup'); // Q7
      else if (profile.data && !profile.data.onboarding_completed) router.replace('/add-vehicle');
    }
  }, [ready, language, userId, profile.data, session?.user.is_anonymous]);

  if (!ready) return null;
  // Bottom sheets: the say-it / type-it chooser (13), the confirm sheet (Q55), switch vehicle (Q56) and the upgrade sheet (Q121).
  const sheetOptions: ComponentProps<typeof Stack.Screen>['options'] = {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetCornerRadius: 32,
    contentStyle: [themeVars[scheme], { backgroundColor: palette[scheme].sheet }],
  };
  return (
    // Gestures (the odometer ruler) need this root above every screen.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View className="flex-1 bg-paper" style={themeVars[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Over the tabs, like a transparent modal: the page below (Home, My Cars) stays attached. The page runs its own open/close animation (components/CarFlight). */}
        <Stack.Screen name="vehicle/[id]" options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false }} />
        {/* Opened from the car page (a transparent modal) a plain push shows as an inset card. These pages go full screen; */}
        {['part', 'edit-vehicle', 'car-360'].map((n) => <Stack.Screen key={n} name={n} options={{ presentation: 'fullScreenModal' }} />)}
        {/* v2 logging sheets (flow 4): card-colour sheets over the page below */}
        <Stack.Screen name="capture/voice" options={{ ...sheetOptions, sheetCornerRadius: 36, contentStyle: [themeVars[scheme], { backgroundColor: palette[scheme].white }] }} />
        <Stack.Screen name="capture/review-all" options={{ ...sheetOptions, sheetAllowedDetents: [0.8, 0.95], sheetCornerRadius: 36, contentStyle: [themeVars[scheme], { backgroundColor: palette[scheme].white }] }} />
        <Stack.Screen name="part-logs" options={{ ...sheetOptions, sheetAllowedDetents: [0.6, 0.95] }} />
        <Stack.Screen name="capture/index" options={{ ...sheetOptions, sheetAllowedDetents: [0.92], sheetCornerRadius: 36, contentStyle: [themeVars[scheme], { backgroundColor: palette[scheme].white }] }} />
        <Stack.Screen name="update-odometer" options={{ ...sheetOptions, sheetCornerRadius: 36, contentStyle: [themeVars[scheme], { backgroundColor: palette[scheme].white }] }} />
        <Stack.Screen name="sheet" options={sheetOptions} />
        <Stack.Screen name="switch-vehicle" options={sheetOptions} />
        <Stack.Screen name="upgrade" options={sheetOptions} />
        <Stack.Screen name="add-record" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notify-permission" options={{ presentation: 'modal' }} />
      </Stack>
      <KeyboardDone />
      <Toast />
      {splashDone ? null : <SplashOverlay onDone={endSplash} />}
    </View>
    </GestureHandlerRootView>
  );
}
