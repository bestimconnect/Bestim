import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Wrench } from 'lucide-react-native';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Card, Chip, PressableScale, Segment, Text, Ticks } from '@/components/ui';
import { useCurrentVehicle } from '@/lib/queries';
import { bilingual, useCatalogNames, useJobTypes, useSpecialists, useSystems, useTracked, usePartSearch, useVisits, visitTotals, type CatalogPick } from '@/lib/services';
import { useColors } from '@/lib/theme';

// v2 flow 12 "Services": the tracked parts of the car grouped by system (health %, km left, tick bar), and every visit with filters.
// Opened from the Timeline header. A visit opens /visit/<id>. The search icon picks a job or part and filters the visits to it.
const n = (x: number) => x.toLocaleString('en-US');

export default function ServicesScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const arabic = i18n.language === 'ar';
  const { vehicle } = useCurrentVehicle();
  const [seg, setSeg] = useState<'tracked' | 'visits'>('tracked');
  const [specialist, setSpecialist] = useState<string | null>(null);
  const [part, setPart] = useState<CatalogPick | null>(null);
  const tracked = useTracked(vehicle?.id);
  const visits = useVisits(vehicle?.id);
  const systems = useSystems().data ?? [];
  const jobTypes = useJobTypes().data ?? [];
  const specialists = useSpecialists().data ?? [];
  const items = tracked.data ?? [];
  const catalogNames = useCatalogNames(items.flatMap((i) => (i.catalog_item_id ? [i.catalog_item_id] : []))).data ?? [];
  const unit = t(`vehicles.unit.${(vehicle?.odometer_unit ?? 'km') as 'km'}`);

  const nameOf = (i: (typeof items)[number]) => {
    const r = i.job_type_id ? jobTypes.find((j) => j.id === i.job_type_id) : catalogNames.find((x) => x.id === i.catalog_item_id);
    return r ? bilingual(r, arabic) : '—';
  };
  const bySystem = systems
    .map((s) => ({ s, rows: items.filter((i) => i.system_id === s.id).sort((a, b) => (a.health ?? 2) - (b.health ?? 2)) }))
    .filter((g) => g.rows.length);

  const search = () => {
    usePartSearch.setState({ vehicleId: vehicle?.id, pops: 2, onPick: (p) => { setPart(p); setSeg('visits'); } });
    router.push('/part-search');
  };

  const shown = (visits.data ?? []).filter(
    (v) =>
      (!specialist || v.jobs.some((j) => j.specialist_key === specialist)) &&
      (!part || v.jobs.some((j) => (part.kind === 'job' ? j.job_type_id === part.id : j.line_items.some((li) => li.catalog_item_id === part.id)))),
  );
  const used = specialists.filter((sp) => (visits.data ?? []).some((v) => v.jobs.some((j) => j.specialist_key === sp.key)));
  const jobName = (j: NonNullable<typeof visits.data>[number]['jobs'][number]) => {
    const jt = jobTypes.find((x) => x.id === j.job_type_id);
    return jt ? bilingual(jt, arabic) : (j.custom_name ?? '—');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader
        title={t('services.title')}
        right={
          <PressableScale accessibilityRole="button" accessibilityLabel={t('services.search')} onPress={search} className="h-11 w-11 items-center justify-center rounded-full bg-white">
            <Search size={20} color={c.ink} />
          </PressableScale>
        }
      />
      <View className="px-6 pb-3 pt-1">
        <Segment value={seg} onChange={setSeg} options={[{ value: 'tracked', label: t('services.tracked') }, { value: 'visits', label: t('services.visits') }]} />
      </View>
      {tracked.isPending || visits.isPending ? (
        <LoadingState />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-8" showsVerticalScrollIndicator={false}>
          {seg === 'tracked' ? (
            bySystem.length === 0 ? (
              <EmptyState icon={Wrench} title={t('services.emptyTracked')} />
            ) : (
              bySystem.map(({ s, rows }) => (
                <View key={s.id} className="gap-2">
                  <Text variant="caption" className="px-1 text-muted">{bilingual(s, arabic)}</Text>
                  {rows.map((i) => {
                    const tone = i.state === 'overdue' ? 'late' : i.state === 'soon' ? 'soon' : 'ok';
                    const pct = i.health != null ? Math.round(i.health * 100) : null;
                    const left =
                      i.health == null ? t('services.notDone')
                        : i.remaining_km != null && i.remaining_km <= 0 ? t('services.overdueBy', { n: n(-i.remaining_km) })
                        : i.remaining_km != null ? `${t('services.kmLeft', { n: n(i.remaining_km) })}`.replace(/km|كم/, unit)
                        : i.remaining_days != null && i.remaining_days <= 0 ? t('services.overdueDays', { n: n(-i.remaining_days) })
                        : t('services.daysLeft', { n: n(i.remaining_days ?? 0) });
                    return (
                      <Card key={i.tracked_item_id} className="gap-2 p-3.5">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text variant="label" className="flex-1" numberOfLines={1}>{nameOf(i)}</Text>
                          <Text variant="label" className={tone === 'late' ? 'text-late' : tone === 'soon' ? 'text-soon' : 'text-ok'}>{pct != null ? `${pct}%` : '—'}</Text>
                        </View>
                        <Ticks on={pct != null ? Math.round((pct / 100) * 12) : 0} tone={tone} height={14} />
                        <Text variant="caption" className="text-muted">{left}</Text>
                      </Card>
                    );
                  })}
                </View>
              ))
            )
          ) : (
            <>
              {part ? (
                <View className="flex-row">
                  <Chip label={t('services.showing', { name: bilingual(part, arabic) })} selected icon={X} onPress={() => setPart(null)} />
                </View>
              ) : null}
              {used.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  <Chip label={t('services.all')} selected={!specialist} onPress={() => setSpecialist(null)} />
                  {used.map((sp) => <Chip key={sp.key} label={bilingual(sp, arabic)} selected={specialist === sp.key} onPress={() => setSpecialist(specialist === sp.key ? null : sp.key)} />)}
                </ScrollView>
              ) : null}
              {shown.length === 0 ? (
                <EmptyState icon={Wrench} title={t('services.emptyVisits')} />
              ) : (
                shown.map((v) => (
                  <Card key={v.id} onPress={() => router.push({ pathname: '/visit/[id]', params: { id: v.id } })} className="gap-1 p-3.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text variant="label" numberOfLines={1} className="flex-1">{v.workshop_name || v.jobs.map(jobName).join('، ')}</Text>
                      <Text variant="label">{visitTotals(v).total ? n(visitTotals(v).total) : ''}</Text>
                    </View>
                    <Text variant="caption" className="text-muted" numberOfLines={2}>
                      {format(parseISO(v.visit_date), 'd MMM yyyy', { locale: arabic ? ar : enUS })}
                      {v.odometer != null ? ` · ${n(v.odometer)} ${unit}` : ''}
                      {` · ${v.jobs.length === 1 ? t('services.jobsOne') : t('services.jobsN', { n: v.jobs.length })}`}
                    </Text>
                    <Text variant="caption" className="text-muted" numberOfLines={1}>{v.jobs.map(jobName).join('، ')}</Text>
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
