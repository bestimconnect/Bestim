import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDecay, withTiming, type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';

const SEG_W = 80; // one labelled segment: 10 ticks
const SIDE = 4; // labelled segments drawn each side of the reading: half a phone width plus room for a fast move
const TICKS = Array.from({ length: 10 }, (_, k) => k);

type Props = {
  /** The reading, shared with the rolling number. Dragging writes it; the screen animates it for typed/scanned values. */
  shown: SharedValue<number>;
  /** Units per labelled segment: 1000 for km/mi, 100 for hours. Dragging snaps to 1/100 of it. */
  segment: number;
  max: number;
};

function Segment({ label }: { label: string }) {
  return (
    <>
      {TICKS.map((k) => (
        <View
          key={k}
          className={`absolute top-0 w-px ${k === 0 ? 'bg-muted' : 'bg-line'}`}
          style={{ left: k * (SEG_W / 10), height: k === 0 ? 34 : k === 5 ? 22 : 14 }}
        />
      ))}
      <Text variant="caption" className="absolute text-center text-muted" style={{ top: 42, left: -SEG_W / 2, width: SEG_W, fontFamily: 'Poppins_400Regular' }}>
        {label}
      </Text>
    </>
  );
}

/**
 * Screen 25's ruler (decisions Q53, redrawn light in Q71): the reading sits under the fixed lime pointer and the
 * ruler slides under it. Drawn from the shared value, so it glides in step with the rolling number.
 */
export function OdometerRuler({ shown, segment, max }: Props) {
  const [width, setWidth] = useState(0);
  // Only the segments around the reading exist; `base` follows the reading one labelled step at a time.
  const [base, setBase] = useState(() => Math.floor(shown.get() / segment));
  const from = useSharedValue(0);
  const byUser = useSharedValue(false); // haptic ticks are for the finger, not for a typed or scanned value rolling in
  const step = segment / 100;
  const first = base - SIDE;

  useAnimatedReaction(
    () => Math.floor(shown.value / segment),
    (now, before) => {
      if (now !== before) runOnJS(setBase)(now);
    },
  );
  const tick = () => Haptics.selectionAsync();
  useAnimatedReaction(
    () => Math.floor(shown.value / (segment / 10)),
    (now, before) => {
      if (byUser.value && before != null && now !== before) runOnJS(tick)();
    },
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8]) // a vertical drag still scrolls the page
    .failOffsetY([-14, 14])
    .onBegin(() => {
      cancelAnimation(shown);
      from.value = shown.value;
      byUser.value = true;
    })
    .onUpdate((e) => {
      shown.set(Math.min(max, Math.max(0, from.value - (e.translationX / SEG_W) * segment)));
    })
    .onEnd((e) => {
      const settle = (finished?: boolean) => {
        'worklet';
        if (!finished) return;
        byUser.value = false;
        shown.set(withTiming(Math.round(shown.value / step) * step, { duration: 120 }));
      };
      shown.set(withDecay({ velocity: (-e.velocityX / SEG_W) * segment, clamp: [0, max], deceleration: 0.996 }, settle));
    });

  const strip = useAnimatedStyle(() => ({
    transform: [{ translateX: width / 2 - ((shown.value - first * segment) / segment) * SEG_W }],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* direction ltr: numbers grow to the right in Arabic too (founder, decisions Q53). */}
      <View className="h-[66px] overflow-hidden" style={{ direction: 'ltr' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Animated.View className="absolute left-0 top-0 h-full" style={strip}>
            {Array.from({ length: SIDE * 2 + 1 }, (_, i) => first + i).map((i) =>
              i >= 0 && i * segment <= max ? (
                <View key={i} className="absolute top-0" style={{ left: (i - first) * SEG_W }}>
                  <Segment label={(i * segment).toLocaleString('en-US')} />
                </View>
              ) : null,
            )}
          </Animated.View>
        ) : null}
        <View pointerEvents="none" className="absolute top-0 items-center" style={{ left: width / 2 - 5, width: 10 }}>
          <View style={{ borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#B4DB1F' }} />
          <View className="h-[40px] w-[3px] rounded-full bg-lime" />
        </View>
      </View>
    </GestureDetector>
  );
}
