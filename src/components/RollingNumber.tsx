import { I18nManager, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui';

// The big reading on the update-odometer screen: digits roll like a car's odometer (decisions Q71).
// Everything moves on the UI thread from one shared value, so it stays in step with the ruler.
const H = 60; // one digit
const W = 33;
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; // the trailing 0 is where 9 rolls over to
const digit = { fontFamily: 'Poppins_700Bold', fontSize: 52, lineHeight: H, textAlign: 'center' } as const;

function Column({ shown, place }: { shown: SharedValue<number>; place: number }) {
  const style = useAnimatedStyle(() => {
    const v = Math.max(0, shown.value);
    // Units turn continuously. Each higher wheel only turns while the wheel below it goes from 9 to 0
    // (the carry of a real odometer), so at rest every digit sits on a whole number.
    let d = v % 10;
    for (let p = 1; p <= place; p++) d = (Math.floor(v / Math.pow(10, p)) % 10) + Math.max(0, d - 9);
    return { transform: [{ translateY: -d * H }] };
  });
  return (
    <View style={{ width: W, height: H, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {STRIP.map((n, i) => <Text key={i} variant="number" style={digit}>{n}</Text>)}
      </Animated.View>
    </View>
  );
}

/** `count` = how many digits to draw (the length of the current reading). */
export function RollingNumber({ shown, count }: { shown: SharedValue<number>; count: number }) {
  const places = Array.from({ length: Math.max(1, count) }, (_, i) => Math.max(1, count) - 1 - i);
  return (
    // Numbers read left to right in Arabic too.
    <View pointerEvents="none" className="items-center justify-center" style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', height: H }}>
      {places.map((place) => (
        <View key={place} style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
          <Column shown={shown} place={place} />
          {place > 0 && place % 3 === 0 ? <Text variant="number" style={{ ...digit, width: 15 }}>,</Text> : null}
        </View>
      ))}
    </View>
  );
}
