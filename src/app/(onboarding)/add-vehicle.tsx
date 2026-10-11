import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Car, CarFront, Check, Tag } from 'lucide-react-native';
import { useRef } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, PressableScale, Progress, Rise, Text } from '@/components/ui';
import { POP, SWAP } from '@/lib/motion';
import { useCarCatalog } from '@/lib/queries';
import { pickOption } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useVehicleDraft, VEHICLE_TYPES, type VehicleType } from '@/stores/vehicleDraft';

const nextYear = new Date().getFullYear() + 1;
const years = Array.from({ length: nextYear - 1970 + 1 }, (_, i) => String(nextYear - i)); // newest first

/** A picker row: the name in the app language, the other language underneath (left out when both are the same, like "86"). */
const option = (o: { id: string; name_en: string; name_ar: string }, ar: boolean) => ({
  id: o.id,
  label: ar ? o.name_ar : o.name_en,
  hint: o.name_ar === o.name_en ? undefined : ar ? o.name_en : o.name_ar,
});

// Screen 03: Add vehicle / Info (Figma 167:57360 ar-light / 167:65006 en-light), reworked 2026-10-10:
// brand, model and year come from the catalog list; the owner types only when the car is missing.
export default function AddVehicleInfoScreen() {
  const { t, i18n } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const c = useColors();
  const draft = useVehicleDraft();
  const catalog = useCarCatalog().data ?? [];
  const types = useRef<FlatList<VehicleType>>(null);
  const placed = useRef(false);
  const ar = i18n.language === 'ar';

  // The draft keeps the English names; the rows show the catalog name in the app language (a typed car shows as typed).
  const brand = catalog.find((b) => b.name_en === draft.make);
  const model = brand?.car_models.find((m) => m.id === draft.carModelId);
  const known = !!draft.model;

  const pickBrand = () =>
    pickOption({
      title: t('onboarding.addVehicle.info.make'),
      options: catalog.map((b) => option(b, ar)),
      allowCustom: true,
      onPick: ({ id, label }) => {
        const make = catalog.find((b) => b.id === id)?.name_en ?? label;
        if (make !== draft.make) draft.set({ make, model: '', carModelId: null });
      },
    });

  const pickModel = () =>
    pickOption({
      title: t('onboarding.addVehicle.info.model'),
      options: (brand?.car_models ?? []).map((m) => option(m, ar)),
      allowCustom: true,
      onPick: ({ id, label }) => {
        const m = brand?.car_models.find((x) => x.id === id);
        draft.set(m ? { model: m.name_en, carModelId: m.id, vehicleType: m.body_type as VehicleType } : { model: label, carModelId: null });
      },
    });

  const pickYear = () =>
    pickOption({
      title: t('onboarding.addVehicle.info.year'),
      options: years.map((y) => ({ id: y, label: y })),
      allowCustom: false,
      onPick: ({ label }) => draft.set({ year: Number(label) }),
    });

  const makeLabel = brand && ar ? brand.name_ar : draft.make;
  const modelLabel = model && ar ? model.name_ar : draft.model;
  const choose = t('onboarding.addVehicle.info.choose');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
        <Header title={t(mode === 'extra' ? 'vehicles.add' : 'onboarding.addVehicle.info.header')} />
        <Progress step={1} total={3} />
        <Text variant="title">{t('onboarding.addVehicle.info.title')}</Text>
        <Rise>
          <View className="h-[150px] items-center justify-center rounded-item bg-white" style={{ boxShadow: shadows.soft }}>
            {known ? (
              // The picture pops in once a model is chosen; the inner one is keyed by type so a corrected type fades in.
              <Animated.View entering={POP} className="w-full items-center">
                <Animated.View key={draft.vehicleType} entering={SWAP} className="w-full items-center">
                  <Image source={vehicleArt(draft.vehicleType)} contentFit="contain" style={{ width: '80%', height: 120 }} />
                </Animated.View>
              </Animated.View>
            ) : (
              <CarFront size={56} color={c.muted} />
            )}
          </View>
        </Rise>
        <View className="gap-3">
          <Item icon={Car} title={makeLabel || choose} subtitle={t('onboarding.addVehicle.info.make')} onPress={pickBrand} />
          <View style={{ opacity: draft.make ? 1 : 0.5 }}>
            <Item icon={Tag} title={modelLabel || choose} subtitle={t('onboarding.addVehicle.info.model')} disabled={!draft.make} onPress={pickModel} />
          </View>
          {/* Picture cards per type (decisions Q52), pre-selected from the model; -mx-6 lets the row scroll edge to edge. */}
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
          <Item icon={CalendarDays} title={draft.year ? String(draft.year) : choose} subtitle={t('onboarding.addVehicle.info.year')} onPress={pickYear} />
          <Field
            label={t('onboarding.addVehicle.info.nickname')}
            value={draft.nickname}
            onChangeText={(v) => draft.set({ nickname: v })}
          />
        </View>
        <Button
          title={t('onboarding.addVehicle.info.cta')}
          disabled={!draft.make || !draft.model || !draft.year}
          onPress={() => router.push({ pathname: '/add-odometer', params: { mode } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
