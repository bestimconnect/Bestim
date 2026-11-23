import { useRefresh } from '@/components/Refresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { PartArt } from '@/components/PartArt';
import { router, useLocalSearchParams } from 'expo-router';
import { Gauge, Pencil, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { TabHeader } from '@/components/TabHeader';
import { Num } from '@/components/timeline/Num';
import { Label } from '@/components/timeline/Row';
import { Trust, trustOf } from '@/components/timeline/Trust';
import { Button, Card, FooterBar, Group, PressableScale, Text } from '@/components/ui';
import { useLog, useServiceTypes, useVehicle } from '@/lib/queries';
import { confirmRemove } from '@/components/timeline/confirmRemove';
import { LOG_FIELDS } from '@/lib/saveLog';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';

const n = (x: number) => x.toLocaleString('en-US');

// Record details (v2 flow 5, screen 5): part picture + date + cost, the trust label, receipt, odometer, amendments (the original is always kept).
export default function LogDetailScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useRefresh();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logQuery = useLog(id);
  const log = logQuery.data;
  const { vehicle } = useVehicle(log?.vehicle_id);
  const types = useServiceTypes().data;
  const queryClient = useQueryClient();
  const corrections = useQuery({
    queryKey: ['log-corrections', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('log_corrections').select('id, field_name, old_value, new_value, corrected_at').eq('log_id', id).order('corrected_at');
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
  if (!log && !logQuery.isPending) return <ErrorState onRetry={logQuery.refetch} retrying={logQuery.isRefetching} />;
  if (!log)
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="px-6"><TabHeader title={t('log.header')} back /></View>
        <LoadingState />
      </SafeAreaView>
    );

  const review = log.status === 'needs_review';
  const fixReading = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/log/review-reading', params: { id } });
  };
  const edit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/capture', params: { logId: id } });
  };
  const del = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    confirmRemove(queryClient, 'maintenance_logs', id, log.title, router.back);
  };
  const arabic = i18n.language === 'ar';
  const locale = arabic ? ar : enUS;
  const parts = Array.isArray(log.parts_replaced)
    ? log.parts_replaced.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean).join(' + ')
    : '';
  const st = log.service_types;
  const unit = t(`vehicles.unit.${(vehicle?.odometer_unit ?? 'km') as 'km'}`);
  const details = Object.entries((log.details ?? {}) as Record<string, string | number>).filter(([f, v]) => f in LOG_FIELDS && v !== '');
  const next = st?.has_reminder ? log.interval_km ?? st.default_interval_km : null;
  const rows: [string, string][] = [
    ...(log.location ? [[t('log.corrections.fields.location'), log.location] as [string, string]] : []),
    ...(parts ? [[t('log.parts'), parts] as [string, string]] : []),
    ...details.map(([f, v]) => [t(`capture.fields.${f}`), String(v)] as [string, string]),
    ...(next != null
      ? [[t('log.next'), `${t('log.review.km', { n: n(next) })}${log.interval_km == null ? ` · ${t('log.standard')}` : ''}`] as [string, string]]
      : []),
  ];
  // A corrected value as text: readings and intervals in the car's unit, a service by name.
  const shown = (field: string, v: string | null) => {
    if (v == null || v === '') return '—';
    if (field === 'odometer_reading' || field === 'interval_km') return `${n(Number(v))} ${unit}`;
    if (field === 'cost') return t('log.egp', { cost: n(Number(v)) });
    if (field === 'service_type_id') { const s = types?.find((x) => x.id === v); return (arabic ? s?.name_ar : s?.name_en) ?? v; }
    if (field === 'service_date') return format(parseISO(v), 'd MMMM yyyy', { locale });
    return v;
  };
  const changes = corrections.data ?? [];
  const date = format(parseISO(log.service_date), 'd MMM', { locale });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="px-6">
        <TabHeader title={log.title} back />
      </View>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-2 px-6 pb-40 pt-3" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <PartArt nameEn={st?.name_en} size={46} />
            <Text variant="caption" className="text-muted" style={{ fontSize: 14 }}>{[date, log.cost != null ? `${n(log.cost)} ${t('vehicles.currency')}` : null].filter(Boolean).join(' · ')}</Text>
          </View>
          <Trust kind={trustOf(log)} />
        </View>
        {review ? (
          <Card className="flex-row items-center gap-3 p-4" onPress={fixReading}>
            <Text variant="label" className="flex-1 text-soon">{t('log.checkReading')}</Text>
          </Card>
        ) : null}
        {receipt.data ? (
          <Card className="flex-row items-center gap-3.5 p-4">
            <Image source={{ uri: receipt.data }} style={{ width: 56, height: 70, borderRadius: 10 }} contentFit="cover" />
            <View>
              <Text variant="caption" className="text-muted">{t('tl.receipt')}</Text>
              {log.cost != null ? <Text variant="label" className="mt-0.5 font-normal">{n(log.cost)} {t('vehicles.currency')}</Text> : null}
            </View>
          </Card>
        ) : null}
        <Card className="mt-0.5 gap-2.5 p-4">
          <View className="flex-row items-center gap-2"><Gauge size={15} color={c.muted} /><Text variant="caption" className="text-muted">{t('tl.odometer')}</Text></View>
          {log.odometer_reading != null ? <Num value={n(log.odometer_reading)} unit={unit} size={36} /> : <Text variant="label" className="text-muted">—</Text>}
        </Card>
        {rows.length ? (
          <Group>
            {rows.map(([k, v]) => (
              <View key={k} className="min-h-[52px] flex-row items-center justify-between gap-4 px-4 py-3">
                <Text variant="caption" className="shrink-0 text-muted">{k}</Text>
                <Text variant="label" className="shrink font-normal" numberOfLines={2}>{v}</Text>
              </View>
            ))}
          </Group>
        ) : null}
        {log.description ? (
          <Card className="gap-1 p-4">
            <Text variant="caption" className="text-muted">{t('log.notes')}</Text>
            <Text variant="body">{log.description}</Text>
          </Card>
        ) : null}
        {changes.length ? (
          <View className="gap-2">
            <Label>{t('tl.amendments')}</Label>
            <Card className="gap-3 p-4" onPress={() => router.push({ pathname: '/log/corrections', params: { id } })}>
              {changes.map((r, i) => (
                <View key={r.id} className="flex-row gap-3">
                  <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${i === changes.length - 1 ? 'bg-ok' : 'bg-tick'}`} />
                  <View className="flex-1 gap-0.5">
                    <Text variant="caption" className="text-muted">{t(`log.corrections.fields.${r.field_name}`)}</Text>
                    <Text variant="caption" className="text-muted" style={{ textDecorationLine: 'line-through', writingDirection: 'ltr' }}>{shown(r.field_name, r.old_value)}</Text>
                    <Text variant="label" className="font-normal" style={{ writingDirection: 'ltr' }}>{shown(r.field_name, r.new_value)}</Text>
                    <Text variant="caption" className="text-muted" style={{ fontSize: 12 }}>{t('tl.correctedOn', { date: format(parseISO(r.corrected_at), 'd MMM', { locale }) })}</Text>
                  </View>
                </View>
              ))}
            </Card>
            <Text variant="caption" className="mx-1 text-muted" style={{ fontSize: 12.5, lineHeight: 20 }}>{t('tl.keep')}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FooterBar inset={false}>
        <View className="flex-row items-center gap-3">
          {review ? (
            <Button className="flex-1" title={t('log.fixReading')} onPress={fixReading} />
          ) : (
            <Button className="flex-1" variant="secondary" icon={<Pencil size={20} color={c.ink} />} title={t('tl.fix')} onPress={edit} />
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('capture.quick.delete')}
            onPress={del}
            className="h-14 w-14 items-center justify-center rounded-full bg-white"
            style={{ boxShadow: shadows.ring }}>
            <Trash2 size={22} color={c.danger} />
          </PressableScale>
        </View>
      </FooterBar>
    </SafeAreaView>
  );
}
