import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Text } from '@/components/ui';
import { useOnline } from '@/lib/online';
import { useLog, useServiceTypes } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useLogDraft } from '@/stores/logDraft';

// Screen 16 — Manual entry, PNG 16/إدخال سجل يدوياً. With ?logId it is the correction form (decisions Q19.1).
const num = (s: string) => (s.trim() && !isNaN(Number(s)) ? Number(s) : null);

export default function Manual() {
  const online = useOnline(); // Q45: a photo needs a connection
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { notice, logId } = useLocalSearchParams<{ notice?: string; logId?: string }>();
  const d = useLogDraft();
  const types = useServiceTypes().data ?? [];
  const original = useLog(logId).data;
  const [odo, setOdo] = useState(d.odometer != null ? String(d.odometer) : '');
  const [cost, setCost] = useState(d.cost != null ? String(d.cost) : '');
  const [reason, setReason] = useState('');
  const [pickType, setPickType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (s: (typeof types)[number]) => (i18n.language === 'ar' ? s.name_ar : s.name_en);

  // Correction mode: prefill the draft from the log once it loads.
  useEffect(() => {
    if (!original || d.logId === original.id) return;
    d.reset({
      logId: original.id,
      vehicleId: original.vehicle_id,
      serviceTypeId: original.service_type_id,
      title: original.title,
      odometer: original.odometer_reading,
      cost: original.cost,
      serviceDate: original.service_date,
      location: original.location ?? '',
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOdo(original.odometer_reading != null ? String(original.odometer_reading) : '');
    setCost(original.cost != null ? String(original.cost) : '');
  }, [original]);

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(d.serviceDate) && !isNaN(Date.parse(d.serviceDate));
  const correcting = !!logId;
  const valid = d.title.trim().length > 0 && dateOk && (!correcting || (!!original && reason.trim().length >= 3));

  const attach = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) d.set({ photoUri: r.assets[0].uri });
  };

  const correct = useMutation({
    mutationFn: async () => {
      const o = original!;
      const next: Record<string, unknown> = {
        title: d.title.trim(),
        service_type_id: d.serviceTypeId,
        odometer_reading: num(odo),
        cost: num(cost),
        service_date: d.serviceDate,
        location: d.location.trim() || null,
      };
      const prev: Record<string, unknown> = { ...o, location: o.location || null };
      const changes = Object.fromEntries(
        Object.entries(next).filter(([k, v]) => v !== prev[k]).map(([k, v]) => [k, v == null ? null : String(v)]),
      );
      const { error } = await supabase.rpc('correct_log', { log_id: o.id, changes, reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log', logId] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = () => {
    d.set({ odometer: num(odo), cost: num(cost) });
    if (correcting) correct.mutate();
    else router.push('/capture/review');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t(correcting ? 'capture.manual.correctionHeader' : 'capture.newRecord')} />
        {notice === 'micDenied' ? <Note tone="info" text={t('capture.micDenied')} /> : null}
        <Field label={t('capture.manual.what')} value={d.title} onChangeText={(title) => d.set({ title })} />
        <Pressable onPress={() => setPickType(!pickType)} className="rounded-field border border-line bg-white px-4 py-3">
          <Text variant="caption" className="text-muted">{t('capture.manual.serviceType')}</Text>
          <Text>{types.find((s) => s.id === d.serviceTypeId) ? name(types.find((s) => s.id === d.serviceTypeId)!) : '—'}</Text>
          {pickType ? (
            <View className="flex-row flex-wrap gap-2 pt-3">
              {types.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    d.set({ serviceTypeId: s.id, title: d.title.trim() ? d.title : name(s) });
                    setPickType(false);
                  }}
                  className={`rounded-full px-3 py-1.5 ${s.id === d.serviceTypeId ? 'bg-lime' : 'bg-paper'}`}>
                  <Text variant="caption" className={s.id === d.serviceTypeId ? 'text-[#222E29]' : ''}>{name(s)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
        <View className="flex-row gap-4">
          <Field className="flex-1" label={t('capture.manual.odometer')} value={odo} onChangeText={setOdo} keyboardType="number-pad" />
          <Field className="flex-1" label={t('capture.manual.cost')} value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        </View>
        <Field
          label={t('capture.manual.date')}
          value={d.serviceDate}
          onChangeText={(serviceDate) => d.set({ serviceDate })}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={dateOk ? undefined : t('capture.manual.dateError')}
        />
        <Field
          label={t('capture.manual.workshop')}
          value={d.location}
          onChangeText={(location) => d.set({ location })}
          placeholder={t('capture.manual.optional')}
        />
        {correcting ? (
          <Field label={t('capture.manual.reason')} value={reason} onChangeText={setReason} multiline />
        ) : (
          <Item
            icon={Camera}
            tone="sky"
            title={t('capture.manual.attach')}
            subtitle={t(!online ? 'toast.photoOffline' : d.photoUri ? 'capture.manual.attached' : 'capture.manual.attachSub')}
            onPress={attach}
            disabled={!online}
            style={{ opacity: online ? 1 : 0.5 }}
          />
        )}
        {error ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <View className="px-6 pb-4 pt-2">
        <Button
          title={t(correcting ? 'capture.manual.saveCorrection' : 'capture.manual.review')}
          onPress={submit}
          disabled={!valid}
          loading={correct.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
