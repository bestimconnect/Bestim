import '@/global.css';

import { Poppins_400Regular, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Tajawal_400Regular, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { applyLanguage } from '@/lib/i18n';
import { themeVars } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_700Bold, Poppins_400Regular, Poppins_700Bold });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const language = useSettings((s) => s.language);
  const ready = fontsLoaded && hydrated;

  useEffect(() => useSettings.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => {
    if (!ready) return;
    if (language) applyLanguage(language);
    else router.replace('/language');
    SplashScreen.hideAsync();
  }, [ready, language]);

  if (!ready) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <View className="flex-1 bg-paper" style={themeVars[scheme]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </QueryClientProvider>
  );
}
