import { router, useSegments } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLightStatusBar } from '@/components/Hero';
import { barHeight, useBarEntry } from '@/lib/appBar';
import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Sign-in and car setup are plain light screens; every other screen's header is the shared green bar (AppBarOverlay). */
type HeaderProps = { title?: string; sub?: string; back?: boolean; right?: ReactNode; below?: ReactNode; belowH?: number };
export function Header(props: HeaderProps) {
  const plain = ['(auth)', '(onboarding)'].includes(useSegments()[0] as string);
  return plain ? <PlainHeader {...props} /> : <BarSpacer {...props} />;
}

/** Holds the bar's place in the layout and tells the overlay what to draw (the bar is the status bar area + this row). */
function BarSpacer({ title, sub, back = true, right, below, belowH }: HeaderProps) {
  const top = useSafeAreaInsets().top;
  useLightStatusBar();
  const e = { back: back && router.canGoBack(), right, sub, below, belowH };
  const height = barHeight(e);
  useBarEntry({ kind: 'bar', title: title ?? '', ...e, bottom: top + height });
  return <View style={{ height: height + 8 }} />; // 8px of air under the bar
}

export function PlainHeader({ title, back = true, right }: HeaderProps) {
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
