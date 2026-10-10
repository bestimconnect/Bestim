import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import { CircleAlert, CloudOff, LoaderCircle, Mic } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Item } from './ui';
import { useServiceTypes, useVehicles } from '@/lib/queries';
import { sheet } from '@/lib/sheet';
import { normalizeRecords } from '@/lib/voiceRecords';
import { dropVoice, processVoiceQueue } from '@/lib/voiceSend';
import { useLogDraft } from '@/stores/logDraft';
import { useVoiceBatch } from '@/stores/voiceBatch';
import { useVoiceQueue, type QueuedVoice } from '@/stores/voiceQueue';

/** Recordings made offline for this car (Q93): waiting, being written up, ready to review, or failed. Hidden when there are none. */
export function VoiceQueueCard({ vehicleId }: { vehicleId: string }) {
  const { t, i18n } = useTranslation();
  const items = useVoiceQueue((s) => s.items).filter((i) => i.vehicleId === vehicleId);
  const vehicles = useVehicles().data ?? [];
  const services = useServiceTypes().data ?? [];
  if (!items.length) return null;

  const review = (item: QueuedVoice) => {
    useLogDraft.getState().reset({ vehicleId: item.vehicleId, source: 'voice' });
    useVoiceBatch.getState().start(
      item.transcript ?? '',
      normalizeRecords(item.records, {
        vehicleIds: vehicles.map((v) => v.id),
        fallbackVehicleId: item.vehicleId,
        serviceNames: services.filter((s) => s.category_id).map((s) => s.name_en),
        today: new Date().toLocaleDateString('en-CA'),
      }),
      item.id,
    );
    router.push('/capture/review-all');
  };
  const manage = (item: QueuedVoice) =>
    sheet(t('voiceQueue.manageTitle'), item.status === 'failed' ? t(`voiceQueue.failed.${item.reason ?? 'ai'}`) : t('voiceQueue.waitingBody'), [
      ...(item.status === 'failed'
        ? [{ text: t('voiceQueue.retry'), onPress: () => (useVoiceQueue.getState().update(item.id, { status: 'waiting' }), processVoiceQueue()) }]
        : []),
      { text: t('voiceQueue.delete'), style: 'destructive' as const, onPress: () => dropVoice(item.id) },
      { text: t('back'), style: 'cancel' as const },
    ]);

  const when = (at: string) => format(parseISO(at), 'd MMM · p', { locale: i18n.language === 'ar' ? ar : enUS });
  return (
    <View className="gap-2">
      {items.map((item) => {
        const row = {
          waiting: { icon: CloudOff, tone: 'paper' as const, title: t('voiceQueue.waitingTitle') },
          sending: { icon: LoaderCircle, tone: 'sky' as const, title: t('voiceQueue.sendingTitle') },
          ready: { icon: Mic, tone: 'mint' as const, title: t('voiceQueue.readyTitle') },
          failed: { icon: CircleAlert, tone: 'blush' as const, title: t('voiceQueue.failedTitle') },
        }[item.status];
        return (
          <Item
            key={item.id}
            icon={row.icon}
            tone={row.tone}
            title={row.title}
            subtitle={when(item.createdAt)}
            chevron={item.status === 'ready'}
            disabled={item.status === 'sending'}
            onPress={() => (item.status === 'ready' ? review(item) : manage(item))}
          />
        );
      })}
    </View>
  );
}
