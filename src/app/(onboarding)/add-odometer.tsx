import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Field, Header, Note, Progress, Text } from '@/components/ui';
import { useVehicleDraft } from '@/stores/vehicleDraft';

const schema = z.object({ odometer: z.string().regex(/^\d+$/) });
type FormValues = z.infer<typeof schema>;

// Screen 04 — Add vehicle / Odometer, Figma 167:57431 (ar-light) / 167:65077 (en-light).
export default function AddOdometerScreen() {
  const { t } = useTranslation();
  const draft = useVehicleDraft();
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { odometer: draft.currentOdometer != null ? String(draft.currentOdometer) : '' },
  });

  const onSubmit = (values: FormValues) => {
    draft.set({ currentOdometer: Number(values.odometer) });
    router.push('/first-log');
  };

  return (
    <View className="flex-1 gap-5 bg-paper p-6">
      <Header title={t('onboarding.addVehicle.odometer.header')} />
      <Progress step={2} total={3} />
      <Text variant="title">{t('onboarding.addVehicle.odometer.title')}</Text>
      <View className="flex-row gap-2">
        {(['km', 'mi'] as const).map((unit) => (
          <Pressable
            key={unit}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.odometerUnit === unit }}
            onPress={() => draft.set({ odometerUnit: unit })}
            className={`h-11 flex-1 items-center justify-center rounded-field border ${draft.odometerUnit === unit ? 'border-lime bg-mint' : 'border-line bg-white'}`}>
            <Text variant="label">{t(`onboarding.addVehicle.odometer.unit.${unit}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Controller
        control={control}
        name="odometer"
        render={({ field: { onChange, onBlur, value } }) => (
          <Field
            label={t('onboarding.addVehicle.odometer.label')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="number-pad"
            error={errors.odometer ? t('onboarding.addVehicle.odometer.invalid') : undefined}
          />
        )}
      />
      <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.odometer.body')}</Text>
      <Note tone="info" text={`${t('onboarding.addVehicle.odometer.equipmentTitle')} ${t('onboarding.addVehicle.odometer.equipmentBody')}`} />
      <View className="flex-1" />
      <Button title={t('onboarding.addVehicle.odometer.cta')} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}
