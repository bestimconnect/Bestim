import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Wrench, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Progress, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useVehicleDraft } from '@/stores/vehicleDraft';
import type { Tables } from '@/types/database';

// Screen 05 — Add vehicle / First log, Figma 167:57486 (ar-light) / 167:65132 (en-light).
// ponytail: the design groups items into 3 broad categories (Engine oil / Brakes / Tires &
// battery); this still lists the full `service_types` catalogue (18 rows) as before — regrouping
// would change the query/data shape beyond this task's CTA fix (issue #4), so it's left as-is.
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
            nickname: d.nickname || null,
            vehicle_type: d.vehicleType,
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

  // "Log it later" finishes onboarding without a log. "Log it by voice" runs the same finish
  // (logging whatever is selected here, if anything), then hands off to the voice capture flow.
  const logLater = () => finish.mutate(true);
  const logByVoice = () => finish.mutate(false, { onSuccess: () => router.replace('/capture') });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
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
              icon={(Icons as unknown as Record<string, LucideIcon>)[item.icon] ?? Wrench}
              title={i18n.language === 'ar' ? item.name_ar : item.name_en}
              tone={draft.serviceTypeId === item.id ? 'mint' : 'paper'}
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
        <Button title={t('onboarding.addVehicle.firstLog.finish')} onPress={logByVoice} loading={finish.isPending} />
        <Button title={t('onboarding.addVehicle.firstLog.skip')} variant="secondary" onPress={logLater} disabled={finish.isPending} />
      </View>
    </SafeAreaView>
  );
}
