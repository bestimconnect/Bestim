import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { toast, toastError } from '@/components/Toast';
import { Button, Card, Text } from '@/components/ui';
import { sheet } from '@/lib/sheet';
import { useCurrentVehicle } from '@/lib/queries';
import { bilingual, useJobTypes, useSpecialists, useVisits, visitTotals } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { Wrench } from 'lucide-react-native';

// v2 flow 12 "Visit details": date, odometer, workshop, each job with its specialist and line items, the labor / parts / consumables /
// other split and the total. Delete is soft (30 days, restore from Recently deleted) with Undo.
const n = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function VisitScreen() {
  const { t, i18n } = useTranslation();
  const arabic = i18n.language === 'ar';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicle } = useCurrentVehicle();
  const qc = useQueryClient();
  const visits = useVisits(vehicle?.id);
  const jobTypes = useJobTypes().data ?? [];
  const specialists = useSpecialists().data ?? [];
  const v = visits.data?.find((x) => x.id === id);
  const refresh = () => {
    for (const key of ['visits', 'tracked', 'expenses', 'vehicles', 'deleted-items']) qc.invalidateQueries({ queryKey: [key] });
  };

  const remove = async () => {
    const { error } = await supabase.rpc('soft_delete_visit', { p_visit_id: id });
    if (error) return toastError(t('services.failed'));
    refresh();
    router.back();
    toast(t('services.deleted'), {
      label: t('services.undo'),
      onPress: async () => {
        await supabase.rpc('restore_visit', { p_visit_id: id });
        refresh();
      },
    });
  };
  const confirm = () =>
    sheet(t('services.deleteVisit'), t('services.deleteBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('services.deleteVisit'), style: 'destructive', onPress: remove },
    ]);

  if (visits.isPending) return <LoadingState />;
  if (!v)
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
        <PageHeader title={t('services.visitTitle')} />
        <EmptyState icon={Wrench} title={t('services.emptyVisits')} />
      </SafeAreaView>
    );
  const totals = visitTotals(v);
  const unit = t(`vehicles.unit.${(vehicle?.odometer_unit ?? 'km') as 'km'}`);
  const row = (label: string, value: string) => (
    <View className="flex-row items-center justify-between gap-3 py-1.5">
      <Text variant="body-sm" className="text-muted">{label}</Text>
      <Text variant="body-sm" className="flex-1 text-end" numberOfLines={2}>{value}</Text>
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('services.visitTitle')} sub={v.workshop_name ?? undefined} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
        <Card className="px-4 py-2.5">
          {row(t('services.date'), format(parseISO(v.visit_date), 'd MMMM yyyy', { locale: arabic ? ar : enUS }))}
          {v.odometer != null ? row(t('services.odometer'), `${n(v.odometer)} ${unit}`) : null}
          {v.workshop_name ? row(t('services.workshop'), v.workshop_name) : null}
          {v.workshop_phone ? row(t('services.phone'), v.workshop_phone) : null}
          {v.notes ? row(t('services.notes'), v.notes) : null}
        </Card>
        {v.jobs
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((j) => {
            const jt = jobTypes.find((x) => x.id === j.job_type_id);
            const sp = specialists.find((x) => x.key === j.specialist_key);
            return (
              <Card key={j.id} className="gap-1 p-4">
                <Text variant="label">{jt ? bilingual(jt, arabic) : (j.custom_name ?? '—')}</Text>
                <Text variant="caption" className="text-muted">{sp ? bilingual(sp, arabic) : (j.specialist_name ?? '')}</Text>
                <View className="my-1.5 h-px bg-line" />
                {j.line_items.map((li) => (
                  <View key={li.id} className="flex-row items-center justify-between gap-3 py-1">
                    <Text variant="body-sm" className="flex-1" numberOfLines={2}>{li.name}{li.qty > 1 ? ` × ${n(li.qty)}` : ''}</Text>
                    <Text variant="body-sm">{n(Number(li.total))}</Text>
                  </View>
                ))}
              </Card>
            );
          })}
        {totals.total > 0 ? (
          <Card className="px-4 py-2.5">
            {totals.labor ? row(t('services.labor'), n(totals.labor)) : null}
            {totals.parts ? row(t('services.parts'), n(totals.parts)) : null}
            {totals.consumables ? row(t('services.consumables'), n(totals.consumables)) : null}
            {totals.other ? row(t('services.other'), n(totals.other)) : null}
            <View className="my-1.5 h-px bg-line" />
            <View className="flex-row items-center justify-between py-1.5">
              <Text variant="label">{t('services.total')}</Text>
              <Text variant="label">{n(totals.total)}</Text>
            </View>
          </Card>
        ) : null}
        <Button title={t('services.deleteVisit')} variant="soft" onPress={confirm} />
      </ScrollView>
    </SafeAreaView>
  );
}
