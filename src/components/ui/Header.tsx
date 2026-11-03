import { router, usePathname, useSegments } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { I18nManager, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLightStatusBar } from '@/components/Hero';
import { BAR_GAP, barHeight, rowHeight, useBarEntry } from '@/lib/appBar';
import { useColors } from '@/lib/theme';
import { PressableScale } from './PressableScale';
import { Sheen } from './Sheen';
import { Text } from './Text';

/** Sign-in and car setup are plain light screens; every other screen's header is the shared green bar (AppBarOverlay). */
type HeaderProps = { title?: string; sub?: string; back?: boolean; right?: ReactNode; below?: ReactNode; belowH?: number };
export function Header(props: HeaderProps) {
  const plain = ['(auth)', '(onboarding)'].includes(useSegments()[0] as string);
  const own = LOCAL_BAR.includes(usePathname());
  return plain ? <PlainHeader {...props} /> : own ? <LocalBar {...props} /> : <BarSpacer {...props} />;
}

/** Pages opened from the car page (a transparent modal) are full-screen native modals (see _layout), which hide the root bar: they draw their own. */
export const LOCAL_BAR = ['/update-odometer', '/edit-vehicle', '/car-360'];

function LocalBar({ title, sub, back = true, right, below, belowH }: HeaderProps) {
  const { t } = useTranslation();
  const c = useColors();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useLightStatusBar();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const e = { back: back && router.canGoBack(), right, sub, below, belowH };
  const height = barHeight(e);
  const gap = at ? Math.max(0, top - at.y) : 0; // a native modal can report no top inset to SafeAreaView: pad the difference here
  return (
    <View ref={ref} style={{ height: height + 8 + gap }} onLayout={() => ref.current?.measureInWindow((x, y) => setAt({ x, y }))}>
      {at ? (
        <View className="absolute overflow-hidden rounded-b-[28px] bg-panel" style={{ left: -at.x, top: -at.y, width, height: top + height }}>
          <Sheen opacity={0.07} />
          <Sheen color="#D3F53D" opacity={0.09} glow="tr" radius={0.8} />
          <View className="absolute inset-x-0 bottom-0 px-6 pb-4" style={{ gap: BAR_GAP }}>
            <View className="flex-row items-center gap-3" style={{ minHeight: rowHeight(e) }}>
              {e.back ? (
                <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
                  <Back size={22} color={c.onpanel} />
                </PressableScale>
              ) : null}
              <View className="flex-1 justify-center">
                <Text variant="title" className="!text-[24px] !leading-[32px] text-onpanel" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
                {sub ? <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }} numberOfLines={1}>{sub}</Text> : null}
              </View>
              {right}
            </View>
            {below ? <View style={{ minHeight: belowH ?? 44 }}>{below}</View> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
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
