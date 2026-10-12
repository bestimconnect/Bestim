import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Moon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { PartArt } from '@/components/PartArt';
import { PressableScale, Text } from '@/components/ui';
import type { Part } from '@/lib/queries';
import { lifeFraction, type PartStatus as Status } from '@/lib/parts';
import { shadows, useColors } from '@/lib/theme';

type ColorSet = ReturnType<typeof useColors>;
type State = 'ok' | 'soon' | 'overdue' | 'snoozed' | 'none';
/** The one state → fill colour mapping (lime / amber / coral / grey). */
export const stateColor = (c: ColorSet, state: State) => ({ ok: '#D3F53D', soon: '#FFB938', overdue: '#F96A83', snoozed: c.muted, none: c.line })[state];
// Words in a state colour must read on the light page.
const WORD = { ok: 'text-ink', soon: 'text-[#B7791F]', overdue: 'text-danger', snoozed: 'text-muted', none: 'text-muted' } as const;
const ART = { ok: 'ok', soon: 'soon', overdue: 'late', snoozed: 'ok', none: 'ok' } as const;

const partIntervalKm = (p: Part) => p.log.interval_km ?? p.serviceType.default_interval_km;
const left = (status: Status, intervalKm: number | null) => 1 - lifeFraction(status, intervalKm).used;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Everything a row or badge needs to know about a part. */
function look(c: ColorSet, part: Part) {
  const snoozed = !!part.snoozedUntil;
  const state: State = snoozed ? 'snoozed' : part.status.state;
  const late = state === 'overdue';
  const life = late ? 0 : left(part.status, partIntervalKm(part));
  return { snoozed, late, life, color: stateColor(c, state), word: WORD[state], art: ART[state], pct: `${Math.round(life * 100)}%` };
}

/** Home badge: a life ring (starts at 12 o'clock, never mirrored) round the picture, the name, the percentage (or "Late"). */
export function PartBadge({ part, name, unit, onPress }: { part: Part; name: string; unit: string; onPress: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const { late, life, color, word, art, pct } = look(c, part);
  const R = 28.5;
  const C = 2 * Math.PI * R;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${late ? t('partStatus.overdue') : pct}, ${partSub(t, part, unit)}`}
      scale={0.96}
      onPress={onPress}
      className="w-[76px] items-center gap-1">
      <View className="h-[62px] w-[62px] items-center justify-center">
        <Svg width={62} height={62} style={{ position: 'absolute' }}>
          <Circle cx={31} cy={31} r={R} stroke={c.line} strokeWidth={5} fill="none" />
          <Circle cx={31} cy={31} r={R} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={[Math.max(life, 0.04) * C, C]} rotation={-90} origin="31, 31" />
        </Svg>
        <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white">
          <PartArt nameEn={part.serviceType.name_en} size={32} state={art} />
        </View>
      </View>
      <Text variant="label" numberOfLines={2} className="h-8 text-center !text-[12px] !leading-[16px]">{name}</Text>
      <Text variant="label" className={`!text-[13px] !leading-[18px] ${word}`}>{late ? t('partStatus.overdue') : pct}</Text>
    </PressableScale>
  );
}

/** Reminders / car page row: the picture, the name with the distance under it, the percentage (or "Late"; a moon when snoozed). */
export function PartRow({ part, name, unit, onPress }: { part: Part; name: string; unit: string; onPress: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const { snoozed, late, art, word, pct } = look(c, part);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${snoozed ? t('partStatus.snoozed') : late ? t('partStatus.overdue') : pct}, ${partSub(t, part, unit)}`}
      scale={0.98}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[18px] bg-white px-3 py-2"
      style={{ boxShadow: shadows.soft }}>
      <PartArt nameEn={part.serviceType.name_en} size={28} state={art} />
      <View className="flex-1">
        <Text variant="label" numberOfLines={1}>{name}</Text>
        <Text variant="caption" numberOfLines={1} className="text-muted">{partSub(t, part, unit)}</Text>
      </View>
      {snoozed ? <Moon size={18} color={c.muted} /> : <Text variant="label" className={word}>{late ? t('partStatus.overdue') : pct}</Text>}
    </PressableScale>
  );
}

const ARC_PATH = 'M12 62A40 40 0 1 1 88 62';
const ARC = 40 * (2 * Math.PI - 2 * Math.asin(38 / 40)); // length of ARC_PATH

/** Row subtitle: just the number and unit ("800 km", "12 days", "3 days late"). */
export function partSub(t: TFunction, part: Part, unit: string) {
  const { by } = lifeFraction(part.status, partIntervalKm(part));
  const v = by === 'km' ? part.status.remainingKm : part.status.remainingDays;
  const text = `${Math.abs(Math.round(v ?? 0)).toLocaleString('en-US')} ${by === 'km' ? unit : t('partStatus.days')}`;
  return part.status.state === 'overdue' ? t('partStatus.late', { unit: text }) : text;
}

type Props = {
  status?: Status | null; // null/undefined = never logged for this car
  unit: string;
  intervalKm: number | null;
  snoozedUntil?: string | null;
  nameEn?: string | null; // picks the drawing
};

/** The "status picture": the part in a dashboard arc, one number, one line. */
export function PartStatus({ status, unit, intervalKm, snoozedUntil, nameEn }: Props) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { by } = status ? lifeFraction(status, intervalKm) : { by: 'km' as const };
  const state = snoozedUntil ? 'snoozed' : status ? status.state : 'none';
  const color = stateColor(c, state);
  const late = status?.state === 'overdue';
  const level = status ? (late ? 0 : left(status, intervalKm)) : null;
  const percent = level != null ? `${Math.round(level * 100)}%` : '';
  const value = status ? (by === 'km' ? status.remainingKm : status.remainingDays) : null;
  const words = t(late ? 'partStatus.late' : 'partStatus.left', { unit: by === 'km' ? unit : t('partStatus.days') });
  const number = value != null ? Math.abs(Math.round(value)).toLocaleString('en-US') : '';
  const until = snoozedUntil ? t('partStatus.until', { date: format(parseISO(snoozedUntil), 'd MMM', { locale: i18n.language === 'ar' ? ar : enUS }) }) : '';
  const word = t(`partStatus.${state}`);
  const label = !status ? undefined : snoozedUntil ? `${word} ${until}` : late ? `${word} ${number} ${words}` : `${percent} ${t('partStatus.life')} ${number} ${words}`;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (late) scale.value = withSequence(withTiming(1.04, { duration: 200 }), withTiming(1, { duration: 200 }));
  }, [late, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const still = useReducedMotion();
  const sweep = useSharedValue(0);
  const to = level != null ? Math.max(level, 0.04) : 0;
  useEffect(() => {
    sweep.value = still ? to : withTiming(to, { duration: 600 });
  }, [to, still, sweep]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: ARC * (1 - sweep.value) }));

  return (
    <View accessible accessibilityLabel={label} className="items-center gap-4">
      <View style={{ width: 226, height: 194 }} className="items-center justify-center">
        <Svg width={226} height={194} viewBox="0 0 100 86" style={{ position: 'absolute' }}>
          <Path d={ARC_PATH} stroke={c.line} strokeWidth={7} strokeLinecap="round" fill="none" />
          {status ? <AnimatedPath d={ARC_PATH} stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={[ARC, ARC]} animatedProps={arc} /> : null}
        </Svg>
        <Animated.View style={[pulse, { marginTop: 34 }]}>
          <PartArt nameEn={nameEn} size={128} state={snoozedUntil || !status ? 'ok' : late ? 'late' : status.state === 'soon' ? 'soon' : 'ok'} />
        </Animated.View>
      </View>
      {!status ? null : snoozedUntil ? (
        <View className="flex-row items-center gap-2">
          <Moon size={28} color={c.muted} />
          <Text variant="heading" className="text-muted">{until}</Text>
        </View>
      ) : late ? (
        <Text variant="number" className={`!text-[36px] !leading-[44px] ${WORD.overdue}`}>{word}</Text>
      ) : (
        <View className="flex-row items-baseline gap-2">
          <Text variant="number" className="!text-[56px] !leading-[64px]">{percent}</Text>
          <Text variant="label" className="text-muted">{t('partStatus.life')}</Text>
        </View>
      )}
      {status && !snoozedUntil ? <Text variant="caption" className="text-muted">{number} {words}</Text> : null}
    </View>
  );
}
