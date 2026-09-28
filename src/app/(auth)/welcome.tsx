import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';

// Screen 2 — placeholder, Figma pass in Phase 2.
export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 justify-end gap-6 bg-paper px-6 pb-6">
      <Text variant="display">{t('welcome.title')}</Text>
      <Button title={t('tabs.home')} variant="dark" onPress={() => router.replace('/')} />
    </SafeAreaView>
  );
}
