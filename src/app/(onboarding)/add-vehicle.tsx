import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Choice, Field, Header, Progress, Text } from '@/components/ui';
import { useVehicleDraft, VEHICLE_TYPES } from '@/stores/vehicleDraft';

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
  const draft = useVehicleDraft();
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { make: draft.make, model: draft.model, year: draft.year ? String(draft.year) : '' },
  });

  const onSubmit = (values: FormValues) => {
    draft.set({ make: values.make, model: values.model, year: Number(values.year) });
    router.push('/add-odometer');
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
          <Choice
            value={draft.vehicleType}
            onChange={(v) => draft.set({ vehicleType: v })}
            options={VEHICLE_TYPES.map((type) => ({ value: type, label: t(`onboarding.addVehicle.info.type.${type}`) }))}
          />
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
