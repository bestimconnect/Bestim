import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AlarmClock, Calendar, ChevronLeft, ChevronRight, Plus, Repeat, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useLightStatusBar } from '@/components/Hero';
import { PartStatus } from '@/components/PartStatus';
import { useRefresh } from '@/components/Refresh';
import { Backdrop, Button, Card, FooterBar, Header, PressableScale, Text } from '@/components/ui';
import { useAppBarHero } from '@/lib/appBar';
import { lifeFraction } from '@/lib/parts';
import { openCapture } from '@/lib/reading';
import { snoozePart } from '@/lib/snooze';
import { useServiceTypes, useVehicle, useVehicleParts } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { HeroBlock } from '@/components/HeroBlock';

// One screen for a part's status (Part detail + Reminder detail, merged: Q107).
const n = (x: number) => x.toLocaleString('en-US');

export default function PartScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const refresh = useRefresh();
  const params = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle, isPending: vehiclesPending, refetch: refetchVehicles, isRefetching } = useVehicle(params.vehicleId);
  const { data: logs, parts } = useVehicleParts(vehicle);
  const types = useServiceTypes();
  const st = types.data?.find((s) => s.id === params.serviceTypeId);
  const [busy, setBusy] = useState(false);
  useLightStatusBar();
  const onHero = useAppBarHero();
  const insets = useSafeAreaInsets();
  if ((!vehicle && !vehiclesPending) || (!st && !types.isPending)) return <ErrorState onRetry={() => { refetchVehicles(); types.refetch(); }} retrying={isRefetching} />;
  if (!vehicle || !st) return <SafeAreaView className="flex-1 bg-paper"><Header title="" /><LoadingState /></SafeAreaView>;

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const mine = (logs ?? []).filter((l) => l.service_type_id === st.id); // newest first
  const last = mine[0];
  const part = parts.find((p) => p.serviceType.id === st.id);
  const status = part?.status;
  const km = last?.interval_km ?? st.default_interval_km;
  const months = last?.interval_months ?? st.default_interval_months;
  const spent = mine.reduce((s, l) => s + (l.cost ?? 0), 0);

  const snoozedUntil = part?.snoozedUntil;
  const canSnooze = status != null && status.state !== 'ok' && !snoozedUntil;
  const name = i18n.language === 'ar' ? st.name_ar : st.name_en;
  const snooze = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    await snoozePart(vehicle.id, st.id, name);
    setBusy(false);
  };
  const done = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openCapture({ vehicleId: vehicle.id, serviceTypeId: st.id });
  };

  const tiles = [
    [Calendar, last ? format(new Date(last.service_date), 'd MMM', { locale: i18n.language === 'ar' ? ar : enUS }) : '—', t('parts.lastDone')],
    [Repeat, km != null ? `${n(km)} ${unit}` : months != null ? t('parts.months', { m: months }) : '—', t('parts.every')],
    [Wallet, `${n(spent)} ${t('vehicles.currency')}`, t('parts.spent')],
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      <Backdrop />
      <HeroBlock onLayout={onHero} style={{ paddingTop: insets.top + 8 }}>
        <View className="h-11 flex-row items-center">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
            {I18nManager.isRTL ? <ChevronRight size={22} color={c.onpanel} /> : <ChevronLeft size={22} color={c.onpanel} />}
          </PressableScale>
        </View>
        <View>
          <Text variant="title" className="text-onpanel" numberOfLines={2}>{name}</Text>
          {km != null || months != null ? (
            <Text variant="caption" className="text-onpanel" numberOfLines={1} style={{ opacity: 0.7 }}>
              {t('parts.every')}: {km != null ? `${n(km)} ${unit}` : t('parts.months', { m: months })}
            </Text>
          ) : null}
        </View>
        {status ? (
          <View className="h-1.5 overflow-hidden rounded-full bg-[#FFFFFF2E]">
            <View className="h-full rounded-full bg-lime" style={{ width: `${Math.round((status.state === 'overdue' ? 0 : 1 - lifeFraction(status, km).used) * 100)}%` }} />
          </View>
        ) : null}
      </HeroBlock>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="grow justify-center gap-6 px-6 py-4">
        <PartStatus status={status} unit={unit} intervalKm={km} snoozedUntil={snoozedUntil} nameEn={st.name_en} />
        {last ? (
          <Card className="flex-row">
            {tiles.map(([Icon, value, caption], i) => (
              <View key={caption} className={`flex-1 items-center gap-1 px-2 py-4 ${i ? 'border-s border-line' : ''}`}>
                <Icon size={22} color={c.teal} />
                <Text variant="label" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                <Text variant="caption" className="text-muted" numberOfLines={1}>{caption}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
      <FooterBar inset={false}>
        <Button icon={<Plus size={20} color="#222E29" />} title={t('vehicles.addRecord')} onPress={done} />
        <View className="flex-row items-center justify-center gap-2">
          <Button
            className="flex-1 px-3"
            variant="ghost"
            title={t('parts.viewLogs')}
            onPress={() => router.push({ pathname: '/part-logs', params: { vehicleId: vehicle.id, serviceTypeId: st.id } })}
          />
          {canSnooze ? (
            <Button className="flex-1 px-3" variant="ghost" icon={<AlarmClock size={20} color={c.teal} />} title={t('reminders.snooze')} loading={busy} onPress={snooze} />
          ) : null}
        </View>
      </FooterBar>
    </SafeAreaView>
  );
}
