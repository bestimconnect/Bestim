import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OdometerRuler } from '@/components/OdometerRuler';
import { OdometerScanner } from '@/components/OdometerScanner';
import { RollingNumber } from '@/components/RollingNumber';
import { Button, Header, Item, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { easeOut } from '@/lib/motion';
import { maxJump } from '@/lib/odometerScan';
import { useCurrentVehicle, useVehicle, type Vehicle } from '@/lib/queries';
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

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Header title={t('odometer.header')} />
        <Text variant="caption" className="text-muted">
          {first ? t('odometer.first') : days > 0 ? t('odometer.last', { value: last, unit: shortUnit, count: days }) : t('odometer.lastToday', { value: last, unit: shortUnit })}
        </Text>

        <View className="items-center gap-1 pt-4">
          {typing == null ? (
            // Tapping the number starts a fresh one: typing is the quiet fallback to the slider and the camera.
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
              placeholder={reading.toLocaleString('en-US')}
              placeholderTextColor={c.line}
              className="h-[60px] self-stretch p-0 text-ink"
              style={{ fontFamily: 'Poppins_700Bold', fontSize: 52, textAlign: 'center' }}
            />
          )}
          <Text variant="caption" className="text-muted">{shortUnit}</Text>
        </View>

        <View className="-mx-6">
          <OdometerRuler shown={shown} segment={unit === 'h' ? 100 : 1000} max={MAX} />
        </View>
        {/* The arrows show the gesture, not a reading direction, so they keep their sides in Arabic. */}
        <View className="items-center justify-center gap-2" style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}>
          <ArrowLeft size={14} color={c.muted} />
          <Text variant="caption" className="text-muted">{t('odometer.swipe')}</Text>
          <ArrowRight size={14} color={c.muted} />
        </View>

        {lower ? (
          <Text variant="caption" className="text-center text-danger">{t('errors.lowerReading')}</Text>
        ) : !first && delta > 0 ? (
          <View className="flex-row items-center justify-center gap-2">
            <TrendingUp size={16} color={c.teal} />
            <Text variant="caption" className="text-teal">{t('odometer.since', { value: delta.toLocaleString('en-US'), unit: shortUnit })}</Text>
          </View>
        ) : null}

        <Item icon={Camera} tone="sky" title={t('odometer.scan.row')} subtitle={t('odometer.scan.rowSub')} onPress={() => setScanning(true)} />

        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button title={t('odometer.cta')} onPress={() => save()} loading={saving} disabled={lower} />
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
    </SafeAreaView>
  );
}

export default function UpdateOdometerScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const current = useCurrentVehicle().vehicle;
  const vehicle = useVehicle(vehicleId).vehicle ?? current;
  return vehicle ? <Form vehicle={vehicle} /> : <SafeAreaView className="flex-1 bg-paper px-6"><Header title="" /></SafeAreaView>;
}
