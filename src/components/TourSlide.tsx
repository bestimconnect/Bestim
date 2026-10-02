import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { useLightStatusBar, Wordmark } from '@/components/Hero';
import { useSettings } from '@/stores/settingsStore';
import { Button, FILL, Rise, Text } from '@/components/ui';

const TOTAL_STEPS = 3;

/** Last tour step or skip: the tour runs before sign-in, then Welcome (sign in / create account). */
export function endTour() {
  useSettings.getState().finishTour();
  router.replace('/welcome');
}

type Props = {
  step: 1 | 2 | 3;
  title: string;
  body: string;
  cta: string;
  skip?: string;
  onNext: () => void;
  onSkip?: () => void;
  illustration: ReactNode;
};

/** Shared layout for the 3 onboarding tour screens (Figma 33/34/35): ink background, hero illustration, step copy + progress. */
export function TourSlide({ step, title, body, cta, skip, onNext, onSkip, illustration }: Props) {
  useLightStatusBar();
  const still = useReducedMotion();
  return (
    <View className="flex-1 bg-ink">
      <Wordmark />
      <SafeAreaView className="flex-1">
        <Rise className="mx-6 mt-[72px] h-[200px] items-center justify-center">{illustration}</Rise>
        <View className="flex-1" />
        <View className="gap-3.5 p-6">
          <Text variant="caption" className="text-right text-lime">{`0${step} / 0${TOTAL_STEPS}`}</Text>
          <Rise index={1}><Text variant="title" className="text-paper">{title}</Text></Rise>
          <Rise index={2}><Text variant="body" className="text-muted">{body}</Text></Rise>
          <View className="h-1.5 flex-row items-center justify-between">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <Animated.View
                key={n}
                className={`h-1 rounded-full ${n === step ? 'bg-lime' : 'bg-muted'}`}
                style={[{ width: n === step ? 48 : 10 }, n === step && !still ? FILL : undefined]}
              />
            ))}
          </View>
          <Button title={cta} onPress={onNext} />
          {skip ? (
            <Text variant="caption" className="text-center text-muted" onPress={onSkip}>
              {skip}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
