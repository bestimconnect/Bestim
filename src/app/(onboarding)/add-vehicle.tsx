import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, CalendarDays, Car, CarFront, Check, Tag } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OdometerScanner } from '@/components/OdometerScanner';
import { Button, Field, Header, Item, Note, PressableScale, Rise, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { POP, SWAP } from '@/lib/motion';
import { useCarCatalog } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';
import { useVehicleDraft, VEHICLE_TYPES, type VehicleType } from '@/stores/vehicleDraft';

const nextYear = new Date().getFullYear() + 1;
const years = Array.from({ length: nextYear - 1970 + 1 }, (_, i) => String(nextYear - i)); // newest first

/** A picker row: the name in the app language, the other language underneath (left out when both are the same, like "86"). */
const option = (o: { id: string; name_en: string; name_ar: string }, ar: boolean) => ({
  id: o.id,
  label: ar ? o.name_ar : o.name_en,
  hint: o.name_ar === o.name_en ? undefined : ar ? o.name_en : o.name_ar,
});

// Add car on one screen (stage 3, 2026-10-12): brand → model → year open one after another from the catalog list
// (the owner types only when the car is missing), the odometer sits below, one button saves the car and opens Home.
const CHAIN_DELAY = 350; // let the closing picker finish before the next one opens
export default function AddVehicleInfoScreen() {
  const { t, i18n } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const c = useColors();
  const draft = useVehicleDraft();
  const catalog = useCarCatalog().data ?? [];
  const types = useRef<FlatList<VehicleType>>(null);
  const placed = useRef(false);
  const ar = i18n.language === 'ar';
  const extra = mode === 'extra';
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  const created = useRef<string | null>(null); // a retry after a half-failed save reuses the car instead of adding another
  const [odometer, setOdometer] = useState('');
  const [scanning, setScanning] = useState(false);

  // The draft keeps the English names; the rows show the catalog name in the app language (a typed car shows as typed).
  const brand = catalog.find((b) => b.name_en === draft.make);
  const model = brand?.car_models.find((m) => m.id === draft.carModelId);
  const known = !!draft.model;

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
      if (extra) router.dismissTo('/vehicles');
      else router.replace('/');
      draft.reset();
    },
  });

  const makeLabel = brand && ar ? brand.name_ar : draft.make;
  const modelLabel = model && ar ? model.name_ar : draft.model;
  const choose = t('onboarding.addVehicle.info.choose');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
        <Header title={t(mode === 'extra' ? 'vehicles.add' : 'onboarding.addVehicle.info.header')} />
        <Text variant="title">{t('onboarding.addVehicle.info.title')}</Text>
        <Rise>
          <View className="h-[150px] items-center justify-center rounded-item bg-white" style={{ boxShadow: shadows.soft }}>
            {known ? (
              // The picture pops in once a model is chosen; the inner one is keyed by type so a corrected type fades in.
              <Animated.View entering={POP} className="w-full items-center">
                <Animated.View key={draft.vehicleType} entering={SWAP} className="w-full items-center">
                  <Image source={vehicleArt(draft.vehicleType)} contentFit="contain" style={{ width: '80%', height: 100 }} />
                </Animated.View>
                <Text variant="label">{`${makeLabel} ${modelLabel}`}</Text>
              </Animated.View>
            ) : (
              <CarFront size={56} color={c.muted} />
            )}
          </View>
        </Rise>
        <View className="gap-3">
          <Item icon={Car} title={makeLabel || choose} subtitle={t('onboarding.addVehicle.info.make')} onPress={pickBrand} />
          <View style={{ opacity: draft.make ? 1 : 0.5 }}>
            <Item icon={Tag} title={modelLabel || choose} subtitle={t('onboarding.addVehicle.info.model')} disabled={!draft.make} onPress={() => pickModel()} />
          </View>
          {/* Picture cards per type (decisions Q52), only for a car typed by hand: a catalog model brings its own type. -mx-6 lets the row scroll edge to edge. */}
          {known && !draft.carModelId ? (
          <View className="gap-2">
            <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.info.typeLabel')}</Text>
            {/* FlatList, not ScrollView: a plain horizontal ScrollView opens at the far end in Arabic. */}
            <FlatList
              ref={types}
              horizontal
              data={VEHICLE_TYPES}
              extraData={draft.vehicleType}
              keyExtractor={(type) => type}
              showsHorizontalScrollIndicator={false}
              className="-mx-6"
              contentContainerClassName="gap-3 px-6 py-1"
              onContentSizeChange={() => {
                if (placed.current) return;
                placed.current = true;
                types.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              renderItem={({ item: type }) => {
                const selected = draft.vehicleType === type;
                return (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => draft.set({ vehicleType: type })}
                    className={`w-[132px] items-center gap-1 rounded-item border-2 bg-white p-2 ${selected ? 'border-ink' : 'border-white'}`}
                    style={{ boxShadow: shadows.soft }}>
                    <Image source={vehicleArt(type)} contentFit="contain" style={{ width: 112, height: 56 }} />
                    <Text variant="caption" className={selected ? '' : 'text-muted'}>{t(`onboarding.addVehicle.info.type.${type}`)}</Text>
                    {selected ? (
                      <View className="absolute end-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full bg-lime">
                        <Check size={12} color="#222E29" strokeWidth={3} />
                      </View>
                    ) : null}
                  </PressableScale>
                );
              }}
            />
          </View>
          ) : null}
          <Item icon={CalendarDays} title={draft.year ? String(draft.year) : choose} subtitle={t('onboarding.addVehicle.info.year')} onPress={pickYear} />
          <View className="flex-row items-center gap-3">
            <Field
              className="flex-1"
              label={`${t('onboarding.addVehicle.odometer.label')} · ${t('onboarding.addVehicle.odometer.unit.km')}`}
              value={odometer}
              // Arabic-Indic digits become Latin, everything else but digits is dropped (same as the record sheet).
              onChangeText={(v) => setOdometer(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('odometer.scan.row')}
              onPress={() => setScanning(true)}
              className="h-14 w-14 items-center justify-center rounded-field bg-sky">
              <Camera size={22} color={c.teal} />
            </PressableScale>
          </View>
          <Text variant="caption" className="-mt-1 text-muted">{t('onboarding.addVehicle.odometer.later')}</Text>
          <Field
            label={t('onboarding.addVehicle.info.nickname')}
            value={draft.nickname}
            onChangeText={(v) => draft.set({ nickname: v })}
          />
        </View>
        {save.error ? <Note tone="warning" text={errorText(save.error)} /> : null}
        <Button
          title={t('onboarding.addVehicle.info.cta')}
          disabled={!draft.make || !draft.model || !draft.year}
          loading={save.isPending}
          onPress={() => !save.isPending && save.mutate(odometer ? Number(odometer) : null)}
        />
      </ScrollView>
      {scanning ? (
        // No reading on file yet, so the scanner offers what it sees and the owner checks it here before saving.
        <OdometerScanner
          unit={t('onboarding.addVehicle.odometer.unit.km')}
          confirmLabel={t('odometer.scan.use')}
          onConfirm={(v) => {
            setScanning(false);
            setOdometer(String(v));
          }}
          onType={() => setScanning(false)}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
