import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Note, Text } from '@/components/ui';
import { useServiceTypes } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useLogDraft } from '@/stores/logDraft';

// Screen 15 — Review before saving, PNG 15/مراجعة قبل الحفظ.
const n = (v: number) => v.toLocaleString('en-US');

function Row({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-3">
      <Text variant="caption" className="text-muted">{label}</Text>
      <Text variant="label" className={`flex-1 text-end ${teal ? 'text-teal' : ''}`}>{value}</Text>
    </View>
  );
}

export default function Review() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const d = useLogDraft();
  const serviceType = useServiceTypes().data?.find((s) => s.id === d.serviceTypeId);
  const [error, setError] = useState<string | null>(null);

  const intervalKm = d.intervalKm ?? serviceType?.default_interval_km ?? null;
  const months = serviceType?.default_interval_months ?? null;
  const next = [
    intervalKm != null && d.odometer != null ? `${n(d.odometer + intervalKm)} ${t('capture.review.km')}` : null,
    months != null ? t('capture.review.months', { n: months }) : null,
  ].filter(Boolean).join(' / ') || '—';
  const date = format(new Date(`${d.serviceDate}T00:00:00`), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS });
  const voice = d.source === 'voice';

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const photos: string[] = [];
      if (d.photoUri) {
        const path = `${userData.user.id}/${Date.now()}.jpg`;
        const body = await (await fetch(d.photoUri)).arrayBuffer();
        const { error: upError } = await supabase.storage.from('receipts').upload(path, body, { contentType: 'image/jpeg' });
        if (upError) throw upError;
        photos.push(path);
      }
      const { error: insertError } = await supabase.from('maintenance_logs').insert({
        vehicle_id: d.vehicleId!,
        service_type_id: d.serviceTypeId,
        title: d.title,
        odometer_reading: d.odometer,
        cost: d.cost,
        service_date: d.serviceDate,
        location: d.location || null,
        source: d.source,
        voice_transcript: d.transcript,
        parts_replaced: d.parts,
        interval_km: d.intervalKm,
        photos,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const vehicleId = d.vehicleId!;
      router.dismissAll();
      router.push({ pathname: '/history', params: { vehicleId, saved: '1' } }); // Q19.5: history shows the toast
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 p-6" keyboardShouldPersistTaps="handled" className="flex-1">
        <Header title={t('capture.review.header')} />
        <Text variant="title">{t('capture.review.title')}</Text>
        {voice && d.transcript ? (
          <View className="gap-2 rounded-item bg-sky p-4">
            <Text variant="label">{t('capture.review.fromVoice')}</Text>
            <Text variant="caption" className="text-muted">«{d.transcript}»</Text>
          </View>
        ) : null}
        <Item
          icon={Pencil}
          tone="paper"
          title={d.title}
          subtitle={t('capture.review.tapEdit')}
          onPress={() => router.push('/capture/manual')}
        />
        <View>
          <Row label={t('capture.review.odometer')} value={d.odometer != null ? `${n(d.odometer)} ${t('capture.review.km')}` : '—'} teal />
          <Row label={t('capture.review.cost')} value={d.cost != null ? `${n(d.cost)} ${t('capture.review.egp')}` : '—'} />
          <Row label={t(voice ? 'capture.review.suggestedDate' : 'capture.review.date')} value={date} />
          <Row label={t('capture.review.workshop')} value={d.location || t('capture.review.notMentioned')} />
          <Row label={t('capture.review.next')} value={next} />
        </View>
        {voice ? (
          <View className="gap-2 rounded-item bg-amber p-4">
            <Text variant="label">{t('capture.review.noteTitle')}</Text>
            <Text variant="caption" className="text-muted">{t('capture.review.noteBody')}</Text>
          </View>
        ) : null}
        {error ? <Note tone="warning" text={error} /> : null}
        <Button title={t('capture.review.confirm')} onPress={() => save.mutate()} loading={save.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
