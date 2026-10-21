import { I18nManager, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui';

// The big reading on the update-odometer screen: digits roll like a car's odometer (decisions Q71).
// Everything moves on the UI thread from one shared value, so it stays in step with the ruler.
const SIZES = { lg: { h: 60, w: 33, fs: 52, comma: 15 }, sm: { h: 34, w: 17, fs: 28, comma: 8 } }; // sm = inside the dial
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; // the trailing 0 is where 9 rolls over to

type Dims = (typeof SIZES)['lg'];

function Column({ shown, place, d: { h, w, fs }, color }: { shown: SharedValue<number>; place: number; d: Dims; color?: string }) {
  const digit = { fontFamily: 'Poppins_700Bold', fontSize: fs, lineHeight: h, textAlign: 'center', ...(color ? { color } : null) } as const;
  const style = useAnimatedStyle(() => {
    const v = Math.max(0, shown.value);
    // Units turn continuously. Each higher wheel only turns while the wheel below it goes from 9 to 0
    // (the carry of a real odometer), so at rest every digit sits on a whole number.
    let r = v % 10;
    for (let p = 1; p <= place; p++) r = (Math.floor(v / Math.pow(10, p)) % 10) + Math.max(0, r - 9);
    return { transform: [{ translateY: -r * h }] };
  });
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {STRIP.map((n, i) => <Text key={i} variant="number" style={digit}>{n}</Text>)}
      </Animated.View>
    </View>
  );
}

/** `count` = how many digits to draw (the length of the current reading). `color` overrides the theme's ink. */
export function RollingNumber({ shown, count, color, size = 'lg' }: { shown: SharedValue<number>; count: number; color?: string; size?: keyof typeof SIZES }) {
  const d = SIZES[size];
  const places = Array.from({ length: Math.max(1, count) }, (_, i) => Math.max(1, count) - 1 - i);
  return (
    // Numbers read left to right in Arabic too.
    <View pointerEvents="none" className="items-center justify-center" style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', height: d.h }}>
      {places.map((place) => (
        <View key={place} style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
          <Column shown={shown} place={place} d={d} color={color} />
          {place > 0 && place % 3 === 0 ? <Text variant="number" style={{ fontFamily: 'Poppins_700Bold', fontSize: d.fs, lineHeight: d.h, textAlign: 'center', width: d.comma, ...(color ? { color } : null) }}>,</Text> : null}
        </View>
      ))}
    </View>
  );
}
