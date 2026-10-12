import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AlarmClock, Calendar, Check, History, Repeat, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartStatus } from '@/components/PartStatus';
import { useRefresh } from '@/components/Refresh';
import { Button, Header, PressableScale, Text } from '@/components/ui';
import { openCapture } from '@/lib/reading';
import { snoozePart } from '@/lib/snooze';
import { useServiceTypes, useVehicle, useVehicleParts } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// One screen for a part's status (Part detail + Reminder detail, merged: Q107).
const n = (x: number) => x.toLocaleString('en-US');

export default function PartScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const refresh = useRefresh();
  const params = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle } = useVehicle(params.vehicleId);
  const { data: logs, parts } = useVehicleParts(vehicle);
  const st = useServiceTypes().data?.find((s) => s.id === params.serviceTypeId);
  const [busy, setBusy] = useState(false);
  if (!vehicle || !st) return <View className="flex-1 bg-paper" />;

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
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-6">
        <Header
          title={name}
          right={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('parts.viewHistory')}
              onPress={() => router.push({ pathname: '/part-history', params })}
              className="h-11 w-11 items-center justify-center rounded-field bg-white">
              <History size={22} color={c.ink} />
            </PressableScale>
          }
        />
      </View>
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="grow justify-center gap-8 px-6 py-4">
        {status || !last ? <PartStatus status={status} unit={unit} intervalKm={km} snoozedUntil={snoozedUntil} /> : null}
        {last ? (
          <View className="flex-row gap-3">
            {tiles.map(([Icon, value, caption]) => (
              <View key={caption} className="flex-1 items-center gap-1 rounded-item bg-white p-3">
                <Icon size={22} color={c.teal} />
                <Text variant="label" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                <Text variant="caption" className="text-muted">{caption}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View className="flex-row items-center gap-3 px-6 pb-4">
        <Button className="flex-1" icon={last ? <Check size={20} color="#222E29" /> : undefined} title={t(last ? 'common.done' : 'partStatus.none')} onPress={done} />
        {canSnooze ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('reminders.snooze')}
            disabled={busy}
            onPress={snooze}
            className="h-14 w-14 items-center justify-center rounded-field border border-line bg-white">
            {busy ? <ActivityIndicator color={c.ink} /> : <AlarmClock size={24} color={c.ink} />}
          </PressableScale>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
