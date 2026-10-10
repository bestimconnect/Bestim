import '@/global.css';

import { Poppins_400Regular, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Tajawal_400Regular, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { useURL } from 'expo-linking';
import { useLastNotificationResponse } from 'expo-notifications';
import { type ErrorBoundaryProps, router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { SplashOverlay } from '@/components/SplashOverlay';
import { Toast } from '@/components/Toast';
import { Button, Text } from '@/components/ui';
import { applyLanguage } from '@/lib/i18n';
import { syncNotifications } from '@/lib/notifications';
import { DAY, persister, queryClient } from '@/lib/queryClient';
import { sessionFromUrl, useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries';
import { palette } from '@/lib/palette';
import { themeVars, useScheme } from '@/lib/theme';
import { processVoiceQueue } from '@/lib/voiceSend';
import { useSettings } from '@/stores/settingsStore';

SplashScreen.preventAutoHideAsync();

/** Shown instead of a blank screen when a screen crashes (Q81). expo-router picks this export up by name. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const scheme = useScheme();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View className="flex-1 justify-center gap-4 bg-paper p-6" style={themeVars[scheme]}>
      <Text variant="title">{t('errorScreen.title')}</Text>
      <Text className="text-muted">{t('errorScreen.body')}</Text>
      <Button title={t('errorScreen.retry')} onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * DAY }}
      onSuccess={() => queryClient.resumePausedMutations()}>
      <App />
    </PersistQueryClientProvider>
  );
}

function App() {
  const scheme = useScheme();
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_700Bold, Poppins_400Regular, Poppins_700Bold });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const language = useSettings((s) => s.language);
  const pendingShareToken = useSettings((s) => s.pendingShareToken);
  const session = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const [splashDone, setSplashDone] = useState(false); // lives here, not in the overlay: the tree unmounts while a new sign-in loads
  const endSplash = useCallback(() => setSplashDone(true), []);
  const ready = fontsLoaded && hydrated && session !== undefined && (!userId || !profile.isPending);

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
  // A share link opened while signed out (or as a guest) waits here until there's a full account (Q44).
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
  const tapped = useLastNotificationResponse()?.notification.request.content.data?.url;
  useEffect(() => {
    if (ready && userId && typeof tapped === 'string') router.push(tapped as never);
  }, [ready, userId, tapped]);

  useEffect(() => {
    if (!ready) return;
    if (!language) router.replace('/language');
    else {
      applyLanguage(language);
      // Flow (Q87): language → intro → car → odometer → save car → first log → home. Intro's "Get started" opens a guest session.
      // Guests (anonymous accounts, Q17) have no name and skip the profile step.
      if (!userId) router.replace('/intro');
      else if (profile.data && !profile.data.full_name.trim() && !session?.user.is_anonymous) router.replace('/profile-setup'); // Q7
      else if (profile.data && !profile.data.onboarding_completed) router.replace('/add-vehicle');
    }
  }, [ready, language, userId, profile.data, session?.user.is_anonymous]);

  if (!ready) return null;
  // Bottom sheets: the capture chooser (13) and the confirm sheet (Q55) and switch vehicle (Q56).
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
        <Stack.Screen name="capture/index" options={sheetOptions} />
        <Stack.Screen name="sheet" options={sheetOptions} />
        <Stack.Screen name="switch-vehicle" options={sheetOptions} />
        <Stack.Screen name="feature-gate" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notify-permission" options={{ presentation: 'modal' }} />
      </Stack>
      <Toast />
      {splashDone ? null : <SplashOverlay onDone={endSplash} />}
    </View>
    </GestureHandlerRootView>
  );
}
