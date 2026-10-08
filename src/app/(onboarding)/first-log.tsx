import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Disc, Droplets, Wrench } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Progress, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { shouldAskNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settingsStore';
import { useVehicleDraft } from '@/stores/vehicleDraft';

// Screen 05 — Add vehicle / First log, Figma 167:57486 (ar-light) / 167:65132 (en-light).
// Design shows 3 buckets, each mapped to one service_types row by name_en (docs/decisions.md Q3).
const BUCKETS = [
  { name_en: 'Oil Change', key: 'oil', icon: Droplets },
  { name_en: 'Brake Pad Replacement', key: 'brakes', icon: Disc },
  { name_en: 'General Repair', key: 'tiresBattery', icon: Wrench },
] as const;

export default function FirstLogScreen() {
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'extra' }>(); // 'extra' = adding another vehicle from screen 08
  const extra = mode === 'extra';
  const draft = useVehicleDraft();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const serviceTypes = useQuery({
    queryKey: ['service_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_types').select('*').order('category');
      if (error) throw error;
      return data;
    },
  });

  const buckets = BUCKETS.map((b) => ({
    ...b,
    serviceType: serviceTypes.data?.find((s) => s.name_en === b.name_en),
  })).filter((b) => b.serviceType);

  const createdVehicle = useRef<{ id: string } | null>(null);
  const finish = useMutation({
    mutationFn: async (skipLog: boolean) => {
      const d = useVehicleDraft.getState();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user.id;

      // Reuse the vehicle from a failed earlier attempt so a retry doesn't duplicate it.
      const vehicle = createdVehicle.current ?? (await insertVehicle());
      createdVehicle.current = vehicle;

      async function insertVehicle() {
        const { data, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            make: d.make,
            model: d.model,
            year: d.year!,
            current_odometer: d.currentOdometer ?? 0,
            odometer_unit: d.odometerUnit,
            nickname: d.nickname || null,
            vehicle_type: d.vehicleType,
            is_primary: !extra,
          })
          .select()
          .single();
        if (vehicleError) throw vehicleError;
        return data;
      }

      if (!skipLog && d.serviceTypeId) {
        const bucket = buckets.find((b) => b.serviceType?.id === d.serviceTypeId);
        const { error: logError } = await supabase.from('maintenance_logs').insert({
          vehicle_id: vehicle.id,
          service_type_id: d.serviceTypeId,
          title: bucket ? t(`onboarding.addVehicle.firstLog.buckets.${bucket.key}.label`) : '',
          odometer_reading: d.currentOdometer,
          cost: d.serviceCost ?? undefined,
          service_date: d.serviceDate ?? undefined,
          source: 'manual',
        });
        if (logError) throw logError;
      }

      if (!extra) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', userId);
        if (profileError) throw profileError;
      }
      return { id: vehicle.id, logged: !skipLog && !!d.serviceTypeId, serviceTypeId: d.serviceTypeId };
    },
    onSuccess: ({ id: vehicleId, logged, serviceTypeId }) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      useSettings.getState().setCurrentVehicle(vehicleId);
      draft.reset();
      // Q41: no log saved with the vehicle → "Your vehicle is with us" (44); the voice path goes straight to capture.
      // A log saved with the vehicle gets the same ending as any log: permission once (45), then success (43).
      if (extra) router.dismissTo('/vehicles');
      else router.replace('/');
      if (voiceNext.current) router.push('/capture/voice');
      else if (logged)
        shouldAskNotifications().then((ask) =>
          router.push({ pathname: ask ? '/notify-permission' : '/success', params: { kind: 'log', vehicleId, ...(serviceTypeId ? { serviceTypeId } : {}) } }),
        );
      else router.push({ pathname: '/success', params: { kind: 'vehicle', vehicleId } });
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const selectService = (id: string) => {
    draft.set({ serviceTypeId: draft.serviceTypeId === id ? null : id });
  };

  // "Log it later" finishes onboarding without a log. "Log it by voice" runs the same finish
  // (logging whatever is selected here, if anything), then hands off to the voice capture flow.
  const voiceNext = useRef(false);
  const logLater = () => {
    voiceNext.current = false;
    finish.mutate(true);
  };
  const logByVoice = () => {
    voiceNext.current = true;
    finish.mutate(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('onboarding.addVehicle.firstLog.header')} />
        <Progress step={3} total={3} />
        <Text variant="title">{t('onboarding.addVehicle.firstLog.title')}</Text>
        <Text className="text-muted">{t('onboarding.addVehicle.firstLog.body')}</Text>
        {error ? <Note tone="warning" text={error} /> : null}
        <FlatList
          data={buckets}
          keyExtractor={(b) => b.key}
          contentContainerClassName="gap-2.5"
          renderItem={({ item: b }) => (
            <Item
              icon={b.icon}
              title={t(`onboarding.addVehicle.firstLog.buckets.${b.key}.label`)}
              subtitle={t(`onboarding.addVehicle.firstLog.buckets.${b.key}.subtitle`)}
              tone={draft.serviceTypeId === b.serviceType?.id ? 'mint' : 'paper'}
              onPress={() => selectService(b.serviceType!.id)}
            />
          )}
        />
        {draft.serviceTypeId ? (
          <Field
            label={t('onboarding.addVehicle.firstLog.cost')}
            value={draft.serviceCost ? String(draft.serviceCost) : ''}
            onChangeText={(v) => draft.set({ serviceCost: v ? Number(v) : null })}
            keyboardType="decimal-pad"
          />
        ) : null}
        <Button title={t('onboarding.addVehicle.firstLog.finish')} onPress={logByVoice} loading={finish.isPending} />
        <Button title={t('onboarding.addVehicle.firstLog.skip')} variant="secondary" onPress={logLater} disabled={finish.isPending} />
      </View>
    </SafeAreaView>
  );
}
