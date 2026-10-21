import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation, runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withDecay, withTiming,
} from 'react-native-reanimated';

import { FRAME_COUNT, markerAt, type Marker } from '@/lib/car360';

const PX_PER_FRAME = 12; // how far a finger travels to turn the car by one frame (15 degrees)
const wrap = (i: number) => {
  'worklet';
  return ((Math.round(i) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
};

/**
 * The car on a turntable. `angle` counts frames (not degrees) and keeps going past a full turn; dragging changes it,
 * letting go keeps it spinning (decay), and it settles on a whole frame. All 24 pictures stay mounted and only the visible one's opacity is 1. Dragging to the right turns the car the way the finger goes, in Arabic too.
 */
export function Rotator360({
  frames,
  markers = [],
  colors = {},
  onMarker,
  annotate,
  onAnnotate,
}: {
  frames: number[];
  markers?: Marker[];
  /** Dot colour per marker group; a group without a colour has no part to show and gets no dot. */
  colors?: Partial<Record<Marker['group'], string>>;
  onMarker?: (group: Marker['group']) => void;
  /** Dev: a tap on the picture reports the frame and the spot instead of spinning. */
  annotate?: boolean;
  onAnnotate?: (frame: number, x: number, y: number) => void;
}) {
  const still = useReducedMotion();
  const angle = useSharedValue(0);
  const from = useSharedValue(0);

  // One slow turn on open, so it is clear the car can be spun.
  useEffect(() => {
    if (!still) angle.set(withTiming(FRAME_COUNT, { duration: 3500 }));
    return () => cancelAnimation(angle);
  }, [angle, still]);

  const [shown, setShown] = useState(0);
  const tick = (frame: number) => {
    setShown(frame);
    Haptics.selectionAsync();
  };
  useAnimatedReaction(
    () => wrap(angle.get()),
    (now, before) => {
      if (before != null && now !== before) runOnJS(tick)(now);
    },
  );

  const size = useSharedValue({ w: 1, h: 1 });
  const note = (x: number, y: number) => onAnnotate?.(shown, (x / size.get().w) * 100, (y / size.get().h) * 100);
  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(note)(e.x, e.y);
  });
  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(angle);
      from.set(angle.get());
    })
    .onUpdate((e) => {
      angle.set(from.get() - e.translationX / PX_PER_FRAME);
    })
    .onEnd((e) => {
      angle.set(
        withDecay({ velocity: -e.velocityX / PX_PER_FRAME, deceleration: 0.997 }, (done) => {
          'worklet';
          if (done) angle.set(withTiming(Math.round(angle.get()), { duration: 120 }));
        }),
      );
    });

  return (
    <GestureDetector gesture={annotate ? Gesture.Race(pan, tap) : pan}>
      <View className="w-full" style={{ aspectRatio: 418 / 313 }} accessibilityLabel="360" onLayout={(e) => size.set({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* All 24 pictures stay mounted (decoded once) and only the opacity flips, so a turn never waits on an image. */}
        {frames.map((src, i) => (
          <Image key={i} source={src as number} contentFit="contain" style={{ position: 'absolute', width: '100%', height: '100%', opacity: shown === i ? 1 : 0 }} />
        ))}
        {markers.map((m) => {
          const at = colors[m.group] ? markerAt(m, shown) : null;
          if (!at) return null;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => onMarker?.(m.group)}
              hitSlop={8}
              className="absolute h-7 w-7 items-center justify-center rounded-full bg-white"
              style={{ left: `${at.x}%`, top: `${at.y}%`, marginLeft: -14, marginTop: -14, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
              <View className="h-4 w-4 rounded-full" style={{ backgroundColor: colors[m.group] }} />
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
