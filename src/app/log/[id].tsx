import { useRefresh } from '@/components/Refresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { PartArt } from '@/components/PartArt';
import { router, useLocalSearchParams } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Calendar, Gauge, MapPin, Mic, Pencil, Trash2, TriangleAlert } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, PressableScale, Text } from '@/components/ui';
import { useLog, useVehicle } from '@/lib/queries';
import { removeRecord } from '@/lib/removeRecord';
import { LOG_FIELDS } from '@/lib/saveLog';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// Screen 18 — Record details, rebuilt as a status screen (Q107): badge, title, cost, one chip, three tiles.
export default function LogDetailScreen() {
  const { t, i18n } = useTranslation();
  const refresh = useRefresh();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: log } = useLog(id);
  const { vehicle } = useVehicle(log?.vehicle_id);
  const queryClient = useQueryClient();
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
  if (!log) return <SafeAreaView className="flex-1 bg-paper px-6"><Header title="" /></SafeAreaView>;

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
    router.back();
    removeRecord(queryClient, 'maintenance_logs', id);
  };
  const parts = Array.isArray(log.parts_replaced)
    ? log.parts_replaced.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean).join(' + ')
    : '';
  const st = log.service_types;
  const unit = t(`vehicles.unit.${(vehicle?.odometer_unit ?? 'km') as 'km'}`);
  const details = Object.entries((log.details ?? {}) as Record<string, string | number>).filter(([f, v]) => f in LOG_FIELDS && v !== '');
  const next = st?.has_reminder ? log.interval_km ?? st.default_interval_km : null;
  const rows: [string, string][] = [
    ...(parts ? [[t('log.parts'), parts] as [string, string]] : []),
    ...details.map(([f, v]) => [t(`capture.fields.${f}`), String(v)] as [string, string]),
    ...(next != null
      ? [[t('log.next'), `${t('log.review.km', { n: next.toLocaleString('en-US') })}${log.interval_km == null ? ` · ${t('log.standard')}` : ''}`] as [string, string]]
      : []),
  ];
  const count = corrections.data?.length ?? 0;
  const chip =
    review ? { Icon: TriangleAlert, text: t('log.checkReading'), box: 'bg-amber', onPress: fixReading }
    : log.status === 'corrected' ? { Icon: Pencil, text: t('log.edited'), box: 'bg-sky', onPress: count > 0 ? () => router.push({ pathname: '/log/corrections', params: { id } }) : undefined }
    : log.source === 'voice' ? { Icon: Mic, text: t('log.byVoice'), box: 'bg-mint', onPress: undefined }
    : null;
  const tiles: [Icons.LucideIcon, string][] = [
    [Calendar, format(parseISO(log.service_date), 'd MMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS })],
    [Gauge, log.odometer_reading != null ? `${log.odometer_reading.toLocaleString('en-US')} ${unit}` : '—'],
    ...(log.location ? [[MapPin, log.location] as [Icons.LucideIcon, string]] : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-6">
        <Header title={t('log.header')} />
      </View>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-6 px-6 pb-4 pt-2" showsVerticalScrollIndicator={false}>
        <View className="items-center gap-3">
          <PartArt nameEn={log.service_types?.name_en} size={96} />
          <Text variant="title" className="text-center">{log.title}</Text>
          {log.cost != null ? (
            <View className="items-center">
              <Text variant="number" className="!text-[56px] !leading-[64px]">{log.cost.toLocaleString('en-US')}</Text>
              <Text variant="label" className="text-muted">{t('vehicles.currency')}</Text>
            </View>
          ) : null}
          {chip ? (
            <PressableScale
              accessibilityRole={chip.onPress ? 'button' : 'text'}
              disabled={!chip.onPress}
              onPress={chip.onPress}
              className={`h-9 flex-row items-center gap-2 rounded-full px-4 ${chip.box}`}>
              <chip.Icon size={16} color={c.teal} />
              <Text variant="caption">{chip.text}</Text>
            </PressableScale>
          ) : null}
        </View>
        <View className="flex-row gap-3">
          {tiles.map(([TileIcon, value], i) => (
            <View key={i} className="flex-1 items-center gap-1 rounded-item bg-white p-3">
              <TileIcon size={22} color={c.teal} />
              <Text variant="label" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            </View>
          ))}
        </View>
        {rows.map(([k, v]) => (
          <View key={k} className="min-h-[44px] flex-row items-center justify-between gap-4">
            <Text variant="caption" className="text-muted">{k}</Text>
            <Text variant="label" className="shrink">{v}</Text>
          </View>
        ))}
        {log.description ? (
          <View className="gap-1">
            <Text variant="caption" className="text-muted">{t('log.notes')}</Text>
            <Text variant="body">{log.description}</Text>
          </View>
        ) : null}
        {receipt.data ? <Image source={{ uri: receipt.data }} style={{ width: '100%', height: 160, borderRadius: 18 }} contentFit="cover" /> : null}
      </ScrollView>
      <View className="flex-row items-center gap-3 px-6 pb-4 pt-2">
        {review ? (
          <Button className="flex-1" title={t('log.fixReading')} onPress={fixReading} />
        ) : (
          <Button className="flex-1" icon={<Pencil size={20} color="#222E29" />} title={t('log.edit')} onPress={edit} />
        )}
        {review ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('log.edit')}
            onPress={edit}
            className="h-[52px] w-[52px] items-center justify-center rounded-field border border-line bg-white">
            <Pencil size={24} color={c.ink} />
          </PressableScale>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('capture.quick.delete')}
          onPress={del}
          className="h-[52px] w-[52px] items-center justify-center rounded-field border border-line bg-white">
          <Trash2 size={24} color={c.danger} />
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
