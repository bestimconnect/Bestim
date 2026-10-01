import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Text } from '@/components/ui';
import { useServiceTypes, useVehicle, useVehicleLogs } from '@/lib/queries';
import { useLogDraft } from '@/stores/logDraft';

// Screen 12 — Part history, Figma ar-light 12/تاريخ القطع.
const n = (x: number) => x.toLocaleString('en-US');

export default function PartHistory() {
  const { t, i18n } = useTranslation();
  const { vehicleId, serviceTypeId } = useLocalSearchParams<{ vehicleId: string; serviceTypeId: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const st = useServiceTypes().data?.find((s) => s.id === serviceTypeId);
  const logs = (useVehicleLogs(vehicleId).data ?? []).filter((l) => l.service_type_id === serviceTypeId); // newest first
  if (!vehicle || !st) return <View className="flex-1 bg-paper" />;

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const name = i18n.language === 'ar' ? st.name_ar : st.name_en;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-6">
        <Header title={name} />
      </View>
      <ScrollView contentContainerClassName="gap-4 px-6 pb-4">
        <Text variant="title">{t('parts.history.title')}</Text>
        <Text variant="body" className="text-muted">{t('parts.history.subtitle')}</Text>
        {logs.length ? (
          logs.map((l, i) => {
            const current = i === 0;
            const end = current ? vehicle.current_odometer : logs[i - 1].odometer_reading; // next log's reading
            const dist = l.odometer_reading != null && end != null ? end - l.odometer_reading : null;
            return (
              <View key={l.id} className={`gap-2 rounded-item p-4 ${current ? 'bg-mint' : ''}`}>
                <Text variant="label">{t(current ? 'parts.history.current' : 'parts.history.previous')}</Text>
                <Text variant="caption" className="text-muted">
                  {t('parts.history.installed', {
                    date: format(new Date(l.service_date), 'MMMM yyyy', { locale: i18n.language === 'ar' ? ar : enUS }),
                    reading: l.odometer_reading != null ? n(l.odometer_reading) : '—',
                    u: unit,
                  })}
                  {dist != null ? `\n${t(current ? 'parts.history.ranSoFar' : 'parts.history.ran', { dist: n(dist), u: unit })}` : ''}
                  {!current && l.description ? ` ${t('parts.history.reason', { reason: l.description })}` : ''}
                </Text>
              </View>
            );
          })
        ) : (
          <Text variant="body" className="text-muted">{t('parts.history.empty')}</Text>
        )}
      </ScrollView>
      <View className="px-6 pb-4">
        <Button
          title={t('parts.history.log')}
          onPress={() => {
            useLogDraft.getState().reset({ vehicleId, serviceTypeId, title: name });
            router.push('/capture/manual');
          }}
        />
      </View>
    </SafeAreaView>
  );
}
