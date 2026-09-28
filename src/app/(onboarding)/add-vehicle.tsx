import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Field, Header, Progress, Text } from '@/components/ui';
import { useVehicleDraft } from '@/stores/vehicleDraft';

const currentYear = new Date().getFullYear();
const schema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().regex(/^\d{4}$/).refine((v) => Number(v) >= 1970 && Number(v) <= currentYear + 1),
});
type FormValues = z.infer<typeof schema>;

// Screen 03 — Add vehicle / Info, Figma 167:57360 (ar-light) / 167:65006 (en-light).
// The design also shows a full-width field ("Field / اسمها عندك", ~"what you call it") and a
// compact chooser ("اختيار") above the make/model/year fields — their real purpose (plate number?
// vehicle type?) wasn't identifiable from the metadata layer names alone (no screenshot available,
// Figma MCP quota exhausted), so they're left out here; make/model/year are the fields the task spec
// explicitly calls for.
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
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
      <Header title={t('onboarding.addVehicle.info.header')} />
      <Progress step={1} total={3} />
      <Text variant="title">{t('onboarding.addVehicle.info.title')}</Text>
      <View className="gap-4">
        <Controller
          control={control}
          name="make"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label={t('onboarding.addVehicle.info.make')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.make ? t('onboarding.addVehicle.info.required') : undefined}
            />
          )}
        />
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
              error={errors.year ? t('onboarding.addVehicle.info.yearInvalid') : undefined}
            />
          )}
        />
      </View>
      <Button title={t('onboarding.addVehicle.info.cta')} onPress={handleSubmit(onSubmit)} />
    </ScrollView>
  );
}
