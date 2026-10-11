import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Field, Header, Item, Note, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useOnline } from '@/lib/online';
import { useLog, useServiceTypes } from '@/lib/queries';
import { cleanDetails, LOG_FIELDS } from '@/lib/saveLog';
import { pickOption } from '@/lib/sheet';
import { supabase } from '@/lib/supabase';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch } from '@/stores/voiceBatch';

// Screen 16 — Manual entry, PNG 16/إدخال سجل يدوياً. With ?logId it is the correction form (decisions Q19.1).
// With ?batch it edits one card of the voice review list and writes back instead of saving (Q69).
const NOTICES = { micDenied: 'capture.micDenied', aiFailed: 'capture.batch.aiFailed', dailyLimit: 'capture.batch.dailyLimit' } as const;
const num = (s: string) => (s.trim() && !isNaN(Number(s)) ? Number(s) : null);

export default function Manual() {
  const online = useOnline(); // Q45: a photo needs a connection
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { notice, logId, batch } = useLocalSearchParams<{ notice?: keyof typeof NOTICES; logId?: string; batch?: string }>();
  const d = useLogDraft();
  const all = useServiceTypes().data ?? [];
  const service = all.find((s) => s.id === d.serviceTypeId);
  const original = useLog(logId).data;
  const [odo, setOdo] = useState(d.odometer != null ? String(d.odometer) : '');
  const [cost, setCost] = useState(d.cost != null ? String(d.cost) : '');
  const [every, setEvery] = useState(d.intervalKm != null ? String(d.intervalKm) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ar = i18n.language === 'ar';
  const name = (x: { name_en: string; name_ar: string }) => (ar ? x.name_ar : x.name_en);
  const where = (s: (typeof all)[number], arabic = ar) => [s.parentCategory, s.subcategory].filter(Boolean).map((c) => (arabic ? c!.name_ar : c!.name_en)).join(' · ');
  const fields = (service?.fields ?? []).filter((f) => f in LOG_FIELDS);

  // Every active service. A retired one (Car Wash) still shows on the old logs that have it, but is never offered.
  const choose = () =>
    pickOption({
      title: t('capture.manual.serviceType'),
      allowCustom: false,
      options: all.filter((s) => s.category_id).map((s) => ({ id: s.id, label: name(s), hint: where(s), also: `${ar ? s.name_en : s.name_ar} ${where(s, !ar)}` })),
      onPick: ({ id }) => {
        const next = all.find((s) => s.id === id)!;
        const keep = Object.fromEntries(Object.entries(d.details).filter(([k]) => next.fields.includes(k)));
        d.set({ serviceTypeId: next.id, title: d.title.trim() ? d.title : name(next), details: keep, ...(next.has_reminder ? {} : { intervalKm: null }) });
        if (!next.has_reminder) setEvery('');
      },
    });

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
      intervalKm: original.interval_km,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOdo(original.odometer_reading != null ? String(original.odometer_reading) : '');
    setCost(original.cost != null ? String(original.cost) : '');
    setEvery(original.interval_km != null ? String(original.interval_km) : '');
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
        ...(num(every) != null ? { interval_km: num(every) } : {}),
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
    onError: (e: Error) => setError(errorText(e)),
  });

  const submit = () => {
    d.set({ odometer: num(odo), cost: num(cost), intervalKm: service?.has_reminder ? num(every) : null });
    if (correcting) return correct.mutate();
    if (!batch) return router.push('/capture/review');
    useVoiceBatch.getState().update(batch, {
      serviceType: service?.name_en ?? null,
      title: d.title.trim(),
      odometer: num(odo),
      cost: num(cost),
      date: d.serviceDate,
      location: d.location.trim(),
      notes: d.notes.trim(),
      photoUri: d.photoUri,
      intervalKm: service?.has_reminder ? num(every) : null,
      details: cleanDetails(d.details, service?.fields ?? []),
      error: undefined,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t(correcting ? 'capture.manual.correctionHeader' : 'capture.newRecord')} />
        {notice && NOTICES[notice] ? <Note tone="info" text={t(NOTICES[notice])} /> : null}
        <Field label={t('capture.manual.what')} value={d.title} onChangeText={(title) => d.set({ title })} />
        <Pressable onPress={choose} accessibilityRole="button" className="rounded-field border border-line bg-white px-4 py-3">
          <Text variant="caption" className="text-muted">{t('capture.manual.serviceType')}</Text>
          <Text>{service ? name(service) : '—'}</Text>
          {service?.category_id ? <Text variant="caption" className="text-muted">{where(service)}</Text> : null}
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
        {correcting
          ? null
          : fields.map((f) => (
              <Field
                key={f}
                label={t(`capture.fields.${f}`)}
                value={d.details[f] ?? ''}
                onChangeText={(v) => d.set({ details: { ...d.details, [f]: v } })}
                keyboardType={LOG_FIELDS[f]}
                placeholder={t('capture.manual.optional')}
              />
            ))}
        {service?.has_reminder ? (
          <Field
            label={t('capture.manual.interval')}
            value={every}
            onChangeText={setEvery}
            keyboardType="number-pad"
            placeholder={service.default_interval_km != null ? service.default_interval_km.toLocaleString('en-US') : t('capture.manual.optional')}
          />
        ) : null}
        {correcting ? (
          <Field label={t('capture.manual.reason')} value={reason} onChangeText={setReason} multiline />
        ) : (
          <Field
            label={t('capture.manual.notes')}
            value={d.notes}
            onChangeText={(notes) => d.set({ notes })}
            placeholder={t('capture.manual.optional')}
            multiline
          />
        )}
        {correcting ? null : (
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
          title={t(correcting ? 'capture.manual.saveCorrection' : batch ? 'capture.batch.doneEdit' : 'capture.manual.review')}
          onPress={submit}
          disabled={!valid}
          loading={correct.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
