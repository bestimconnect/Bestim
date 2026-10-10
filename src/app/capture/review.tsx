import { onlineManager, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Note, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { shouldAskNotifications } from '@/lib/notifications';
import { useServiceTypes } from '@/lib/queries';
import { cleanDetails, SAVE_LOG_KEY, type SaveLogInput } from '@/lib/saveLog';
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
  const d = useLogDraft();
  const serviceType = useServiceTypes().data?.find((s) => s.id === d.serviceTypeId);
  const [error, setError] = useState<string | null>(null);

  const reminds = !!serviceType?.has_reminder;
  const details = cleanDetails(d.details, serviceType?.fields ?? []);
  const intervalKm = reminds ? d.intervalKm ?? serviceType?.default_interval_km ?? null : null;
  const months = reminds ? serviceType?.default_interval_months ?? null : null;
  const nextParts = [
    intervalKm != null && d.odometer != null ? `${n(d.odometer + intervalKm)} ${t('capture.review.km')}` : null,
    months != null ? t('capture.review.months', { n: months }) : null,
  ].filter(Boolean);
  // Blank "Next maintenance after" means the service's default (Q90): say so.
  const next = nextParts.length ? nextParts.join(' / ') + (d.intervalKm == null ? ` · ${t('log.standard')}` : '') : '—';
  const date = format(new Date(`${d.serviceDate}T00:00:00`), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS });
  const voice = d.source === 'voice';

  // Shared mutation (src/lib/saveLog.ts): offline it pauses, is persisted, and is sent on reconnect (Q45).
  const save = useMutation<{ id: string; status: string }, Error, SaveLogInput>({ mutationKey: SAVE_LOG_KEY });

  // Q39: ask for notifications once, after the first saved log; then the success screen (Q40).
  const done = async (offline: boolean, params: Record<string, string>) => {
    const ask = await shouldAskNotifications();
    const p: Record<string, string> = {
      kind: 'log',
      vehicleId: d.vehicleId!,
      ...(d.serviceTypeId ? { serviceTypeId: d.serviceTypeId } : {}),
      ...(d.odometer != null ? { odo: String(d.odometer) } : {}),
      ...(intervalKm != null ? { km: String(intervalKm) } : {}),
      ...(months != null ? { months: String(months) } : {}),
      date: d.serviceDate,
      ...(offline ? { offline: '1' } : {}),
      ...(offline && d.photoUri ? { nophoto: '1' } : {}),
      ...params,
    };
    router.dismissAll();
    router.push({ pathname: ask ? '/notify-permission' : '/success', params: p });
  };

  const confirm = () => {
    setError(null);
    const input: SaveLogInput = {
      vehicleId: d.vehicleId!,
      serviceTypeId: d.serviceTypeId,
      title: d.title,
      odometer: d.odometer,
      cost: d.cost,
      serviceDate: d.serviceDate,
      location: d.location,
      notes: d.notes,
      source: d.source,
      transcript: d.transcript,
      parts: d.parts,
      intervalKm: reminds ? d.intervalKm : null,
      details,
      photoUri: d.photoUri,
    };
    if (!onlineManager.isOnline()) {
      save.mutate({ ...input, photoUri: null }); // Q45: a receipt photo needs a connection
      done(true, {});
      return;
    }
    save.mutate(input, {
      onSuccess: (log) => done(false, log.status === 'needs_review' ? { review: '1' } : {}),
      onError: (e) => setError(errorText(e)),
    });
  };

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
          {Object.entries(details).map(([f, v]) => (
            <Row key={f} label={t(`capture.fields.${f}`)} value={String(v)} />
          ))}
          <Row label={t('capture.review.next')} value={next} />
        </View>
        {voice ? (
          <View className="gap-2 rounded-item bg-amber p-4">
            <Text variant="label">{t('capture.review.noteTitle')}</Text>
            <Text variant="caption" className="text-muted">{t('capture.review.noteBody')}</Text>
          </View>
        ) : null}
        {error ? <Note tone="warning" text={error} /> : null}
        <Button title={t('capture.review.confirm')} onPress={confirm} loading={save.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
