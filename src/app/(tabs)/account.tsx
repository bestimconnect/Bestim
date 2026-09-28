import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';

// Placeholder — built from Figma in Phase 3.
export default function Screen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Text variant="title">{t('tabs.account')}</Text>
    </SafeAreaView>
  );
}
