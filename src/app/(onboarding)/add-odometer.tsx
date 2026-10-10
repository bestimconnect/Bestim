import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { OdometerScanner } from '@/components/OdometerScanner';
import { Button, Header, Item, Note, Progress, Rise, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useIsGuest } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { shadows } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';
import { useVehicleDraft } from '@/stores/vehicleDraft';

const schema = z.object({ odometer: z.string().regex(/^\d+$/) });
type FormValues = z.infer<typeof schema>;

// Screen 04 — Add vehicle / Odometer, Figma 167:57431 (ar-light) / 167:65077 (en-light).
// This step saves the car (Q87), so closing the app after it never leaves a half-made car or a second one.
export default function AddOdometerScreen() {
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const extra = mode === 'extra';
  const draft = useVehicleDraft();
  const userId = useSession()?.user.id;
  const guest = useIsGuest();
  const queryClient = useQueryClient();
  const created = useRef<string | null>(null); // a retry after a half-failed save reuses the car instead of adding another
  const [scanning, setScanning] = useState(false);
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { odometer: draft.currentOdometer != null ? String(draft.currentOdometer) : '' },
  });

  const save = useMutation({
    mutationFn: async (odometer: number) => {
      if (!created.current) {
        const d = useVehicleDraft.getState();
        const { data, error } = await supabase
          .from('vehicles')
          .insert({
            make: d.make,
            model: d.model,
            car_model_id: d.carModelId,
            year: d.year!,
            current_odometer: odometer,
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
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] }); // the next screen shows this car
      // First run as a guest: offer to keep the car safe. Everyone else goes on to the optional first record.
      if (guest && !extra) router.replace({ pathname: '/save-car', params: { vehicleId } });
      else router.replace({ pathname: '/first-log', params: { vehicleId, ...(extra ? { mode } : {}) } });
      draft.reset();
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('onboarding.addVehicle.odometer.header')} />
        <Progress step={2} total={3} />
        <Text variant="title">{t('onboarding.addVehicle.odometer.title')}</Text>
        <Rise>
          <View className="h-[110px] items-center justify-center rounded-item bg-white" style={{ boxShadow: shadows.soft }}>
            <Image source={vehicleArt(draft.vehicleType)} contentFit="contain" style={{ width: '70%', height: 90 }} />
          </View>
        </Rise>
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
              {t('onboarding.addVehicle.odometer.unit.km')}
            </Text>
          )}
        </View>
        <Text variant="caption" className="text-muted">{t('onboarding.addVehicle.odometer.body')}</Text>
        <Item icon={Camera} tone="sky" title={t('odometer.scan.row')} subtitle={t('odometer.scan.rowSub')} onPress={() => setScanning(true)} />
        {save.error ? <Note tone="warning" text={errorText(save.error)} /> : null}
        <View className="flex-1" />
        <Button
          title={t('onboarding.addVehicle.odometer.cta')}
          loading={save.isPending}
          onPress={handleSubmit(({ odometer }) => !save.isPending && save.mutate(Number(odometer)))}
        />
      </View>
      {scanning ? (
        // No reading on file yet, so the scanner offers what it sees and the owner checks it here before saving.
        <OdometerScanner
          unit={t('onboarding.addVehicle.odometer.unit.km')}
          confirmLabel={t('odometer.scan.use')}
          onConfirm={(v) => {
            setScanning(false);
            setValue('odometer', String(v), { shouldValidate: true });
          }}
          onType={() => setScanning(false)}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
