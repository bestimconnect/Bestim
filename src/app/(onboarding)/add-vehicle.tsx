import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Field, Header, PressableScale, Progress, Text } from '@/components/ui';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt, vehicleIcons } from '@/lib/vehicleArt';
import { useVehicleDraft, VEHICLE_TYPES, type VehicleType } from '@/stores/vehicleDraft';

const currentYear = new Date().getFullYear();
const schema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().regex(/^\d{4}$/).refine((v) => Number(v) >= 1970 && Number(v) <= currentYear + 1),
});
type FormValues = z.infer<typeof schema>;

// Screen 03 — Add vehicle / Info, Figma 167:57360 (ar-light) / 167:65006 (en-light).
export default function AddVehicleInfoScreen() {
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const c = useColors();
  const draft = useVehicleDraft();
  const types = useRef<FlatList<VehicleType>>(null);
  const placed = useRef(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { make: draft.make, model: draft.model, year: draft.year ? String(draft.year) : '' },
  });

  const onSubmit = (values: FormValues) => {
    draft.set({ make: values.make, model: values.model, year: Number(values.year) });
    router.push({ pathname: '/add-odometer', params: { mode } });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
        <Header title={t('onboarding.addVehicle.info.header')} />
        <Progress step={1} total={3} />
        <Text variant="title">{t('onboarding.addVehicle.info.title')}</Text>
        <View className="gap-4">
          <Field
            label={t('onboarding.addVehicle.info.nickname')}
            value={draft.nickname}
            onChangeText={(v) => draft.set({ nickname: v })}
          />
          {/* Picture cards per type (decisions Q52); -mx-6 lets the row scroll edge to edge. */}
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
                const Icon = vehicleIcons[type];
                return (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => draft.set({ vehicleType: type })}
                    className={`w-[132px] items-center gap-1 rounded-item border-2 bg-white p-2 ${selected ? 'border-ink' : 'border-white'}`}
                    style={{ boxShadow: shadows.soft }}>
                    {vehicleArt[type] ? (
                      <Image source={vehicleArt[type]} contentFit="contain" style={{ width: 112, height: 56 }} />
                    ) : (
                      <View className="h-14 items-center justify-center"><Icon size={32} color={c.muted} /></View>
                    )}
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
          <View className="flex-row gap-3">
            <Controller
              control={control}
              name="year"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('onboarding.addVehicle.info.year')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  maxLength={4}
                  className="flex-1"
                  error={errors.year ? t('onboarding.addVehicle.info.yearInvalid') : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="make"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={t('onboarding.addVehicle.info.make')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  className="flex-1"
                  error={errors.make ? t('onboarding.addVehicle.info.required') : undefined}
                />
              )}
            />
          </View>
          <Controller
            control={control}
            name="model"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label={t('onboarding.addVehicle.info.model')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.model ? t('onboarding.addVehicle.info.required') : undefined}
              />
            )}
          />
        </View>
        <Button title={t('onboarding.addVehicle.info.cta')} onPress={handleSubmit(onSubmit)} />
      </ScrollView>
    </SafeAreaView>
  );
}
