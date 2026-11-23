import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, CloudOff, Pencil } from 'lucide-react-native';
import { useCallback } from 'react';
import { BackHandler, I18nManager, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CarFlight } from '@/components/CarFlight';
import { CarPhoto } from '@/components/CarPhoto';
import { OverviewTab } from '@/components/CarTabs';
import { useRefresh } from '@/components/Refresh';
import { PressableScale, Text } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useVehicle, useVehicleParts, vehicleName } from '@/lib/queries';
import { closeDetails, useFlight } from '@/lib/carFlight';
import { shadows, useColors } from '@/lib/theme';

// Car details (v2 flow 7 #1): pencil, title, back; the car with its 360 badge; name; the facts grid; delete. No tabs: the parts and
// the records live on the Timeline and the part pages.

export default function VehicleDetail() {
  return (
    <CarFlight>
      <Details />
    </CarFlight>
  );
}

function Details() {
  const refresh = useRefresh();
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The header shows at once; the body is built after the opening animation, so the page does not stall while the card grows.
  const bodyReady = useFlight((s) => s.landed);
  const { vehicle, isError, data: all, refetch, isRefetching } = useVehicle(id);
  const { data: logs, parts } = useVehicleParts(vehicle);
  // Android's back button runs the same closing animation.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        closeDetails(vehicle ?? undefined);
        return true;
      });
      return () => sub.remove();
    }, [vehicle]),
  );
  if (isError && !all) return <ErrorState onRetry={refetch} retrying={isRefetching} />;
  if (!vehicle)
    return (
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 8 }}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => closeDetails()} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          {I18nManager.isRTL ? <ChevronRight size={22} color={c.ink} /> : <ChevronLeft size={22} color={c.ink} />}
        </PressableScale>
        {all ? <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} action={t('feedback.error.retry')} onAction={refetch} /> : <LoadingState />}
      </View>
    );

  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const round = 'h-[50px] w-[50px] items-center justify-center rounded-full bg-white';

  return (
    <View className="flex-1">
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="gap-3 px-6 pb-2" style={{ paddingTop: insets.top + 8 }}>
          <View className="flex-row items-center justify-between">
            {/* Back comes first: the row flips in Arabic, so it sits top right there and top left in English. */}
            <PressableScale accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => closeDetails(vehicle)} className={round} style={{ boxShadow: shadows.ring }}>
              <Back size={22} color={c.ink} />
            </PressableScale>
            <Text variant="heading" className="flex-1 text-center">{t('vehicles.detailsTitle')}</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={t('plate.edit')} onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: vehicle.id } })} className={round} style={{ boxShadow: shadows.ring }}>
              <Pencil size={18} color={c.ink} />
            </PressableScale>
          </View>
          <View className="items-center py-2">
            <CarPhoto vehicle={vehicle} width={260} height={130} slot="detail" />
          </View>
          <View className="gap-0.5">
            <Text variant="title" numberOfLines={2}>{vehicleName(vehicle)}</Text>
            <Text variant="caption" className="text-muted" numberOfLines={1}>{vehicle.year} · {t(`vehicles.type.${vehicle.vehicle_type}`)}</Text>
          </View>
        </View>

        {bodyReady ? (
          <Animated.View entering={FadeIn.duration(180)} className="gap-3 px-6 pt-3">
            <OverviewTab vehicle={vehicle} logs={logs ?? []} parts={parts} unit={unit} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}
