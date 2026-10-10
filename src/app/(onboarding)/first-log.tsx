import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Disc, Droplets, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Item, Note, Progress, Rise, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { shouldAskNotifications } from '@/lib/notifications';
import { useIsGuest, useServiceTypes, useVehicle } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Screen 05 — Add vehicle / First log, Figma 167:57486 (ar-light) / 167:65132 (en-light).
// The car is already saved (odometer step, Q87); this only adds an optional first record to it.
// Design shows 3 buckets (docs/decisions.md Q3), each the first active service of one subcategory of the record tree.
const BUCKETS = [
  { sub: 'Engine oil', key: 'oil', icon: Droplets },
  { sub: 'Pads & discs', key: 'brakes', icon: Disc },
  { sub: 'Repairs', key: 'tiresBattery', icon: Wrench },
] as const;

export default function FirstLogScreen() {
  const { t } = useTranslation();
  const { mode, vehicleId } = useLocalSearchParams<{ mode?: 'extra'; vehicleId: string }>(); // 'extra' = adding another vehicle from screen 08
  const extra = mode === 'extra';
  const guest = useIsGuest();
  const queryClient = useQueryClient();
  const { vehicle } = useVehicle(vehicleId);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [cost, setCost] = useState('');

  const serviceTypes = useServiceTypes();
  const buckets = BUCKETS.map((b) => ({ ...b, serviceType: serviceTypes.data?.find((s) => s.subcategory?.name_en === b.sub) })).filter((b) => b.serviceType);

  // Q41: no log → "Your vehicle is with us" (44); a log gets the same ending as any log: permission once (45), then success (43).
  // The voice path goes straight to capture.
  const done = (how: 'later' | 'voice' | 'logged') => {
    if (extra) router.dismissTo('/vehicles');
    else router.replace('/');
    if (how === 'voice') router.push('/capture/voice');
    else if (how === 'logged')
      shouldAskNotifications().then((ask) =>
        router.push({ pathname: ask ? '/notify-permission' : '/success', params: { kind: 'log', vehicleId, serviceTypeId: serviceTypeId! } }),
      );
    else router.push({ pathname: '/success', params: { kind: 'vehicle', vehicleId } });
  };

  const save = useMutation({
    mutationFn: async () => {
      const bucket = buckets.find((b) => b.serviceType?.id === serviceTypeId);
      const { error } = await supabase.from('maintenance_logs').insert({
        vehicle_id: vehicleId,
        service_type_id: serviceTypeId!,
        title: bucket ? t(`onboarding.addVehicle.firstLog.buckets.${bucket.key}.label`) : '',
        odometer_reading: vehicle?.current_odometer,
        cost: cost ? Number(cost) : undefined,
        source: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      done('logged');
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
        <View className="h-14 justify-center">
          <Progress step={3} total={3} />
        </View>
        <Text variant="title">{t('onboarding.addVehicle.firstLog.title')}</Text>
        <Text className="text-muted">{t('onboarding.addVehicle.firstLog.body')}</Text>
        {save.error ? <Note tone="warning" text={errorText(save.error)} /> : null}
        <View className="gap-2.5">
          {buckets.map((b, i) => (
            <Rise key={b.key} index={i}>
              <Item
                icon={b.icon}
                title={t(`onboarding.addVehicle.firstLog.buckets.${b.key}.label`)}
                subtitle={t(`onboarding.addVehicle.firstLog.buckets.${b.key}.subtitle`)}
                tone={serviceTypeId === b.serviceType?.id ? 'mint' : 'paper'}
                onPress={() => setServiceTypeId(serviceTypeId === b.serviceType!.id ? null : b.serviceType!.id)}
              />
            </Rise>
          ))}
        </View>
        {serviceTypeId ? (
          <Field label={t('onboarding.addVehicle.firstLog.cost')} value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        ) : null}
        {serviceTypeId ? (
          <Button title={t('onboarding.addVehicle.firstLog.save')} onPress={() => save.mutate()} loading={save.isPending} />
        ) : guest ? null : ( // voice logging needs a full account (Q17)
          <Button title={t('onboarding.addVehicle.firstLog.finish')} onPress={() => done('voice')} />
        )}
        <Button
          title={t('onboarding.addVehicle.firstLog.skip')}
          variant={serviceTypeId || !guest ? 'secondary' : 'primary'}
          onPress={() => done('later')}
          disabled={save.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
