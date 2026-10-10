import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useLog } from '@/lib/queries';
import { LOG_FIELDS } from '@/lib/saveLog';
import { supabase } from '@/lib/supabase';

// Screen 18 — Record details. Banner per decisions Q12 (replaces "verified by service center").
export default function LogDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: log } = useLog(id);
  const corrections = useQuery({
    queryKey: ['log-corrections', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('log_corrections').select('id').eq('log_id', id);
      if (error) throw error;
      return data;
    },
  });
  const receipt = useQuery({
    queryKey: ['log-receipt', id, log?.photos[0]],
    enabled: !!log?.photos.length,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(log!.photos[0], 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!log) return <SafeAreaView className="flex-1 bg-paper" />;

  const banner =
    log.status === 'needs_review' ? { k: 'review', box: 'bg-amber' }
    : log.status === 'corrected' ? { k: 'corrected', box: 'bg-sky' }
    : { k: log.source === 'voice' ? 'voice' : 'manual', box: 'bg-mint' };
  const bannerBody = (
    <>
      <Text variant="label">{t(`log.${banner.k}Title`)}</Text>
      <Text variant="caption" className="text-muted">{t(`log.${banner.k}Body`)}</Text>
    </>
  );
  const parts = Array.isArray(log.parts_replaced)
    ? log.parts_replaced.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean).join(' + ')
    : '';
  const date = format(parseISO(log.service_date), 'd MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS });
  const st = log.service_types;
  const details = Object.entries((log.details ?? {}) as Record<string, string | number>).filter(([f, v]) => f in LOG_FIELDS && v !== '');
  const next = st?.has_reminder ? log.interval_km ?? st.default_interval_km : null;
  const rows: [string, string][] = [
    ...(st ? [[t('log.service'), i18n.language === 'ar' ? st.name_ar : st.name_en] as [string, string]] : []),
    [t('log.cost'), log.cost != null ? t('log.egp', { cost: log.cost.toLocaleString('en-US') }) : '—'],
    [t('log.parts'), parts || '—'],
    [t('log.workshop'), log.location || '—'],
    ...details.map(([f, v]) => [t(`capture.fields.${f}`), String(v)] as [string, string]),
    ...(next != null
      ? [[t('log.next'), `${t('log.review.km', { n: next.toLocaleString('en-US') })}${log.interval_km == null ? ` · ${t('log.standard')}` : ''}`] as [string, string]]
      : []),
  ];
  const count = corrections.data?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Header title={t('log.header')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4" showsVerticalScrollIndicator={false}>
        {log.status === 'needs_review' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/log/review-reading', params: { id } })}
            className={`gap-1 rounded-field p-4 active:opacity-80 ${banner.box}`}>
            {bannerBody}
          </Pressable>
        ) : (
          <View className={`gap-1 rounded-field p-4 ${banner.box}`}>{bannerBody}</View>
        )}
        <Text variant="title">{log.title}</Text>
        <Text variant="caption" className="text-muted">
          {t('log.meta', { date, reading: (log.odometer_reading ?? 0).toLocaleString('en-US') })}
        </Text>
        {rows.map(([k, v]) => (
          <View key={k} className="h-11 flex-row items-center justify-between gap-4">
            <Text variant="caption" className="text-muted">{k}</Text>
            <Text variant="label" className="flex-1 text-end">{v}</Text>
          </View>
        ))}
        {log.description ? (
          <View className="gap-1">
            <Text variant="caption" className="text-muted">{t('log.notes')}</Text>
            <Text variant="body">{log.description}</Text>
          </View>
        ) : null}
        {receipt.data ? (
          <View className="flex-row items-center justify-between gap-4">
            <Text variant="caption" className="text-muted">{t('log.receipt')}</Text>
            <Image source={{ uri: receipt.data }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
          </View>
        ) : null}
        {count > 0 ? (
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/log/corrections', params: { id } })}>
            <Text variant="label" className="text-teal">{t('log.viewCorrections', { count })}</Text>
          </Pressable>
        ) : null}
        <View className="gap-2 rounded-field bg-sky p-4">
          <Text variant="label">{t('log.originalTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('log.originalBody')}</Text>
        </View>
      </ScrollView>
      <View className="pb-4 pt-2">
        <Button
          variant="secondary"
          title={t('log.addCorrection')}
          onPress={() => router.push({ pathname: '/capture/manual', params: { logId: id } })}
        />
      </View>
    </SafeAreaView>
  );
}
