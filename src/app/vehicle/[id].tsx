import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardList, CloudOff, Gauge, Pencil, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { I18nManager, InteractionManager, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CarPhoto } from '@/components/CarPhoto';
import { LogsTab, OverviewTab, PartsTab } from '@/components/CarTabs';
import { useRefresh } from '@/components/Refresh';
import { useLightStatusBar } from '@/components/Hero';
import { Backdrop, Button, Choice, FooterBar, PressableScale, Text } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useVehicle, useVehicleParts, vehicleName } from '@/lib/queries';
import { useAppBarHero } from '@/lib/appBar';
import { closeDetails } from '@/lib/carFlight';
import { openCapture } from '@/lib/reading';
import { shadows, useColors } from '@/lib/theme';
import { HeroBlock } from '@/components/HeroBlock';

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
        {all ? <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} action={t('feedback.error.retry')} onAction={refetch} /> : <LoadingState />}
      </View>
    );

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <View className="flex-1 bg-paper">
      <Backdrop />
    <ScrollView refreshControl={refresh} className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
      <HeroBlock onLayout={onHero} style={{ paddingTop: insets.top + 8 }}>
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
            <Text variant="title" className="text-onpanel" numberOfLines={2}>{vehicleName(vehicle)}</Text>
            <Text variant="caption" className="text-onpanel" numberOfLines={1} style={{ opacity: 0.6 }}>
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
      </HeroBlock>

      {bodyReady ? (
      <Animated.View entering={FadeIn.duration(180)} className="gap-3 px-6 pt-6">
        {seg === 'overview' ? (
          <OverviewTab vehicle={vehicle} logs={logs ?? []} unit={unit} />
        ) : seg === 'parts' ? (
          <PartsTab vehicle={vehicle} logs={logs ?? []} parts={parts} />
        ) : (
          <LogsTab vehicle={vehicle} logs={logs ?? []} unit={unit} empty={<EmptyState icon={ClipboardList} title={t('vehicles.emptyLog')} />} />
        )}
      </Animated.View>
      ) : null}
    </ScrollView>
    {/* In the page flow under the scroll area: the list ends above the buttons, nothing shows through behind them. */}
    <FooterBar>
      <View className="flex-row gap-3">
        <Button className="flex-1 px-3" icon={<Plus size={20} color="#222E29" />} title={t('vehicles.addRecord')} onPress={() => openCapture({ vehicleId: vehicle.id })} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('vehicles.updateReading')}
          onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}
          className="h-14 w-14 items-center justify-center rounded-[18px] border border-line bg-white"
          style={{ boxShadow: shadows.lift }}>
          <Gauge size={24} color={c.ink} />
        </PressableScale>
      </View>
    </FooterBar>
    </View>
  );
}
