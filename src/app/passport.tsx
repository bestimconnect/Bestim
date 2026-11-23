import { router, useLocalSearchParams } from 'expo-router';
import { ShieldCheck, Share2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CarPhoto } from '@/components/CarPhoto';
import { Num } from '@/components/home/Num';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Text } from '@/components/ui';
import { showUpgrade, useLock } from '@/lib/entitlements';
import { carHealth, STATE_COLOR } from '@/lib/health';
import { useVehicle, useVehicleLogs, useVehicleParts, vehicleName } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// Car passport (v2, flow 6): the trust summary a buyer cares about, and the way into sharing.
export default function PassportScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicle } = useVehicle(id);
  const logs = useVehicleLogs(vehicle?.id).data ?? [];
  const { parts } = useVehicleParts(vehicle);
  const health = carHealth(parts);
  const shr = useLock('share_history');
  const receipts = logs.filter((l) => l.photos?.length).length; // a record with a receipt photo counts as documented
  const own = logs.length - receipts;
  const bars = [
    { label: t('passport.receipt'), n: receipts, color: STATE_COLOR.ok },
    { label: t('passport.self'), n: own, color: c.muted },
  ];
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('passport.title')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2" showsVerticalScrollIndicator={false}>
        {vehicle ? (
          <>
            <View className="items-center"><CarPhoto vehicle={vehicle} width={260} height={130} /></View>
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="title" numberOfLines={1} className="flex-1" style={{ fontSize: 22, lineHeight: 30 }}>{vehicleName(vehicle)}</Text>
              <Text variant="caption" className="text-muted">{vehicle.year}</Text>
            </View>
          </>
        ) : null}
        <Card className="gap-3 p-4">
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={16} color={c.muted} />
            <Text variant="caption" className="text-muted">{t('passport.ready')}</Text>
          </View>
          <View className="flex-row items-end justify-between">
            <View className="gap-0.5">
              <Num value={String(logs.length)} size={34} />
              <Text variant="caption" className="text-muted">{t('passport.records')}</Text>
            </View>
            {health.score != null ? <Num value={String(health.score)} unit="%" size={52} /> : null}
          </View>
          {health.score != null ? (
            <View className="h-2.5 flex-row gap-1">
              {Array.from({ length: 12 }, (_, i) => (
                <View key={i} className="flex-1 rounded-full" style={{ backgroundColor: i < Math.round((health.score! / 100) * 12) ? STATE_COLOR.ok : c.line }} />
              ))}
            </View>
          ) : null}
        </Card>
        {logs.length ? (
          <Card className="gap-3 p-4">
            <View className="h-2 flex-row gap-1">
              {bars.filter((b) => b.n).map((b) => <View key={b.label} className="rounded-full" style={{ flex: b.n, backgroundColor: b.color }} />)}
            </View>
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              {bars.map((b) => (
                <View key={b.label} className="flex-row items-center gap-1.5">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                  <Text variant="caption" className="text-muted">{b.n} {b.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Text variant="caption" className="px-1 text-muted">{t('passport.empty')}</Text>
        )}
      </ScrollView>
      {shr.hidden ? null : (
        <View className="flex-row gap-3 px-6 pb-3 pt-3">
          <Button variant="secondary" title="PDF" className="w-[84px]" onPress={() => router.push('/account/export')} />
          <Button className="flex-1" title={t('passport.share')} icon={<Share2 size={20} color={c.onbtn} />} onPress={() => (shr.locked ? showUpgrade('feature', shr.ent, null, 'share_history') : router.push({ pathname: '/account/share', params: { id } }))} />
        </View>
      )}
    </SafeAreaView>
  );
}
