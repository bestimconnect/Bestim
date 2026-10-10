import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useLog, useServiceTypes } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Screen 19 — Corrections log: original values, then one mint card per correction (grouped by timestamp).
export default function CorrectionsScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: log } = useLog(id);
  const types = useServiceTypes().data;
  const rows = useQuery({
    queryKey: ['log-corrections-full', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('log_corrections').select('*').eq('log_id', id).order('corrected_at');
      if (error) throw error;
      return data;
    },
  }).data ?? [];

  const locale = i18n.language === 'ar' ? ar : enUS;
  const day = (s: string) => format(parseISO(s), 'd MMMM yyyy', { locale });
  const value = (field: string, v: string | null) => {
    if (v == null || v === '') return '—';
    if (field === 'service_type_id') {
      const st = types?.find((x) => x.id === v);
      return (i18n.language === 'ar' ? st?.name_ar : st?.name_en) ?? v;
    }
    if (field === 'odometer_reading' || field === 'interval_km') return t('log.review.km', { n: Number(v).toLocaleString('en-US') });
    if (field === 'cost') return t('log.egp', { cost: Number(v).toLocaleString('en-US') });
    if (field === 'service_date') return day(v);
    return v;
  };
  const line = (r: { field_name: string }, v: string | null) => `${t(`log.corrections.fields.${r.field_name}`)}: ${value(r.field_name, v)}`;

  const original = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!original.has(r.field_name)) original.set(r.field_name, r);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.corrected_at, [...(groups.get(r.corrected_at) ?? []), r]);

  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Header title={t('log.corrections.header')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4" showsVerticalScrollIndicator={false}>
        <Text variant="title">{t('log.corrections.title')}</Text>
        {log ? (
          <View className="gap-1 px-1 pt-2">
            <Text variant="label">{t('log.corrections.original', { date: day(log.created_at) })}</Text>
            {[...original.values()].map((r) => (
              <Text key={r.field_name} variant="caption" className="text-muted">{line(r, r.old_value)}</Text>
            ))}
          </View>
        ) : null}
        {[...groups.entries()].map(([at, rs]) => (
          <View key={at} className="gap-1 rounded-field bg-mint p-4">
            <Text variant="label">{t('log.corrections.correction', { date: day(at) })}</Text>
            {rs.map((r) => (
              <Text key={r.id} variant="caption" className="text-muted">{line(r, r.new_value)}</Text>
            ))}
            {rs[0].reason ? (
              <Text variant="caption" className="text-muted">{t('log.corrections.reason', { reason: rs[0].reason })}</Text>
            ) : null}
          </View>
        ))}
        <Text variant="body" className="text-muted">{t('log.corrections.footnote')}</Text>
      </ScrollView>
      <View className="pb-4 pt-2">
        <Button variant="secondary" title={t('log.corrections.back')} onPress={router.back} />
      </View>
    </SafeAreaView>
  );
}
