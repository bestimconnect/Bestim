import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { applyLanguage } from '@/lib/i18n';
import { useSettings, type Language } from '@/stores/settingsStore';

// Screen 1 — functional placeholder, Figma pass in Phase 2.
export default function LanguageScreen() {
  const { t } = useTranslation();
  const setLanguage = useSettings((s) => s.setLanguage);
  const pick = (l: Language) => {
    setLanguage(l);
    applyLanguage(l);
    router.replace('/welcome');
  };
  return (
    <SafeAreaView className="flex-1 justify-center gap-6 bg-paper px-6">
      <Text variant="title">{t('language.title')}</Text>
      <View className="gap-3">
        <Button title={t('language.ar')} onPress={() => pick('ar')} />
        <Button title={t('language.en')} variant="secondary" onPress={() => pick('en')} />
      </View>
    </SafeAreaView>
  );
}
