import { differenceInCalendarDays, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Car, Droplets, Gauge, Mic, Wrench } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { FlatList, I18nManager, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { PartArt } from '@/components/PartArt';
import { OfflineHome } from '@/components/OfflineHome';
import { usePlanTour } from '@/components/PlanStrip';
import { VoiceQueueCard } from '@/components/VoiceQueueCard';
import { BellButton, Button, Card, PressableScale, Rise, Text } from '@/components/ui';
import { CarPhoto } from '@/components/CarPhoto';
import { CarPill } from '@/components/CarPill';
import { AlertRow, AllClear } from '@/components/home/Alerts';
import { Num, Ticks } from '@/components/home/Num';
import { MenuButton } from '@/components/TabHeader';
import { useTourTarget } from '@/lib/tour';
import { openDetails } from '@/lib/carFlight';
import { useFirstRun } from '@/lib/firstRun';
import { hasReading } from '@/lib/reading';
import { lifeFraction } from '@/lib/parts';
import { needsAttention, useCurrentVehicle, useVehicleParts, useVehicles, type Part, type Vehicle } from '@/lib/queries';
import { EASE_OUT, POP, SWAP } from '@/lib/motion';
import { useOnline, useShowSaved } from '@/lib/online';
import { useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

const partName = (lang: string, p: Part) => (lang === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en);
const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('en-US');

/** Small label row of a tile: icon + words in muted ink. */
function TileHead({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  const c = useColors();
  return (
    <View className="flex-row items-center gap-2">
      <Icon size={16} color={c.muted} />
      <Text variant="caption" numberOfLines={1} className="shrink text-muted">{label}</Text>
    </View>
  );
}

// Flow 3, Home: grey canvas, the car as the hero, the odometer, two tiles, what is coming up. Flow 7 (empty) and 8 (all clear) are states of the same page.
function Today({ vehicle }: { vehicle: Vehicle }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const refresh = useRefresh(insets.top, c.muted);
  const { started } = useFirstRun();
  usePlanTour(started);
  const odometerTarget = useTourTarget('odometer');
  const priorityTarget = useTourTarget('priority');
  const space = useTabBarSpace();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts, isPending: partsLoading } = useVehicleParts(vehicle);
  const days = vehicle.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : 0;
  const urgent = needsAttention(parts).slice(0, 3);
  const unit = t(`home.${vehicle.odometer_unit}`);
  const partUnit = t(`vehicles.unit.${vehicle.odometer_unit}`);

  // Tiles: the nearest service in km, and the oil's life (when the car has an oil record).
  const live = parts.filter((p) => !p.snoozedUntil);
  const kms = live.map((p) => p.status.remainingKm).filter((k): k is number => k != null);
  const nextKm = kms.length ? Math.min(...kms) : null;
  const oil = parts.find((p) => /oil/i.test(p.serviceType.name_en));
  const oilLife = oil ? (oil.status.state === 'overdue' ? 0 : 1 - lifeFraction(oil.status, oil.log.interval_km ?? oil.serviceType.default_interval_km).used) : null;
  const oilColor = !oil ? c.tick : oil.status.state === 'overdue' ? c.late : oil.status.state === 'soon' ? c.soon : c.ok;
  const next = [...live].sort((a, b) => (a.status.remainingKm ?? Infinity) - (b.status.remainingKm ?? Infinity))[0];

  // Swipe between vehicles (decisions Q56): one page per vehicle; the page it settles on becomes the current vehicle.
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<Vehicle>>(null);
  const placed = useRef(false);
  const index = Math.max(0, vehicles.findIndex((v) => v.id === vehicle.id));
  const page = useRef(index); // the page on screen; differs from `index` only when the sheet switched the vehicle
  useEffect(() => {
    if (page.current === index) return;
    page.current = index;
    pager.current?.scrollToIndex({ index, animated: true });
  }, [index]);
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // iOS reports x from the physical left, while an RTL list starts at the right.
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = I18nManager.isRTL ? contentSize.width - layoutMeasurement.width - contentOffset.x : contentOffset.x;
    const i = Math.round(x / width);
    if (i === page.current || !vehicles[i]) return;
    page.current = i;
    Haptics.selectionAsync();
    setCurrent(vehicles[i].id);
  };

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerClassName="grow" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: space }}>
      <View className="gap-4">
        <View className="flex-row items-center gap-3 px-5">
          <MenuButton />
          <CarPill />
          <View className="flex-1" />
          <BellButton tone="paper" />
        </View>

        {/* The car is the hero, straight on the canvas. */}
        <View>
          <FlatList
            ref={pager}
            horizontal
            pagingEnabled
            data={vehicles}
            keyExtractor={(v) => v.id}
            scrollEnabled={vehicles.length > 1}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            initialScrollIndex={index}
            onContentSizeChange={() => {
              if (placed.current) return;
              placed.current = true;
              pager.current?.scrollToIndex({ index: page.current, animated: false });
            }}
            onMomentumScrollEnd={onSettle}
            renderItem={({ item }) => (
              <View style={{ width, height: 170 }} className="items-center justify-center">
                <CarPhoto vehicle={item} width={Math.min(width - 24, 340)} height={160} slot="home" onPress={() => openDetails(item, 'home')} />
              </View>
            )}
          />
          {vehicles.length > 1 ? (
            <View className="mt-1 flex-row justify-center gap-1.5">
              {vehicles.map((v) => (
                <Animated.View
                  key={v.id}
                  className={`h-1.5 rounded-full ${v.id === vehicle.id ? 'bg-ink' : 'bg-tick'}`}
                  style={{ width: v.id === vehicle.id ? 16 : 6, transitionProperty: ['width'], transitionDuration: '220ms', transitionTimingFunction: EASE_OUT }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View className="gap-3 px-5">
          {/* Bento (design flow 3): two small tiles stacked, the oil's life as one tall tile beside them. Tapping the odometer updates it. */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-3">
              {parts.length ? (
                <Card tone={nextKm != null && nextKm <= 1000 ? 'amber' : 'white'} className="flex-1 justify-between gap-3 px-4 py-4">
                  <TileHead icon={Wrench} label={t('home.nextService')} />
                  <Num value={nextKm != null ? fmt(nextKm) : '—'} unit={nextKm != null ? partUnit : undefined} size={34} />
                </Card>
              ) : null}
              <View ref={odometerTarget} collapsable={false} className={parts.length ? '' : 'flex-1'}>
                <Animated.View key={vehicle.id} entering={SWAP}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t(hasReading(vehicle) ? 'home.updateOdometer' : 'reading.card.cta')}
                    onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}>
                    <Card className="gap-3 px-4 py-4">
                      <TileHead icon={Gauge} label={hasReading(vehicle) ? (days > 0 ? t('home.lastReading', { count: days }) : t('home.lastReadingToday')) : t('home.odometer')} />
                      {hasReading(vehicle) ? <Num value={vehicle.current_odometer.toLocaleString('en-US')} unit={unit} size={34} /> : <Text variant="label">{t('reading.card.cta')}</Text>}
                    </Card>
                  </PressableScale>
                </Animated.View>
              </View>
            </View>
            {parts.length ? (
              <Card tone={!oil ? 'white' : oil.status.state === 'overdue' ? 'blush' : oil.status.state === 'soon' ? 'amber' : 'mint'} className="flex-1 justify-between gap-3 px-4 py-4">
                <TileHead icon={Droplets} label={t('home.oilLife')} />
                <View className="items-center gap-2">
                  {oil ? <PartArt nameEn={oil.serviceType.name_en} size={64} state={oil.status.state === 'overdue' ? 'late' : oil.status.state === 'soon' ? 'soon' : 'ok'} /> : null}
                  <Num value={oilLife != null ? String(Math.round(oilLife * 100)) : '—'} unit={oilLife != null ? '%' : undefined} size={40} />
                </View>
                <Ticks on={oilLife != null ? Math.round(oilLife * 12) : 0} color={oilColor} height={20} />
              </Card>
            ) : null}
          </View>

          <VoiceQueueCard vehicleId={vehicle.id} />

          <View ref={priorityTarget} collapsable={false} className="gap-2">
            {urgent.length || (!partsLoading && parts.length) ? (
              <View className="flex-row items-center justify-between px-1 pt-2">
                <Text variant="caption" className="text-muted">{t('home.alerts')}</Text>
                <PressableScale accessibilityRole="button" hitSlop={10} onPress={() => openDetails(vehicle, 'home', { tab: 'reminders', fly: false })}>
                  <Text variant="caption">{t('home.viewAll')}</Text>
                </PressableScale>
              </View>
            ) : null}
            <Rise key={vehicle.id}>
              {partsLoading ? (
                <Card className="min-h-[72px] flex-row items-center gap-3 p-3.5">
                  <View className="flex-1 flex-row items-center gap-3" accessibilityLabel={t('home.loading')}>
                    <View className="h-[50px] w-[50px] rounded-full bg-paper" />
                    <View className="flex-1 gap-1.5">
                      <View className="h-3.5 w-3/5 rounded-full bg-paper" />
                      <View className="h-3 w-2/5 rounded-full bg-paper" />
                    </View>
                  </View>
                </Card>
              ) : urgent.length ? (
                <View className="gap-2">
                  {urgent.map((p) => <AlertRow key={p.serviceType.id} part={p} vehicle={vehicle} name={partName(i18n.language, p)} />)}
                </View>
              ) : parts.length ? (
                <AllClear next={next} vehicle={vehicle} name={next ? partName(i18n.language, next) : ''} />
              ) : (
                // Flow 7: nothing logged yet, so say how to log the first thing.
                <Card className="items-center gap-1 px-5 py-6">
                  <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-lime"><Mic size={26} color="#171B19" /></View>
                  <Text variant="heading" className="mt-3 text-center">{t('home.noRecords.title')}</Text>
                  <Text variant="caption" className="text-center text-muted">{t('home.noRecords.body')}</Text>
                  <View className="mt-3 flex-row gap-2">
                    {(['oil', 'fuel', 'brakes'] as const).map((k) => (
                      <View key={k} className="rounded-full bg-paper px-3 py-2"><Text variant="caption">{t(`home.noRecords.${k}`)}</Text></View>
                    ))}
                  </View>
                </Card>
              )}
            </Rise>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Home with no car yet.
function Empty() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const refresh = useRefresh(insets.top, c.muted);
  const space = useTabBarSpace();
  const { t } = useTranslation();
  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerClassName="grow gap-4 px-5" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: space }}>
      <View className="flex-row items-center gap-3">
        <MenuButton />
        <View className="flex-1" />
        <BellButton tone="paper" />
      </View>
      <Animated.View entering={POP} className="mt-6 h-[150px] w-[150px] items-center justify-center self-center rounded-full bg-white">
        <View className="h-[100px] w-[100px] items-center justify-center rounded-full bg-lime">
          <Car size={48} color="#171B19" />
        </View>
      </Animated.View>
      <Rise index={1}><Text variant="title" className="text-center">{t('home.empty.heading')}</Text></Rise>
      <Rise index={2}><Text variant="body" className="text-center text-muted">{t('home.empty.body')}</Text></Rise>
      <Button title={t('home.empty.cta')} onPress={() => router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })} />
    </ScrollView>
  );
}

/** Home while the first answer is on its way: the same shapes as Today, soft and empty. */
function Skeleton() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  return (
    <View className="flex-1 gap-4 bg-paper px-5" style={{ paddingTop: insets.top + 8, paddingBottom: space }} accessibilityLabel={t('home.loading')}>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 rounded-full bg-white" />
        <View className="h-11 w-40 rounded-full bg-white" />
      </View>
      <View className="h-[160px] w-4/5 self-center rounded-[24px] bg-white" />
      <Card className="h-[88px]">{null}</Card>
      <View className="flex-row gap-3">
        <Card className="h-[110px] flex-1">{null}</Card>
        <Card className="h-[110px] flex-1">{null}</Card>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { vehicle, isPending, isError, data, dataUpdatedAt, refetch, isRefetching } = useCurrentVehicle();
  const online = useOnline();
  const showSaved = useShowSaved((s) => s.since);
  const onShowSaved = useShowSavedAction();
  useEffect(() => {
    if (showSaved && online && dataUpdatedAt > showSaved) useShowSaved.getState().set(null); // Q46: cleared by the next successful fetch
  }, [showSaved, dataUpdatedAt, online]);
  if (isError && !data) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  if (isPending && !online && !data) return <ErrorState onRetry={refetch} retrying={isRefetching} />; // offline + nothing saved: the query is paused, not failed
  if (isPending) return <Skeleton />;
  if (vehicle && (!online || showSaved != null)) return <OfflineHome vehicle={vehicle} />; // Q45 / Q46
  return vehicle ? <Today vehicle={vehicle} /> : <Empty />;
}
