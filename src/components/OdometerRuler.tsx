import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDecay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/lib/theme';

const SEG_W = 80; // one labelled segment: 10 ticks
const SIDE = 4; // labelled segments drawn each side of the reading: half a phone width plus room for a fast move
const TICKS = Array.from({ length: 10 }, (_, k) => k);

type Props = {
  /** The reading, shared with the rolling number. Dragging writes it; the screen animates it for typed/scanned values. */
  shown: SharedValue<number>;
  /** Units per labelled segment: 1000 for km/mi, 100 for hours. Dragging lands on any whole number. */
  segment: number;
  max: number;
};

// Flat ruler (v2): thin ticks, every fifth one longer and darker. No numbers: the big reading above says it.
function Segment() {
  return (
    <>
      {TICKS.map((k) => (
        <View key={k} className={`absolute bottom-0 w-[2px] rounded-full ${k % 5 === 0 ? 'bg-muted' : 'bg-tick'}`} style={{ left: k * (SEG_W / 10), height: k % 5 === 0 ? 24 : 14 }} />
      ))}
    </>
  );
}

/**
 * Screen 25's ruler (decisions Q53, redrawn light in Q71): the reading sits under the fixed lime pointer and the
 * ruler slides under it. Drawn from the shared value, so it glides in step with the rolling number.
 */
export function OdometerRuler({ shown, segment, max }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  // Only the segments around the reading exist; `base` follows the reading one labelled step at a time.
  const [base, setBase] = useState(() => Math.floor(shown.get() / segment));
  const from = useSharedValue(0);
  const byUser = useSharedValue(false); // haptic ticks are for the finger, not for a typed or scanned value rolling in
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
        shown.set(withTiming(Math.round(shown.value), { duration: 120 }));
      };
      shown.set(withDecay({ velocity: (-e.velocityX / SEG_W) * segment, clamp: [0, max], deceleration: 0.996 }, settle));
    });

  const strip = useAnimatedStyle(() => ({
    transform: [{ translateX: width / 2 - ((shown.value - first * segment) / segment) * SEG_W }],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* direction ltr: numbers grow to the right in Arabic too (founder, decisions Q53). */}
      <View className="h-[38px] overflow-hidden" style={{ direction: 'ltr' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Animated.View className="absolute left-0 top-0 h-full" style={strip}>
            {Array.from({ length: SIDE * 2 + 1 }, (_, i) => first + i).map((i) =>
              i >= 0 && i * segment <= max ? (
                <View key={i} className="absolute top-0 h-full w-[80px]" style={{ left: (i - first) * SEG_W }}>
                  <Segment />
                </View>
              ) : null,
            )}
          </Animated.View>
        ) : null}
        {/* the centre marker: one flat lime bar, outlined in the ink colour so it shows on light and dark */}
        <View pointerEvents="none" className="absolute bottom-0 h-[34px] w-[3px] rounded-full bg-lime" style={{ left: width / 2 - 1.5, boxShadow: `0 0 0 1.5px ${c.ink}` }} />
      </View>
    </GestureDetector>
  );
}
