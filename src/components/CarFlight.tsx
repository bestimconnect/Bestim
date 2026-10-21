import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Dimensions, I18nManager } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useFlight } from '@/lib/carFlight';
import { vehicleArt } from '@/lib/vehicleArt';

const clear = () => useFlight.setState({ flight: null });

/**
 * The one flying copy of the car (root layout, above every screen). Nothing is drawn unless a flight is on.
 * It only moves and scales (transform, on the UI thread), so it keeps flying smoothly while the next page is still being built.
 */
export function CarFlight() {
  const flight = useFlight((s) => s.flight);
  const p = useSharedValue(0);
  useEffect(() => {
    if (!flight?.to) return;
    p.set(0);
    p.set(withTiming(1, { duration: 500, easing: Easing.bezier(0.4, 0, 0.2, 1) }, (done) => done && runOnJS(clear)()));
    const t = setTimeout(clear, 1500); // if the animation never reports back, give the pictures back
    return () => clearTimeout(t);
  }, [flight]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => {
    const f = flight;
    if (!f?.to) return {};
    const k = p.get();
    return {
      transform: [
        { translateX: interpolate(k, [0, 1], [0, f.to.x + f.to.width / 2 - (f.from.x + f.from.width / 2)]) },
        { translateY: interpolate(k, [0, 1], [0, f.to.y + f.to.height / 2 - (f.from.y + f.from.height / 2)]) },
        { scale: interpolate(k, [0, 1], [1, f.to.width / f.from.width]) },
      ],
    };
  }, [flight]);
  if (!flight) return null;
  const { x, y, width, height } = flight.from; // physical coordinates; RN mirrors `left` in RTL, so convert
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: I18nManager.isRTL ? Dimensions.get('window').width - x - width : x, top: y, width, height }, style]}>
      <Image source={vehicleArt(flight.vehicleType)} contentFit="contain" transition={0} style={{ width: '100%', height: '100%' }} />
    </Animated.View>
  );
}
