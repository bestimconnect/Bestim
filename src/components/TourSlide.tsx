import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';

const TOTAL_STEPS = 3;

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
  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1">
        <Image
          source={require('@/assets/images/logo-word-inverse.png')}
          contentFit="contain"
          style={{ width: 120, height: 34, marginLeft: 24, marginTop: 12 }}
          accessibilityLabel="Bestim"
        />
        <View className="mx-6 mt-6 h-[200px] items-center justify-center">{illustration}</View>
        <View className="flex-1" />
        <View className="gap-3.5 p-6">
          <Text variant="caption" className="text-right text-lime">{`0${step} / 0${TOTAL_STEPS}`}</Text>
          <Text variant="title" className="text-paper">{title}</Text>
          <Text variant="body" className="text-muted">{body}</Text>
          <View className="h-1.5 flex-row items-center justify-between">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <View
                key={n}
                className={`h-1 rounded-full ${n === step ? 'bg-lime' : 'bg-muted'}`}
                style={{ width: n === step ? 48 : 10 }}
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
