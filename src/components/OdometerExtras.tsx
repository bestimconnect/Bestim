import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { cancelAnimation, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';

/** A small fine-tune button under the ruler: one tap = one step; hold it and the step repeats (for an exact number). */
export function Nudge({ shown, step, max }: { shown: SharedValue<number>; step: number; max: number }) {
  const { t } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = () => {
    cancelAnimation(shown);
    shown.set(Math.min(max, Math.max(0, Math.round(shown.get()) + step)));
    Haptics.selectionAsync();
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const loop = () => {
    bump();
    timer.current = setTimeout(loop, 70);
  };
  useEffect(() => stop, []);
  const sign = step > 0 ? '+' : '−';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('odometer.nudge', { n: `${sign}${Math.abs(step)}` })}
      onPressIn={() => {
        bump();
        timer.current = setTimeout(loop, 380);
      }}
      onPressOut={stop}
      className="h-10 min-w-[56px] items-center justify-center rounded-full bg-paper px-3">
      <Text variant="caption" className="text-ink" style={{ fontFamily: 'Poppins_400Regular' }}>{sign}{Math.abs(step)}</Text>
    </PressableScale>
  );
}
