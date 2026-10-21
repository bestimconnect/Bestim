import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { Group, Item, PressableScale, Text } from '@/components/ui';
import { useServiceTypes, useVehicle, useVehicleLogs } from '@/lib/queries';
import { useColors } from '@/lib/theme';

const n = (x: number) => x.toLocaleString('en-US');

// Every record of one part, in a sheet over the part page (so it feels like the same page).
export default function PartLogs() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const { vehicleId, serviceTypeId } = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const st = useServiceTypes().data?.find((s) => s.id === serviceTypeId);
  const logs = (useVehicleLogs(vehicleId).data ?? []).filter((l) => l.service_type_id === serviceTypeId);
  const arabic = i18n.language === 'ar';
  const unit = vehicle ? t(`vehicles.unit.${vehicle.odometer_unit}`) : '';
  const total = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
  return (
    <ScrollView
      className="flex-1 rounded-t-screen border-t border-line bg-sheet"
      contentContainerClassName="gap-4 px-6 pt-6"
      contentContainerStyle={{ paddingBottom: bottom + 16 }}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="heading" numberOfLines={1}>{st ? (arabic ? st.name_ar : st.name_en) : ''}</Text>
          <Text variant="caption" className="text-muted">{t('history.count', { count: logs.length })} · {n(total)} {t('vehicles.currency')}</Text>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      {logs.length ? (
        <Group>
          {logs.map((l) => (
            <Item
              key={l.id}
              leading={<PartArt nameEn={l.service_types?.name_en} size={28} />}
              title={format(parseISO(l.service_date), 'd MMMM yyyy', { locale: arabic ? ar : enUS })}
              subtitle={l.odometer_reading != null ? `${n(l.odometer_reading)} ${unit}` : undefined}
              aside={l.cost != null ? <Text variant="label">{n(l.cost)}</Text> : undefined}
              onPress={() => router.push({ pathname: '/log/[id]', params: { id: l.id } })}
            />
          ))}
        </Group>
      ) : (
        <Text variant="body" className="py-6 text-center text-muted">{t('parts.history.empty')}</Text>
      )}
    </ScrollView>
  );
}
