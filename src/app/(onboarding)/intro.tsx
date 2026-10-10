import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bell, Check, Disc, Droplets, Mic, Share2, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { type EntryOrExitLayoutType, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Item, Note, PressableScale, Text } from '@/components/ui';
import { continueAsGuest } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { EASE_OUT, POP, rise } from '@/lib/motion';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

const SLIDES = ['voice', 'reminders', 'history'] as const;
const VIEWABLE = { itemVisiblePercentThreshold: 50 }; // one slide at a time counts as the current one
const STAGE = { w: 330, h: 300 }; // the collage is drawn on this fixed canvas, then scaled to fit

/** One floating piece of a collage: positioned on the canvas, tilted, entering on its own beat. Decorative, never touchable. */
function Piece({ at, tilt = 0, enter, children }: { at: ViewStyle; tilt?: number; enter: EntryOrExitLayoutType; children: ReactNode }) {
  return (
    <Animated.View entering={enter} style={[{ position: 'absolute' }, at]}>
      <View pointerEvents="none" style={{ transform: [{ rotate: `${tilt}deg` }] }}>{children}</View>
    </Animated.View>
  );
}

const Circle = ({ size, children }: { size: number; children: ReactNode }) => (
  <View className="items-center justify-center rounded-full bg-lime" style={{ width: size, height: size, boxShadow: shadows.glow }}>{children}</View>
);

const Pill = ({ icon: Icon, text, dark }: { icon: LucideIcon; text: string; dark?: boolean }) => {
  const c = useColors();
  return (
    <View className={`flex-row items-center gap-2 rounded-full px-4 py-3 ${dark ? 'bg-ink' : 'bg-white'}`} style={{ boxShadow: shadows.elevated }}>
      <Icon size={18} color={dark ? c.paper : c.teal} />
      <Text variant="label" className={dark ? 'text-paper' : ''}>{text}</Text>
    </View>
  );
};

function Collage({ slide }: { slide: (typeof SLIDES)[number] }) {
  const { t } = useTranslation();
  const tt = (k: string, n?: string) => t(`onboarding.intro.${slide}.${k}`, { n });
  if (slide === 'voice')
    return (
      <>
        <Piece at={{ top: 0, end: 0, maxWidth: 320 }} tilt={3} enter={rise(0)}>
          <Pill icon={Mic} text={tt('said')} />
        </Piece>
        <Piece at={{ top: 62, start: 8 }} enter={POP.delay(150)}>
          <View className="h-[120px] w-[120px] items-center justify-center">
            <View className="absolute inset-0 rounded-full border-2 border-lime" style={{ opacity: 0.45 }} />
            <Circle size={88}><Mic size={36} color="#222E29" /></Circle>
          </View>
        </Piece>
        <Piece at={{ top: 168, end: 0, width: 270 }} tilt={-3} enter={rise(4)}>
          <Item icon={Droplets} title={tt('service')} subtitle={tt('today')} chevron={false} aside={<Text variant="small-number">1,800</Text>} />
        </Piece>
        <Piece at={{ top: 152, start: 44 }} enter={POP.delay(450)}>
          <Circle size={30}><Check size={16} color="#222E29" strokeWidth={3} /></Circle>
        </Piece>
      </>
    );
  if (slide === 'reminders')
    return (
      <>
        <Piece at={{ top: 8, start: 0, width: 230, height: 150 }} tilt={-4} enter={rise(0)}>
          <View className="h-[150px] w-[230px] items-center justify-center rounded-nav bg-white" style={{ boxShadow: shadows.elevated }}>
            <Image source={vehicleArt('sedan')} contentFit="contain" style={{ width: 190, height: 100 }} />
          </View>
        </Piece>
        <Piece at={{ top: 150, end: 0, width: 280 }} tilt={3} enter={rise(3)}>
          <Item icon={Droplets} tone="amber" title={tt('service')} subtitle={tt('due', '1,200')} chevron={false} />
        </Piece>
        <Piece at={{ top: 0, end: 20 }} tilt={12} enter={POP.delay(350)}>
          <Circle size={64}><Bell size={28} color="#222E29" /></Circle>
        </Piece>
      </>
    );
  const rows: [LucideIcon, string, string, ViewStyle, number][] = [
    [Droplets, tt('oil'), '42,300', { top: 56, start: 0 }, -2],
    [Disc, tt('brakes'), '38,900', { top: 118, end: 0 }, 2],
    [Wrench, tt('battery'), '35,100', { top: 180, start: 12 }, -1],
  ];
  return (
    <>
      {rows.map(([icon, title, km, at, tilt], i) => (
        <Piece key={title} at={{ ...at, width: 270 }} tilt={tilt} enter={rise(i * 2)}>
          <Item icon={icon} title={title} subtitle={tt('km', km)} chevron={false} />
        </Piece>
      ))}
      <Piece at={{ top: 0, end: 8 }} tilt={5} enter={POP.delay(300)}>
        <View className="flex-row items-center gap-2 rounded-full bg-lime px-4 py-3" style={{ boxShadow: shadows.glow }}>
          <ShieldCheck size={18} color="#222E29" />
          <Text variant="label" className="text-[#222E29]">{tt('verified')}</Text>
        </View>
      </Piece>
      <Piece at={{ top: 240, end: 16 }} tilt={-4} enter={POP.delay(450)}>
        <Pill icon={Share2} text={tt('share')} dark />
      </Piece>
    </>
  );
}

/** Active dot is longer; slides in with the pager (decisions Q57). */
function Dot({ on }: { on: boolean }) {
  const still = useReducedMotion();
  return (
    <Animated.View
      className={`h-2 rounded-full ${on ? 'bg-ink' : 'bg-line'}`}
      style={{ width: on ? 24 : 8, transitionProperty: still ? 'none' : 'width', transitionDuration: '250ms', transitionTimingFunction: EASE_OUT }}
    />
  );
}

// First screen after the language: three swipeable slides of real app pieces, then a guest session so the car comes first (Q87).
export default function IntroScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState([0]); // slides whose pieces have entered; they stay on screen afterwards
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const placed = useRef(false);
  const last = index === SLIDES.length - 1;

  // Viewability gives the slide's index whatever the scroll direction, so Arabic (right to left) needs no special maths.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const i = viewableItems[0]?.index;
    if (!placed.current || i == null) return;
    setIndex(i);
    setSeen((s) => (s.includes(i) ? s : [...s, i]));
  });

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await continueAsGuest(); // the gate sees the new user and opens car setup
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  const next = () => (last ? start() : list.current?.scrollToIndex({ index: index + 1 }));

  const illo = Math.round(height * 0.56);
  const scale = Math.min(1, illo / STAGE.h, (width - 16) / STAGE.w);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="h-12 items-end justify-center px-6" style={{ opacity: last ? 0 : 1 }}>
        <PressableScale accessibilityRole="button" disabled={last || busy} onPress={start} className="px-2 py-2">
          <Text variant="label" className="text-muted">{t('onboarding.intro.skip')}</Text>
        </PressableScale>
      </View>
      <View className="flex-1" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 ? (
          <FlatList
            ref={list}
            horizontal
            pagingEnabled
            bounces={false}
            data={SLIDES}
            keyExtractor={(s) => s}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            viewabilityConfig={VIEWABLE}
            onViewableItemsChanged={onViewable}
            // A plain horizontal list can open at the far end in Arabic (same fix as add-vehicle).
            onContentSizeChange={() => {
              if (placed.current) return;
              list.current?.scrollToOffset({ offset: 0, animated: false });
              placed.current = true;
            }}
            renderItem={({ item: slide, index: i }) => (
              <View style={{ width, height }}>
                <View className="items-center justify-center" style={{ height: illo }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <View style={{ width: STAGE.w, height: STAGE.h, transform: [{ scale }] }}>
                    {seen.includes(i) ? <Collage slide={slide} /> : null}
                  </View>
                </View>
                <View className="gap-3 px-6 pt-4">
                  <Text variant="title">{t(`onboarding.intro.${slide}.title`)}</Text>
                  <Text className="text-muted">{t(`onboarding.intro.${slide}.body`)}</Text>
                </View>
              </View>
            )}
          />
        ) : null}
      </View>
      <View className="gap-4 px-6 pb-2 pt-4">
        <View className="h-2 flex-row items-center justify-center gap-2">
          {SLIDES.map((s, i) => <Dot key={s} on={i === index} />)}
        </View>
        {error ? <Note tone="warning" text={error} /> : null}
        <Button title={t(last ? 'onboarding.intro.start' : 'onboarding.intro.next')} onPress={next} loading={busy} />
        <PressableScale accessibilityRole="link" disabled={busy} onPress={() => router.push('/login')} className="items-center py-2">
          <Text variant="label" className="text-teal">{t('onboarding.intro.haveAccount')}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
