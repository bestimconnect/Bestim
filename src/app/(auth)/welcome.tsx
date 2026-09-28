import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Hero } from '@/components/Hero';
import { Button, Text } from '@/components/ui';

// Screen 02 — Figma 167:56936
export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-paper">
      <Hero height={561}>
        <View className="flex-1 justify-end gap-2 px-6 pb-10">
          <Text variant="display" className="text-white">{t('auth.welcome.title')}</Text>
          <Text className="text-muted">{t('auth.welcome.subtitle')}</Text>
        </View>
      </Hero>
      <SafeAreaView edges={['bottom']} className="gap-2.5 px-6 pt-[30px]">
        <Button title={t('auth.welcome.primaryCta')} onPress={() => router.push('/register')} />
        <Button title={t('auth.welcome.secondaryCta')} variant="secondary" onPress={() => router.push('/login')} />
      </SafeAreaView>
    </View>
  );
}
