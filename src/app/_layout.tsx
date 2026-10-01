import '@/global.css';

import { Poppins_400Regular, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Tajawal_400Regular, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { useURL } from 'expo-linking';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { applyLanguage } from '@/lib/i18n';
import { sessionFromUrl, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { themeVars, useScheme } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

function App() {
  const scheme = useScheme();
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_700Bold, Poppins_400Regular, Poppins_700Bold });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const language = useSettings((s) => s.language);
  const tourSeen = useSettings((s) => s.tourSeen);
  const session = useSession();
  const userId = session?.user.id;
  const profile = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
  const ready = fontsLoaded && hydrated && session !== undefined && (!userId || !profile.isPending);

  useEffect(() => useSettings.persist.onFinishHydration(() => setHydrated(true)), []);

  // Email links (confirm sign-up / reset password). Sign-up needs nothing more: the gate below routes new users to the tour.
  const url = useURL();
  useEffect(() => {
    if (!ready || !url?.includes('#')) return;
    sessionFromUrl(url)
      .then((type) => type === 'recovery' && router.replace('/reset-password'))
      .catch(() => router.replace({ pathname: '/login', params: { notice: 'linkExpired' } }));
  }, [ready, url]);
  useEffect(() => {
    if (!ready) return;
    if (!language) router.replace('/language');
    else {
      applyLanguage(language);
      // Flow: language → tour → welcome/auth → profile (if no name) → add vehicle → home.
      // Guests (anonymous accounts, Q17) have no name and skip the profile step.
      if (!userId) router.replace(tourSeen ? '/welcome' : '/tour-voice');
      else if (profile.data && !profile.data.full_name.trim() && !session?.user.is_anonymous) router.replace('/profile-setup'); // Q7
      else if (profile.data && !profile.data.onboarding_completed) router.replace('/add-vehicle');
    }
    SplashScreen.hideAsync();
  }, [ready, language, tourSeen, userId, profile.data, session?.user.is_anonymous]);

  if (!ready) return null;
  return (
    <View className="flex-1 bg-paper" style={themeVars[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="capture/index" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetCornerRadius: 32, contentStyle: themeVars[scheme] }} />
        <Stack.Screen name="feature-gate" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}
