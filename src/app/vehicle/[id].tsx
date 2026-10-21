import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardList, Gauge, Pencil, Plus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { I18nManager, InteractionManager, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CarPhoto } from '@/components/CarPhoto';
import { LogsTab, OverviewTab, PartsTab } from '@/components/CarTabs';
import { useRefresh } from '@/components/Refresh';
import { useLightStatusBar } from '@/components/Hero';
import { Button, Choice, PressableScale, Text } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { useVehicle, useVehicleParts, vehicleName } from '@/lib/queries';
import { useAppBarHero } from '@/lib/appBar';
import { closeDetails } from '@/lib/carFlight';
import { openCapture } from '@/lib/reading';
import { useColors } from '@/lib/theme';

// Screen 09 — Vehicle detail, Figma ar-light 09/تفاصيل السيارة (segments per decisions Q15, links Q16).
type Tab = 'overview' | 'parts' | 'logs';

export default function VehicleDetail() {
  const refresh = useRefresh();
  useLightStatusBar();
  const onHero = useAppBarHero();
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: Tab | 'reminders' | 'log' }>();
  const [seg, setSeg] = useState<Tab>(tab === 'reminders' ? 'parts' : tab === 'log' ? 'logs' : (tab ?? 'overview'));
  // The header and footer show at once; the tab body is built after the opening animation, so the page does not stall while the car lands.
  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    const h = InteractionManager.runAfterInteractions(() => setBodyReady(true));
    return () => h.cancel();
  }, []);
  const { vehicle, isError, data: all, refetch, isRefetching } = useVehicle(id);
  const { data: logs, parts } = useVehicleParts(vehicle);
  if (isError && !all) return <ErrorState onRetry={refetch} retrying={isRefetching} />;
  if (!vehicle)
    return (
      <View className="flex-1 bg-paper px-6" style={{ paddingTop: insets.top + 8 }}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          {I18nManager.isRTL ? <ChevronRight size={22} color={c.ink} /> : <ChevronLeft size={22} color={c.ink} />}
        </PressableScale>
      </View>
    );

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  const empty = (Icon: LucideIcon, key: string) => (
    <View className="items-center gap-3 py-8">
      <Icon size={64} color={c.muted} />
      <Text variant="label" className="text-muted">{t(key)}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
    <ScrollView refreshControl={refresh} className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 52 + 12 + 24 }}>
      <View onLayout={onHero} className="gap-3 rounded-b-[28px] bg-panel px-6 pb-4" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center justify-between">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            onPress={() => closeDetails(vehicle)}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
            <Back size={22} color={c.onpanel} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('plate.edit')}
            onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: vehicle.id } })}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF26]">
            <Pencil size={18} color={c.onpanel} />
          </PressableScale>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text variant="title" className="text-onpanel">{vehicleName(vehicle)}</Text>
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.6 }}>
              {vehicle.year} · {t(`vehicles.type.${vehicle.vehicle_type}`)}
            </Text>
          </View>
          <CarPhoto vehicle={vehicle} width={128} height={64} slot="detail" />
        </View>
        <Choice
          onDark
          className="bg-[#FFFFFF1F]"
          value={seg}
          onChange={setSeg}
          options={(['overview', 'parts', 'logs'] as const).map((v) => ({ value: v, label: t(`vehicles.seg.${v}`) }))}
        />
      </View>

      {bodyReady ? (
      <Animated.View entering={FadeIn.duration(180)} className="gap-3 px-6 pt-6">
        {seg === 'overview' ? (
          <OverviewTab vehicle={vehicle} logs={logs ?? []} unit={unit} />
        ) : seg === 'parts' ? (
          <PartsTab vehicle={vehicle} logs={logs ?? []} parts={parts} />
        ) : (
          <LogsTab vehicle={vehicle} logs={logs ?? []} unit={unit} empty={empty(ClipboardList, 'vehicles.emptyLog')} />
        )}
      </Animated.View>
      ) : null}
    </ScrollView>
    {/* A solid footer down to the screen edge, so the list never shows through behind the buttons and the tab bar. */}
    <View className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-line bg-paper px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      <Button className="flex-1 px-3" icon={<Plus size={20} color="#222E29" />} title={t('vehicles.addRecord')} onPress={() => openCapture({ vehicleId: vehicle.id })} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('vehicles.updateReading')}
        onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}
        className="h-[52px] w-[52px] items-center justify-center rounded-field border border-line bg-white">
        <Gauge size={24} color={c.ink} />
      </PressableScale>
    </View>
    </View>
  );
}
