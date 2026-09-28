import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Progress, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useVehicleDraft } from '@/stores/vehicleDraft';
import type { Tables } from '@/types/database';

// Screen 05 — Add vehicle / First log, Figma 167:57486 (ar-light) / 167:65132 (en-light).
// Figma's actual CTAs here are "Log it by voice" / "Log it later" (routes into the separate voice-
// logging flow, screens 13/14). Those screens are out of scope for this task, so this instead
// follows the task's own Behaviour spec: pick a service type, optional cost, Finish/Skip that
// inserts the vehicle + log and completes onboarding — with generic finish/skip button copy.
export default function FirstLogScreen() {
  const { t, i18n } = useTranslation();
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
            is_primary: true,
          })
          .select()
          .single();
        if (vehicleError) throw vehicleError;
        return data;
      }

      if (!skipLog && d.serviceTypeId) {
        const serviceType = serviceTypes.data?.find((s) => s.id === d.serviceTypeId);
        const { error: logError } = await supabase.from('maintenance_logs').insert({
          vehicle_id: vehicle.id,
          service_type_id: d.serviceTypeId,
          title: serviceType ? (i18n.language === 'ar' ? serviceType.name_ar : serviceType.name_en) : '',
          odometer_reading: d.currentOdometer,
          cost: d.serviceCost ?? undefined,
          service_date: d.serviceDate ?? undefined,
          source: 'manual',
        });
        if (logError) throw logError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      draft.reset();
      router.replace('/');
    },
    onError: (e: Error) => setError(e.message),
  });

  const selectService = (item: Tables<'service_types'>) => {
    draft.set({ serviceTypeId: draft.serviceTypeId === item.id ? null : item.id });
  };

  return (
    <View className="flex-1 gap-5 bg-paper p-6">
      <Header title={t('onboarding.addVehicle.firstLog.header')} />
      <Progress step={3} total={3} />
      <Text variant="title">{t('onboarding.addVehicle.firstLog.title')}</Text>
      <Text className="text-muted">{t('onboarding.addVehicle.firstLog.body')}</Text>
      {error ? <Note tone="warning" text={error} /> : null}
      <FlatList
        data={serviceTypes.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2.5"
        renderItem={({ item }) => (
          <Item
            title={i18n.language === 'ar' ? item.name_ar : item.name_en}
            tone={draft.serviceTypeId === item.id ? 'mint' : 'paper'}
            chevron={false}
            onPress={() => selectService(item)}
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
      <Button title={t('onboarding.addVehicle.firstLog.finish')} onPress={() => finish.mutate(false)} loading={finish.isPending} />
      <Text variant="caption" className="text-center text-muted" onPress={() => finish.mutate(true)}>
        {t('onboarding.addVehicle.firstLog.skip')}
      </Text>
    </View>
  );
}
