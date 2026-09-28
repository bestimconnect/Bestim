import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Choice, Header, Progress, Text } from '@/components/ui';
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
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('onboarding.addVehicle.odometer.header')} />
        <Progress step={2} total={3} />
        <Text variant="title">{t('onboarding.addVehicle.odometer.title')}</Text>
        {/* Design keeps km/hours in a fixed order in both languages (docs/decisions.md Q5) —
            Choice's own flex-row would otherwise mirror under RTL, so force ltr here only. */}
        <View style={{ direction: 'ltr' }}>
          <Choice
            value={draft.odometerUnit}
            onChange={(v) => draft.set({ odometerUnit: v })}
            options={(['km', 'h'] as const).map((unit) => ({ value: unit, label: t(`onboarding.addVehicle.odometer.unitName.${unit}`) }))}
          />
        </View>
        <View className="gap-1 rounded-item bg-lime p-4">
          <Text variant="caption" className="text-[#222E29]" style={{ opacity: 0.7 }}>
            {t('onboarding.addVehicle.odometer.label')}
          </Text>
          <Controller
            control={control}
            name="odometer"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                className="p-0 text-number text-[#222E29]"
                style={{ fontFamily: 'Poppins_700Bold' }}
              />
            )}
          />
          {errors.odometer ? (
            <Text variant="caption" className="text-[#222E29]">{t('onboarding.addVehicle.odometer.invalid')}</Text>
          ) : (
            <Text variant="caption" className="text-[#222E29]" style={{ opacity: 0.7 }}>
              {t(`onboarding.addVehicle.odometer.unit.${draft.odometerUnit}`)}
            </Text>
          )}
        </View>
        <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.odometer.body')}</Text>
        <View className="gap-1 rounded-field bg-sky p-4">
          <Text variant="label">{t('onboarding.addVehicle.odometer.equipmentTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.odometer.equipmentBody')}</Text>
        </View>
        <View className="flex-1" />
        <Button title={t('onboarding.addVehicle.odometer.cta')} onPress={handleSubmit(onSubmit)} />
      </View>
    </SafeAreaView>
  );
}
