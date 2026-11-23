import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { shadows, useColors } from '@/lib/theme';

/** v2 flat page top: round white back button, title (with an optional line), an optional action at the other end. */
export function PageHeader({ title, sub, right, back = true }: { title?: string; sub?: string; right?: ReactNode; back?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <View className="min-h-[60px] flex-row items-center gap-3 px-6 pb-2 pt-2">
      {back && router.canGoBack() ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
          <Back size={22} color={c.ink} />
        </PressableScale>
      ) : null}
      <View className="flex-1 justify-center">
        <Text variant="heading" numberOfLines={1}>{title}</Text>
        {sub ? <Text variant="caption" className="text-muted" numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}
