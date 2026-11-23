import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Nudge } from '@/components/OdometerExtras';
import { OdometerRuler } from '@/components/OdometerRuler';
import { OdometerScanner } from '@/components/OdometerScanner';
import { RollingNumber } from '@/components/RollingNumber';
import { Button, Kv, PressableScale, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { easeOut } from '@/lib/motion';
import { dailyAverage, nextServiceIn } from '@/lib/odometerFacts';
import { maxJump } from '@/lib/odometerScan';
import { useCurrentVehicle, useOdometerReadings, useVehicle, useVehicleParts, type Vehicle } from '@/lib/queries';
import { hasReading } from '@/lib/reading';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';

const MAX = 9_999_999;

// Screen 25 — Update odometer (decisions Q19.2; slider + camera Q71). Voice lives in the + button (Q70).
function Form({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const { bottom } = useSafeAreaInsets();
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
    shown.set(still ? to : withTiming(to, { duration: 250, easing: easeOut }));
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

  const fact = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('en-US')} ${shortUnit}`);
  const rows = [
    [t('odometer.facts.since'), fact(Math.max(0, delta))],
    [t('odometer.facts.avg'), avg == null ? '—' : `${avg.toLocaleString('en-US')} ${shortUnit}`],
    [t(next === 0 ? 'odometer.facts.dueLabel' : 'odometer.facts.next'), next === 0 ? t('odometer.facts.due') : fact(next)],
  ];

  return (
    <View className="bg-white px-5 pt-3" style={{ gap: 14, paddingBottom: bottom + 14 }}>
      <View className="h-1 w-[38px] self-center rounded-full bg-tick" />
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="title" className="shrink">{t('odometer.header')}</Text>
        <Text variant="caption" className="shrink text-right text-muted" numberOfLines={1}>
          {first ? '' : days > 0 ? t('odometer.upd', { count: days }) : t('odometer.updToday')}
        </Text>
      </View>
      <View className="gap-3 rounded-[20px] bg-paper px-4 pb-4 pt-5">
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
                const digits = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, ''); // Arabic digits too
                setTyping(digits);
                if (digits) shown.set(Math.min(MAX, Number(digits)));
              }}
              onBlur={() => setTyping(null)}
              keyboardType="number-pad"
              returnKeyType="done"
              inputAccessoryViewID={KEYBOARD_DONE_ID}
              maxLength={7}
              className="h-[68px] p-0"
              style={{ fontFamily: 'Poppins_300Light', fontSize: 54, textAlign: 'center', color: c.ink, width: 280, fontVariant: ['tabular-nums'] }}
              allowFontScaling={false}
            />
          )}
          <Text variant="caption" className="text-muted">{shortUnit}</Text>
        </View>
        <OdometerRuler shown={shown} segment={unit === 'h' ? 100 : 1000} max={MAX} />
      </View>
      <View className="flex-row items-center justify-center gap-2" style={{ direction: 'ltr' }}>
        {[-10, -1, 1, 10].map((n) => <Nudge key={n} shown={shown} step={n} max={MAX} />)}
      </View>
      {/* a lower reading is refused: the reason sits right under the dial, where you are looking */}
      {lower ? <Text variant="caption" className="text-center text-late">{t('errors.lowerReading')}</Text> : first ? <Text variant="caption" className="text-center text-muted">{t('odometer.first')}</Text> : null}
      {first ? null : (
        <View className="gap-0.5">
          {rows.map(([k, v]) => <Kv key={k} k={k} v={v} />)}
        </View>
      )}
      {error ? <Text variant="caption" className="text-center text-late">{error}</Text> : null}
      <View className="flex-row items-center gap-3">
        <PressableScale accessibilityRole="button" accessibilityLabel={t('odometer.scan.row')} onPress={() => setScanning(true)} className="h-[58px] w-[58px] items-center justify-center rounded-full bg-paper">
          <Camera size={22} color={c.ink} strokeWidth={1.8} />
        </PressableScale>
        <Button className="flex-1" title={t('odometer.cta')} onPress={() => save()} loading={saving} disabled={lower} />
      </View>
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
    </View>
  );
}

export default function UpdateOdometerScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const vehicle = useVehicle(vehicleId).vehicle ?? current;
  return vehicle ? <Form vehicle={vehicle} /> : <View className="h-40 bg-white" />;
}
