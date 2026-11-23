import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { I18nManager, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setCloser, useFlight, type Rect } from '@/lib/carFlight';
import { useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

const TIMING = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) }; // symmetric, so closing is exactly opening in reverse
const CARD_RADIUS = 24; // rounded-tile
const PHOTO = { width: 260, height: 130, below: 78 }; // the car page's picture: size, and distance under the safe area

const land = () => useFlight.setState({ flight: null, landed: true });
const leave = () => {
  useFlight.setState({ flight: null });
  router.back();
};

/**
 * Wraps the car page: its background grows from the tapped card to the full screen while the car moves to its place, never fading.
 * The page's content fades in only at the end. Closing runs the same progress backwards.
 */
export function CarFlight({ children }: { children: ReactNode }) {
  const { width: W, height: H } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const c = useColors();
  const flight = useFlight((s) => s.flight);
  const p = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    p.set(withTiming(1, TIMING, (done) => done && runOnJS(land)()));
    setCloser((next) => {
      if (closing.current) return;
      closing.current = true;
      useFlight.setState({ flight: next, landed: true });
      p.set(withTiming(0, TIMING, (done) => done && runOnJS(leave)()));
    });
    return () => {
      setCloser(null);
      useFlight.setState({ flight: null, landed: false });
    };
  }, [p]);

  const rtl = I18nManager.isRTL; // RN mirrors `left` in RTL; rects are physical
  const full: Rect = { x: 0, y: 0, width: W, height: H };
  const card = flight?.card ?? full;
  const photo = flight?.photo;
  const to = flight?.to ?? { x: (W - PHOTO.width) / 2, y: top + PHOTO.below, width: PHOTO.width, height: PHOTO.height };
  const startColor = flight && flight.card !== flight.photo ? c.white : c.paper;
  const radius = flight ? CARD_RADIUS : 0;

  const surface = useAnimatedStyle(() => {
    const k = p.get();
    const x = interpolate(k, [0, 1], [card.x, 0]);
    const width = interpolate(k, [0, 1], [card.width, W]);
    return {
      left: rtl ? W - x - width : x,
      top: interpolate(k, [0, 1], [card.y, 0]),
      width,
      height: interpolate(k, [0, 1], [card.height, H]),
      borderRadius: interpolate(k, [0, 1], [radius, 0]),
      opacity: interpolate(k, [0, 0.12], [0, 1], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(k, [0, 0.7], [startColor, c.paper]),
    };
  }, [card, W, H, rtl, radius, startColor, c.paper]);

  const content = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.7, 1], [0, 1], Extrapolation.CLAMP) }));

  const car = useAnimatedStyle(() => {
    if (!photo) return {};
    const k = p.get();
    return {
      transform: [
        { translateX: interpolate(k, [0, 1], [0, to.x + to.width / 2 - (photo.x + photo.width / 2)]) },
        { translateY: interpolate(k, [0, 1], [0, to.y + to.height / 2 - (photo.y + photo.height / 2)]) },
        { scale: interpolate(k, [0, 1], [1, to.width / photo.width]) },
      ],
    };
  }, [photo, to]);

  return (
    <View className="flex-1">
      <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, surface]} />
      <Animated.View className="flex-1" style={content}>{children}</Animated.View>
      {flight && photo ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: rtl ? W - photo.x - photo.width : photo.x, top: photo.y, width: photo.width, height: photo.height }, car]}>
          <Image source={vehicleArt(flight.vehicleType)} contentFit="contain" transition={0} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
