import { useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OdometerDial } from '@/components/OdometerDial';
import { OdometerRuler } from '@/components/OdometerRuler';
import { OdometerScanner } from '@/components/OdometerScanner';
import { RollingNumber } from '@/components/RollingNumber';
import { useLightStatusBar } from '@/components/Hero';
import { Button, Header, PressableScale, Text } from '@/components/ui';
import { useAppBarHero } from '@/lib/appBar';
import { errorText } from '@/lib/errors';
import { easeOut } from '@/lib/motion';
import { maxJump } from '@/lib/odometerScan';
import { useCurrentVehicle, useVehicle, type Vehicle } from '@/lib/queries';
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
  const insets = useSafeAreaInsets();
  const onHero = useAppBarHero();
  useLightStatusBar();
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

  const since = first ? 0 : delta;
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      {/* Layout B, the cockpit: one dark card holds the back button, the dial with the reading in it, and the ruler. */}
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4" alwaysBounceVertical={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View onLayout={onHero} className="gap-2 rounded-b-[36px] bg-panel px-6 pb-2" style={{ paddingTop: insets.top + 8 }}>
          <View className="h-11 flex-row items-center gap-3">
            <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
              {I18nManager.isRTL ? <ChevronRight size={22} color={c.onpanel} /> : <ChevronLeft size={22} color={c.onpanel} />}
            </PressableScale>
            <Text variant="title" className="text-onpanel">{t('odometer.header')}</Text>
          </View>
          <View className="items-center">
            <OdometerDial shown={shown} from={first ? undefined : vehicle.current_odometer}>
              <View className="items-center rounded-field border border-[#D3F53D59] bg-[#101713] px-2 py-1">
                {typing == null ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('odometer.label')}: ${reading.toLocaleString('en-US')}`} onPress={() => setTyping('')}>
                    <RollingNumber shown={shown} count={String(reading).length} size="sm" color="#FFFFFF" />
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
                    className="h-[34px] p-0"
                    style={{ fontFamily: 'Poppins_700Bold', fontSize: 28, textAlign: 'center', color: '#D3F53D', width: 130 }}
                  />
                )}
              </View>
            </OdometerDial>
          </View>
          {/* Fixed height so the dial and ruler do not jump when the chip appears. */}
          <View className="h-8 items-center justify-center">
            {lower ? (
              <View className="rounded-full bg-[#FFE5EB] px-3 py-1"><Text variant="caption" className="text-[#AC2846]">{t('errors.lowerReading')}</Text></View>
            ) : since > 0 ? (
              <View className={`rounded-full px-3 py-1 ${since >= 1500 ? 'bg-[#FFE5EB]' : 'bg-lime'}`}>
                <Text variant="caption" className={since >= 1500 ? 'text-[#AC2846]' : 'text-[#222E29]'} style={{ writingDirection: 'ltr' }}>+{since.toLocaleString('en-US')} {shortUnit}</Text>
              </View>
            ) : null}
          </View>
          <View className="-mx-6">
            <OdometerRuler shown={shown} segment={unit === 'h' ? 100 : 1000} max={MAX} dark />
          </View>
        </View>

        <Text variant="caption" className="px-6 text-center text-muted">
          {first ? t('odometer.first') : days > 0 ? t('odometer.last', { value: last, unit: shortUnit, count: days }) : t('odometer.lastToday', { value: last, unit: shortUnit })}
        </Text>
        {error ? <Text variant="caption" className="px-6 text-center text-danger">{error}</Text> : null}
      </ScrollView>
      <View className="gap-2 px-6 pb-4 pt-2">
        <PressableScale accessibilityRole="button" onPress={() => setScanning(true)} className="h-[52px] flex-row items-center justify-center gap-2 rounded-field bg-white" style={{ boxShadow: shadows.card }}>
          <Camera size={20} color={c.ink} />
          <Text variant="label" className="text-ink">{t('odometer.scan.row')}</Text>
        </PressableScale>
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
