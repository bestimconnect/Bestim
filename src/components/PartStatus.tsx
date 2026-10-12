import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Moon, Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { lifeFraction, type PartStatus as Status } from '@/lib/parts';
import { useColors } from '@/lib/theme';

const SIZE = 220;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const DOT = { ok: 'bg-teal', soon: 'bg-[#F2B33D]', overdue: 'bg-danger', snoozed: 'bg-muted', none: 'bg-muted' } as const;
const WORD = { ok: 'text-teal', soon: 'text-[#F2B33D]', overdue: 'text-danger', snoozed: 'text-muted', none: 'text-muted' } as const;

type Props = {
  status?: Status | null; // null/undefined = never logged for this car
  unit: string;
  intervalKm: number | null;
  snoozedUntil?: string | null;
};

/** The "status picture": one ring, one number, one coloured word. */
export function PartStatus({ status, unit, intervalKm, snoozedUntil }: Props) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { used, by } = status ? lifeFraction(status, intervalKm) : { used: 0, by: 'km' as const };
  const state = snoozedUntil ? 'snoozed' : status ? status.state : 'none';
  const color = { ok: c.teal, soon: '#F2B33D', overdue: c.danger, snoozed: c.muted, none: c.line }[state];
  const late = status?.state === 'overdue';
  const value = status ? (by === 'km' ? status.remainingKm : status.remainingDays) : null;
  const words = t(late ? 'partStatus.late' : 'partStatus.left', { unit: by === 'km' ? unit : t('partStatus.days') });
  const number = value != null ? Math.abs(Math.round(value)).toLocaleString('en-US') : '';
  const until = snoozedUntil ? t('partStatus.until', { date: format(parseISO(snoozedUntil), 'd MMM', { locale: i18n.language === 'ar' ? ar : enUS }) }) : '';
  const word = t(`partStatus.${state}`);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (late) scale.value = withSequence(withTiming(1.04, { duration: 200 }), withTiming(1, { duration: 200 }));
  }, [late, scale]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View accessible accessibilityLabel={[number, snoozedUntil ? until : number ? words : '', word].filter(Boolean).join(' ')} className="items-center gap-4">
      <Animated.View style={[{ width: SIZE, height: SIZE }, pulse]} className="items-center justify-center">
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={c.line} strokeWidth={STROKE} fill="none" strokeDasharray={status ? undefined : '10 12'} />
          {status ? (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={color}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C * used} ${C}`}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          ) : null}
        </Svg>
        {!status ? (
          <Plus size={72} color={c.muted} />
        ) : snoozedUntil ? (
          <>
            <Moon size={48} color={c.muted} />
            <Text variant="label" className="text-muted">{until}</Text>
          </>
        ) : (
          <>
            <Text variant="number" className="!text-[56px] !leading-[64px]">{number}</Text>
            <Text variant="label" className="text-muted">{words}</Text>
          </>
        )}
      </Animated.View>
      <View className="flex-row items-center gap-2">
        <View className={`h-3 w-3 rounded-full ${DOT[state]}`} />
        <Text variant="label" className={`${WORD[state]}`}>{word}</Text>
      </View>
    </View>
  );
}
