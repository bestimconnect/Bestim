import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { I18nManager, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { cleanVin, vinOk } from '@/lib/vin';
import { ColorPicker } from '@/components/ColorPicker';
import { PlateField, joinPlate } from '@/components/Plate';
import { OdometerScanner } from '@/components/OdometerScanner';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDone';
import { OdometerRuler } from '@/components/OdometerRuler';
import { RollingNumber } from '@/components/RollingNumber';
import { Button, Card, Field, Note, PressableScale, Text } from '@/components/ui';
import { upgradeOnLimitError } from '@/lib/entitlements';
import { errorText } from '@/lib/errors';
import { easeOut, SWAP } from '@/lib/motion';
import { useCarCatalog } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';
import { useVehicleDraft, type VehicleType } from '@/stores/vehicleDraft';

// The six types of the design grid (the draft also knows sports and van; a catalog model of those shows no tile selected).
const TILE_TYPES: VehicleType[] = ['sedan', 'suv', 'hatchback', 'coupe', 'convertible', 'pickup'];
const MAX_KM = 9_999_999;
const nextYear = new Date().getFullYear() + 1;
const years = Array.from({ length: nextYear - 1970 + 1 }, (_, i) => String(nextYear - i)); // newest first

/** A picker row: the name in the app language, the other language underneath (left out when both are the same, like "86"). */
const option = (o: { id: string; name_en: string; name_ar: string }, ar: boolean) => ({
  id: o.id,
  label: ar ? o.name_ar : o.name_en,
  hint: o.name_ar === o.name_en ? undefined : ar ? o.name_en : o.name_ar,
});

/** A tappable field in the design's look: small label above, the value under it. */
function Pick({ label, value, empty, onPress, className = '', off }: { label: string; value: string; empty: string; onPress: () => void; className?: string; off?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" disabled={off} onPress={onPress} className={`rounded-[18px] bg-white px-4 pb-3 pt-2.5 ${className}`} style={{ opacity: off ? 0.5 : 1 }}>
      <Text variant="caption" className="text-muted">{label}</Text>
      <Text className={`!text-[16px] ${value ? '' : 'text-muted'}`} numberOfLines={1}>{value || empty}</Text>
    </PressableScale>
  );
}

// Add car in two steps (v2): 1 Car type (picture tiles, then brand → model → year from the catalog list, which open one after another),
// 2 Odometer (big number, ruler, scan). Plate, colour, VIN and nickname wait under 'More details' on step 2. The last button saves the car.
const CHAIN_DELAY = 350; // let the closing picker finish before the next one opens
export default function AddVehicleInfoScreen() {
  const { t, i18n } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const c = useColors();
  const draft = useVehicleDraft();
  const catalog = useCarCatalog().data ?? [];
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<1 | 2>(1);
  const [more, setMore] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const shown = useSharedValue(0); // the odometer, shared with the rolling number and the ruler
  const [reading, setReading] = useState(0);
  const ar = i18n.language === 'ar';
  const extra = mode === 'extra';
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  const created = useRef<string | null>(null); // a retry after a half-failed save reuses the car instead of adding another
  const [scanning, setScanning] = useState(false);

  // The draft keeps the English names; the rows show the catalog name in the app language (a typed car shows as typed).
  const brand = catalog.find((b) => b.name_en === draft.make);
  const model = brand?.car_models.find((m) => m.id === draft.carModelId);
  useAnimatedReaction(
    () => Math.round(shown.value),
    (now, before) => {
      if (now !== before) runOnJS(setReading)(now);
    },
  );
  const rollTo = (v: number) => shown.set(withTiming(Math.min(MAX_KM, Math.max(0, v)), { duration: 250, easing: easeOut }));

  // Choosing a brand opens its models, choosing a model opens the years, until the car is complete; a later tap edits just that one.
  const pickYear = () =>
    pickOption({
      title: t('onboarding.addVehicle.info.year'),
      options: years.map((y) => ({ id: y, label: y })),
      allowCustom: false,
      onPick: ({ label }) => draft.set({ year: Number(label) }),
    });

  const pickModel = (b = brand) =>
    pickOption({
      title: t('onboarding.addVehicle.info.model'),
      options: (b?.car_models ?? []).map((m) => option(m, ar)),
      allowCustom: true,
      onPick: ({ id, label }) => {
        const m = b?.car_models.find((x) => x.id === id);
        draft.set(m ? { model: m.name_en, carModelId: m.id, vehicleType: m.body_type as VehicleType } : { model: label, carModelId: null });
        if (!useVehicleDraft.getState().year) setTimeout(pickYear, CHAIN_DELAY);
      },
    });

  const pickBrand = () =>
    pickOption({
      title: t('onboarding.addVehicle.info.make'),
      options: catalog.map((b) => option(b, ar)),
      allowCustom: true,
      onPick: ({ id, label }) => {
        const picked = catalog.find((b) => b.id === id);
        const make = picked?.name_en ?? label;
        const changed = make !== draft.make;
        if (changed) draft.set({ make, model: '', carModelId: null });
        if (changed || !draft.model) setTimeout(() => pickModel(picked), CHAIN_DELAY); // custom brand: the list opens with custom entry only
      },
    });

  const save = useMutation({
    onError: upgradeOnLimitError,
    mutationFn: async (km: number | null) => {
      if (!created.current) {
        const d = useVehicleDraft.getState();
        const { data, error } = await supabase
          .from('vehicles')
          .insert({
            make: d.make,
            model: d.model,
            car_model_id: d.carModelId,
            year: d.year!,
            current_odometer: km ?? 0,
            odometer_updated_at: km == null ? null : new Date().toISOString(), // null = no reading yet (Q105)
            odometer_unit: 'km',
            nickname: d.nickname || null,
            plate_number: joinPlate(d.plateLetters, d.plateDigits),
            color: d.color,
            vin: d.vin || null,
            vehicle_type: d.vehicleType,
            is_primary: !extra,
          })
          .select('id')
          .single();
        if (error) throw error;
        created.current = data.id;
      }
      if (!extra) {
        const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId!);
        if (error) throw error;
      }
      return created.current;
    },
    onSuccess: async (vehicleId) => {
      useSettings.getState().setCurrentVehicle(vehicleId);
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] }); // Home shows this car
      if (extra) router.dismissTo('/garage');
      else router.replace('/');
      draft.reset();
    },
  });

  const makeLabel = brand && ar ? brand.name_ar : draft.make;
  const modelLabel = model && ar ? model.name_ar : draft.model;
  const choose = t('onboarding.addVehicle.info.choose');
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const Arrow = I18nManager.isRTL ? ArrowLeft : ArrowRight;
  const tile = (width - 48 - 16) / 3;
  const canBack = step === 2 || router.canGoBack();
  const done = (km: number | null) => !save.isPending && save.mutate(km);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6 pt-3.5" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="h-[50px] flex-row items-center justify-between">
          {canBack ? (
            <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => (step === 2 ? setStep(1) : router.back())} className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white">
              <Back size={22} color={c.ink} />
            </PressableScale>
          ) : <View />}
          <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.step', { n: step })}</Text>
        </View>
        <View className="mt-3 h-1 overflow-hidden rounded-full bg-tick">
          <View className="h-full rounded-full bg-ink" style={{ width: step === 1 ? '50%' : '100%' }} />
        </View>
        <Animated.View key={step} entering={SWAP}>
          {step === 1 ? (
            <>
              <Text variant="title" className="mt-[18px] !text-[26px]">{t('onboarding.addVehicle.car.title')}</Text>
              <Text className="mt-0.5 text-muted">{t('onboarding.addVehicle.car.sub')}</Text>
              <View className="mt-4 flex-row flex-wrap gap-2">
                {TILE_TYPES.map((type) => {
                  const on = draft.vehicleType === type;
                  return (
                    <PressableScale
                      key={type}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => draft.set({ vehicleType: type })}
                      className="items-center rounded-[18px] bg-white px-1 py-2"
                      style={{ width: tile, boxShadow: on ? `0 0 0 2px ${c.ink}` : '0 0 0 1px rgba(0,0,0,0.03)' }}>
                      <Image source={vehicleArt(type)} contentFit="contain" style={{ width: '100%', aspectRatio: 2 }} />
                      <Text variant="caption" className="mt-0.5 !text-[12px]">{t(`onboarding.addVehicle.info.type.${type}`)}</Text>
                      {on ? (
                        <View className="absolute end-1.5 top-1.5 h-[18px] w-[18px] items-center justify-center rounded-full bg-ink">
                          <Check size={10} color={c.paper} strokeWidth={3} />
                        </View>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
              <Pick empty={choose} className="mt-3.5" label={t('onboarding.addVehicle.info.make')} value={makeLabel} onPress={pickBrand} />
              <View className="mt-[9px] flex-row gap-[9px]">
                <Pick empty={choose} className="flex-[1.4]" label={t('onboarding.addVehicle.info.model')} value={modelLabel} off={!draft.make} onPress={() => pickModel()} />
                <Pick empty={choose} className="flex-1" label={t('onboarding.addVehicle.info.year')} value={draft.year ? String(draft.year) : ''} onPress={pickYear} />
              </View>
              <View className="mt-4">
                <Button title={t('onboarding.addVehicle.info.next')} disabled={!draft.make || !draft.model || !draft.year} onPress={() => setStep(2)} icon={<Arrow size={18} color={c.onbtn} strokeWidth={2} />} />
              </View>
            </>
          ) : (
            <>
              <Text variant="title" className="mt-[18px] !text-[26px]">{t('onboarding.addVehicle.odo.title')}</Text>
              <Text className="mt-0.5 text-muted">{t('onboarding.addVehicle.odo.sub')}</Text>
              <Card className="mt-[18px] items-center gap-4 rounded-[24px] px-4 pb-4 pt-[22px]">
                <View className="flex-row items-center gap-1.5" style={{ direction: 'ltr' }}>
                  {typing == null ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.addVehicle.odometer.label')} onPress={() => setTyping('')}>
                      <RollingNumber shown={shown} count={String(reading).length} />
                    </Pressable>
                  ) : (
                    <TextInput
                      accessibilityLabel={t('onboarding.addVehicle.odometer.label')}
                      autoFocus
                      value={typing}
                      // Arabic-Indic digits become Latin, everything else but digits is dropped (same as the record sheet).
                      onChangeText={(v) => {
                        const digits = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '');
                        setTyping(digits);
                        if (digits) shown.set(Math.min(MAX_KM, Number(digits)));
                      }}
                      onBlur={() => setTyping(null)}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      inputAccessoryViewID={KEYBOARD_DONE_ID}
                      maxLength={7}
                      className="h-[68px] p-0"
                      style={{ fontFamily: 'Poppins_300Light', fontSize: 54, textAlign: 'center', color: c.ink, width: 250, fontVariant: ['tabular-nums'] }}
                      allowFontScaling={false}
                    />
                  )}
                  <Text className="!text-[20px] text-muted">{t('onboarding.addVehicle.odometer.unit.km')}</Text>
                </View>
                <View className="self-stretch"><OdometerRuler shown={shown} segment={1000} max={MAX_KM} /></View>
              </Card>
              <PressableScale accessibilityRole="button" onPress={() => setScanning(true)} className="mt-[9px] h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-white">
                <Camera size={18} color={c.ink} strokeWidth={1.8} />
                <Text className="!text-[14.5px]">{t('onboarding.addVehicle.odo.scan')}</Text>
              </PressableScale>
              <PressableScale accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore(!more)} className="mt-[9px] h-[52px] flex-row items-center justify-between rounded-full bg-white px-5">
                <Text className="!text-[14.5px] text-muted">{t('onboarding.addVehicle.info.sectionMore')}</Text>
                <ChevronDown size={18} color={c.muted} style={{ transform: [{ rotate: more ? '180deg' : '0deg' }] }} />
              </PressableScale>
              {more ? (
                <View className="mt-3 gap-3">
                  <Card className="gap-4 p-4">
                    <View className="gap-2">
                      <Text variant="caption" className="text-muted">{t('plate.label')}</Text>
                      <PlateField letters={draft.plateLetters} digits={draft.plateDigits} onChange={(l, d) => draft.set({ plateLetters: l, plateDigits: d })} />
                    </View>
                    <ColorPicker value={draft.color} onChange={(col) => draft.set({ color: col })} />
                  </Card>
                  <Field label={t('vehicles.vin.label')} value={draft.vin} onChangeText={(v) => draft.set({ vin: cleanVin(v) })} autoCapitalize="characters" autoCorrect={false} placeholder={t('vehicles.vin.hint')} error={vinOk(draft.vin) ? undefined : t('vehicles.vin.error')} />
                  <Field label={t('onboarding.addVehicle.info.nickname')} value={draft.nickname} onChangeText={(v) => draft.set({ nickname: v })} />
                </View>
              ) : null}
              {save.error && (save.error as { code?: string }).code !== '54000' ? <View className="mt-3"><Note tone="warning" text={errorText(save.error)} /></View> : null}
              <View className="mt-3.5">
                <Button title={t('onboarding.addVehicle.odo.done')} disabled={!vinOk(draft.vin)} loading={save.isPending} onPress={() => done(reading > 0 ? reading : null)} icon={<Arrow size={18} color={c.onbtn} strokeWidth={2} />} />
              </View>
              <PressableScale accessibilityRole="button" onPress={() => done(null)} className="mt-2.5 min-h-11 items-center justify-center">
                <Text className="!text-[13.5px] text-muted">{t('onboarding.addVehicle.odo.skip')}</Text>
              </PressableScale>
            </>
          )}
        </Animated.View>
      </ScrollView>
      {scanning ? (
        // No reading on file yet, so the scanner offers what it sees and the owner checks it here before saving.
        <OdometerScanner
          unit={t('onboarding.addVehicle.odometer.unit.km')}
          confirmLabel={t('odometer.scan.use')}
          onConfirm={(v) => {
            setScanning(false);
            rollTo(v);
          }}
          onType={() => setScanning(false)}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
