import '@/global.css';

import { Poppins_400Regular, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Tajawal_400Regular, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { applyLanguage } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { themeVars } from '@/lib/theme';
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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_700Bold, Poppins_400Regular, Poppins_700Bold });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const language = useSettings((s) => s.language);
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
  // Guests (no session) may browse; signed-in users finish onboarding first.
  const ready = fontsLoaded && hydrated && session !== undefined && (!userId || !profile.isPending);

  useEffect(() => useSettings.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => {
    if (!ready) return;
    if (!language) router.replace('/language');
    else {
      applyLanguage(language);
      if (profile.data && !profile.data.onboarding_completed) router.replace('/tour-voice');
    }
    SplashScreen.hideAsync();
  }, [ready, language, profile.data]);

  if (!ready) return null;
  return (
    <View className="flex-1 bg-paper" style={themeVars[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
