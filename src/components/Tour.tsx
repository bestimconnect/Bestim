import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useFirstRun } from '@/lib/firstRun';
import { openCapture } from '@/lib/reading';
import { measureTarget, useTourReplay, type Rect, type TourKey } from '@/lib/tour';
import { useSettings } from '@/stores/settingsStore';
import { Button, Card, Text } from './ui';

// Idea 4 (founder, 2026-11-03): a short spotlight tour on the real Home, once, right after the first car is added.
const STEPS: (TourKey | null)[] = [null, 'odometer', 'priority', 'expenses', 'capture'];
const PAD = 6;
const GAP = 14;

const hole = ({ x, y, w, h }: Rect, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

export function Tour() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { vehicle, empty } = useFirstRun();
  const seen = useSettings((s) => s.tourSeen);
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(-1); // -1: not running
  const [pos, setPos] = useState<{ step: number; rect: Rect } | null>(null);
  const replay = useTourReplay((s) => s.on);
  const eligible = pathname === '/' && !!vehicle && (replay || (empty && !seen));
  const key = step >= 0 ? STEPS[step] : null;
  const rect = pos?.step === step ? pos.rect : null; // a stop's rect counts only once it is measured
  const finish = () => {
    useSettings.getState().set({ tourSeen: true });
    useTourReplay.setState({ on: false });
    setStep(-1);
  };

  // Wait for Home to settle (the car's arrival animation) before the first stop.
  useEffect(() => {
    if (!eligible || step !== -1) return;
    const id = setTimeout(() => setStep(0), 900);
    return () => clearTimeout(id);
  }, [eligible, step]);

  // Light up this stop's target; a target that is not on screen (offline Home…) is skipped.
  useEffect(() => {
    if (!key) return;
    measureTarget(key, (r) => {
      if (r) return setPos({ step, rect: r });
      if (step === STEPS.length - 1) finish();
      else setStep(step + 1);
    });
  }, [key, step]);

  useEffect(() => {
    if (step < 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (finish(), true));
    return () => sub.remove();
  }, [step]);

  if (step < 0) return null;
  const last = step === STEPS.length - 1;
  const lit = rect && { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  const radius = lit ? (key === 'capture' ? Math.min(lit.w, lit.h) / 2 : key === 'expenses' ? 18 : 22) : 0;
  const below = !!lit && lit.y + lit.h / 2 < height / 2;
  const place = !lit ? { top: 0, bottom: 0, justifyContent: 'center' as const } : below ? { top: lit.y + lit.h + GAP } : { bottom: height - lit.y + GAP };
  const name = key ?? 'welcome';
  const next = () => (last ? (finish(), openCapture()) : setStep(step + 1));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height}>
          <Path d={`M0 0H${width}V${height}H0Z${lit ? hole(lit, radius) : ''}`} fillRule="evenodd" fill="rgba(14,20,17,0.72)" />
        </Svg>
      </Animated.View>
      {key && !lit ? null : (
        <Animated.View key={step} entering={FadeIn.duration(220)} className="absolute inset-x-5" style={place}>
          <Card className="gap-3 p-5">
            {step > 0 ? <Text variant="caption" className="text-teal">{t('tour.step', { n: step, total: STEPS.length - 1 })}</Text> : null}
            <Text variant="heading">{t(`tour.${name}Title`)}</Text>
            <Text variant="body" className="text-muted">{t(`tour.${name}Body`)}</Text>
            <Button title={t(step === 0 ? 'tour.start' : last ? 'tour.try' : 'tour.next')} onPress={next} />
            <Button title={t(last ? 'tour.later' : 'tour.skip')} variant="ghost" size="sm" onPress={finish} />
          </Card>
        </Animated.View>
      )}
    </View>
  );
}
