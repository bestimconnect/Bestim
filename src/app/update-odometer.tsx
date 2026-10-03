import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OdometerRuler } from '@/components/OdometerRuler';
import { OdometerScanner } from '@/components/OdometerScanner';
import { RollingNumber } from '@/components/RollingNumber';
import { Button, Field, Header, Item, Text } from '@/components/ui';
import { easeOut } from '@/lib/motion';
import { maxJump } from '@/lib/odometerScan';
import { useCurrentVehicle, type Vehicle } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

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
  const [scanned, setScanned] = useState<number | null>(null); // what the camera read; the note shows while it still stands
  const [reason, setReason] = useState('');
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

  const unit = vehicle.odometer_unit;
  const shortUnit = t(`home.${unit}`);
  const last = vehicle.current_odometer.toLocaleString('en-US');
  const delta = reading - vehicle.current_odometer;
  const lower = delta < 0;
  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));

  /** `value`: the camera's confirmed number saves straight away, before the rolling number has caught up. */
  const save = async (value = reading) => {
    const lower = value < vehicle.current_odometer;
    if (lower && reason.trim().length < 3) return setError(t('odometer.reasonHint'));
    setSaving(true);
    setError('');
    const { error: e1 } = await supabase.from('vehicles').update({ current_odometer: value }).eq('id', vehicle.id);
    const { error: e2 } = lower
      ? await supabase.from('maintenance_logs').insert({
          vehicle_id: vehicle.id,
          title: t('odometer.logTitle'),
          description: reason.trim(),
          odometer_reading: value,
          service_date: format(new Date(), 'yyyy-MM-dd'),
          source: 'manual',
          status: 'needs_review',
        })
      : { error: null };
    setSaving(false);
    if (e1 || e2) return setError(t('odometer.error'));
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
          {days > 0 ? t('odometer.last', { value: last, unit: shortUnit, count: days }) : t('odometer.lastToday', { value: last, unit: shortUnit })}
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

        {scanned === reading ? <Text variant="caption" className="text-center text-teal">{t('odometer.scan.read')}</Text> : null}

        {lower ? (
          <Field label={t('odometer.reason')} value={reason} onChangeText={setReason} placeholder={t('odometer.noteBody')} multiline />
        ) : delta > 0 ? (
          <View className="flex-row items-center justify-center gap-2">
            <TrendingUp size={16} color={c.teal} />
            <Text variant="caption" className="text-teal">{t('odometer.since', { value: delta.toLocaleString('en-US'), unit: shortUnit })}</Text>
          </View>
        ) : null}

        <Item icon={Camera} tone="sky" title={t('odometer.scan.row')} subtitle={t('odometer.scan.rowSub')} onPress={() => setScanning(true)} />

        {error ? <Text variant="caption" className="text-danger">{error}</Text> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button title={t('odometer.cta')} onPress={() => save()} loading={saving} />
      </View>
      {scanning ? (
        <OdometerScanner
          current={vehicle.current_odometer}
          jump={maxJump(unit, days)}
          unit={shortUnit}
          onConfirm={(v) => {
            setScanning(false);
            // A lower reading needs its reason first (Q19.2): it lands on the page instead of saving.
            if (v < vehicle.current_odometer) {
              setScanned(v);
              return rollTo(v);
            }
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
  const { vehicle } = useCurrentVehicle();
  return vehicle ? <Form vehicle={vehicle} /> : null;
}
