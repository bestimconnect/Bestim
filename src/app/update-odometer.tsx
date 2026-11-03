import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, Camera, Gauge, Wrench } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Nudge, Trend } from '@/components/OdometerExtras';
import { OdometerRuler } from '@/components/OdometerRuler';
import { OdometerScanner } from '@/components/OdometerScanner';
import { RollingNumber } from '@/components/RollingNumber';
import { Backdrop, Button, Card, FooterBar, Header, IconTile, PressableScale, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { easeOut } from '@/lib/motion';
import { dailyAverage, nextServiceIn } from '@/lib/odometerFacts';
import { maxJump } from '@/lib/odometerScan';
import { useCurrentVehicle, useOdometerReadings, useVehicle, useVehicleParts, type Vehicle } from '@/lib/queries';
import { hasReading } from '@/lib/reading';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';

const MAX = 9_999_999;

// Screen 25 — Update odometer (decisions Q19.2; slider + camera Q71). Voice lives in the + button (Q70).
function Form({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const still = useReducedMotion();
  // One moving value drives the rolling number and the ruler; `reading` is what it currently says, for React.
  const shown = useSharedValue(vehicle.current_odometer);
  const [reading, setReading] = useState(vehicle.current_odometer);
  const [typing, setTyping] = useState<string | null>(null); // the digits being typed; null = the rolling number shows
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useAnimatedReaction(
    () => Math.round(shown.value),
    (now, before) => {
      if (now !== before) runOnJS(setReading)(now);
    },
  );
  /** A typed or scanned value rolls into place (the one screen where a number counts: decisions Q71). */
  const rollTo = (v: number) => {
    const to = Math.min(MAX, Math.max(0, v));
    shown.set(still ? to : withTiming(to, { duration: 900, easing: easeOut }));
  };

  const first = !hasReading(vehicle); // Q105: the car was added without a reading, so nothing to compare against
  const unit = vehicle.odometer_unit;
  const shortUnit = t(`home.${unit}`);
  const last = vehicle.current_odometer.toLocaleString('en-US');
  const delta = reading - vehicle.current_odometer;
  const lower = !first && delta < 0;
  const avg = dailyAverage(useOdometerReadings(vehicle.id).data ?? []);
  const next = nextServiceIn(useVehicleParts(vehicle).parts, Math.max(0, delta));
  const days = vehicle.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : 0;

  /** `value`: the camera's confirmed number saves straight away, before the rolling number has caught up. */
  const save = async (value = reading) => {
    setSaving(true);
    setError('');
    const { error: e } = await supabase.from('vehicles').update(first ? { current_odometer: value, odometer_updated_at: new Date().toISOString() } : { current_odometer: value }).eq('id', vehicle.id);
    setSaving(false);
    if (e) return setError(errorText(e));
    qc.invalidateQueries({ queryKey: ['vehicles'] });
    qc.invalidateQueries({ queryKey: ['logs'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    router.back();
  };

  const fact = (v: number | null) => (v == null ? '—' : v.toLocaleString('en-US'));
  const tiles = [
    { icon: ArrowUp, tone: 'mint', text: fact(Math.max(0, delta)), label: t('odometer.facts.since') },
    { icon: Gauge, tone: 'sky', text: fact(avg), label: t('odometer.facts.avg') },
    { icon: Wrench, tone: 'amber', text: next === 0 ? t('odometer.facts.due') : fact(next), label: t(next === 0 ? 'odometer.facts.dueLabel' : 'odometer.facts.next') },
  ] as const;
  // The last readings, oldest first, ending with the number on screen now (so the chart moves as you swipe).
  // An odometer only goes up, so ordering by value is the true order (and does not depend on the saved dates).
  const history = (useOdometerReadings(vehicle.id).data ?? []).map((r) => r.reading).sort((a, b) => a - b).slice(-7);
  const trend = history.length >= 2 ? [...history.filter((v) => v < reading), reading] : [];

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Backdrop />
      <View className="px-6"><Header title={t('odometer.header')} /></View>
      {/* Q122/Q124: the reading and the dial in one card, the recent readings and the three facts under it, Save pinned at the bottom. */}
      <ScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 pb-4 pt-1" alwaysBounceVertical={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <Card className="gap-3 rounded-[28px] pb-4 pt-5">
          <Text variant="caption" className="text-center text-muted">{t('odometer.label')}</Text>
          <View className="items-center gap-1">
            {typing == null ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('odometer.label')}: ${reading.toLocaleString('en-US')}`} onPress={() => setTyping('')}>
                <RollingNumber shown={shown} count={String(reading).length} />
              </Pressable>
            ) : (
              <TextInput
                accessibilityLabel={t('odometer.label')}
                autoFocus
                value={typing}
                // Each digit goes straight into the reading (no roll), so Save is right even while the keyboard is still up.
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, '');
                  setTyping(digits);
                  if (digits) shown.set(Math.min(MAX, Number(digits)));
                }}
                onBlur={() => setTyping(null)}
                keyboardType="number-pad"
                returnKeyType="done"
                inputAccessoryViewID={KEYBOARD_DONE_ID}
                maxLength={7}
                className="h-[60px] p-0"
                style={{ fontFamily: 'Poppins_700Bold', fontSize: 52, textAlign: 'center', color: c.ink, width: 260 }}
              />
            )}
            <View className="h-7 flex-row items-center gap-2">
              <Text variant="caption" className="text-muted">{shortUnit}</Text>
              {!first && delta > 0 ? (
                <View className="flex-row items-center gap-1 rounded-full bg-lime px-3 py-1">
                  <ArrowUp size={12} color="#222E29" />
                  <Text variant="caption" className="text-[#222E29]">{t('odometer.since', { value: delta.toLocaleString('en-US'), unit: shortUnit })}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {/* The dial sits in a recessed window: the ticks are cut cleanly by its rounded ends, like a real gauge (no fading). */}
          <View className="mx-4 overflow-hidden rounded-[20px] bg-paper" style={{ boxShadow: 'inset 0 2px 6px rgba(16,24,20,0.10), inset 0 0 0 1px rgba(16,24,20,0.04)' }}>
            <View className="pt-3">
              <OdometerRuler shown={shown} segment={unit === 'h' ? 100 : 1000} max={MAX} />
            </View>
          </View>
          <View className="flex-row items-center justify-center gap-2 px-4" style={{ direction: 'ltr' }}>
            {[-10, -1, 1, 10].map((n) => <Nudge key={n} shown={shown} step={n} max={MAX} />)}
          </View>
          {/* a lower reading is refused: the reason sits right under the dial, where you are looking */}
          <Text variant="caption" className={`px-6 text-center ${lower ? 'text-danger' : 'text-muted'}`}>
            {lower ? t('errors.lowerReading') : first ? t('odometer.first') : days > 0 ? t('odometer.last', { value: last, unit: shortUnit, count: days }) : t('odometer.lastToday', { value: last, unit: shortUnit })}
          </Text>
        </Card>
        {trend.length >= 3 ? (
          <Card className="gap-2 p-4">
            <View className="flex-row items-center justify-between">
              <Text variant="label">{t('odometer.trend')}</Text>
              <Text variant="caption" className="text-muted">{trend[trend.length - 1].toLocaleString('en-US')} {shortUnit}</Text>
            </View>
            <Trend values={trend} />
          </Card>
        ) : null}
        {first ? null : (
          <Card className="flex-row py-4">
            {tiles.map(({ icon, tone, text, label }, i) => (
              <Fragment key={label}>
                {i ? <View className="w-px self-stretch bg-line" /> : null}
                <View className="flex-1 items-center gap-1.5 px-2">
                  <IconTile icon={icon} tone={tone} size={36} />
                  <Text variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{text}</Text>
                  <Text variant="caption" className="text-center text-muted" numberOfLines={2}>{label}</Text>
                </View>
              </Fragment>
            ))}
          </Card>
        )}
        {error ? <Text variant="caption" className="px-6 text-center text-danger">{error}</Text> : null}
      </ScrollView>
      <FooterBar>
        <View className="flex-row items-center gap-3">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('odometer.scan.row')} onPress={() => setScanning(true)} className="h-14 w-14 items-center justify-center rounded-full border border-line bg-white" style={{ boxShadow: shadows.lift }}>
            <Camera size={22} color={c.ink} />
          </PressableScale>
          <Button className="flex-1" title={t('odometer.cta')} onPress={() => save()} loading={saving} disabled={lower} />
        </View>
      </FooterBar>
      {scanning ? (
        <OdometerScanner
          current={first ? undefined : vehicle.current_odometer}
          jump={first ? undefined : maxJump(unit, days)}
          unit={shortUnit}
          onConfirm={(v) => {
            setScanning(false);
            // A lower reading is refused: it lands on the page, with the reason why, instead of saving.
            if (!first && v < vehicle.current_odometer) return rollTo(v);
            shown.set(v);
            save(v);
          }}
          onType={() => {
            setScanning(false);
            setTyping('');
          }}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function UpdateOdometerScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const vehicle = useVehicle(vehicleId).vehicle ?? current;
  return vehicle ? <Form vehicle={vehicle} /> : <SafeAreaView className="flex-1 bg-paper px-6"><Header title="" /></SafeAreaView>;
}
