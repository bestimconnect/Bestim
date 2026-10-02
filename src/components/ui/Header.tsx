import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Header({ title, back = true, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  const c = useColors();
  const { t } = useTranslation();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <View className="h-14 flex-row items-center gap-3">
      {back && router.canGoBack() ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={router.back}
          className="h-11 w-11 items-center justify-center rounded-field bg-white">
          <Back size={22} color={c.ink} />
        </PressableScale>
      ) : null}
      <Text variant="heading" className="flex-1">{title}</Text>
      {right}
    </View>
  );
}
