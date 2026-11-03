import { differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Car, ChevronLeft, ChevronRight, CircleCheck, Droplets, Fuel, Plus, RefreshCw, Sparkles } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { FlatList, I18nManager, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarSpace } from '@/components/TabBar';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { useLightStatusBar } from '@/components/Hero';
import { PartBadge } from '@/components/PartStatus';
import { OfflineHome } from '@/components/OfflineHome';
import { usePlanTour } from '@/components/PlanStrip';
import { VoiceQueueCard } from '@/components/VoiceQueueCard';
import { Backdrop, BellButton, Button, Card, IconTile, PressableScale, Rise, Section, Text } from '@/components/ui';
import { CarPhoto } from '@/components/CarPhoto';
import { CarPill } from '@/components/CarPill';
import { useAppBarHero } from '@/lib/appBar';
import { useTourTarget } from '@/lib/tour';
import { openDetails } from '@/lib/carFlight';
import { useFirstRun } from '@/lib/firstRun';
import { hasReading } from '@/lib/reading';
import { needsAttention, useCurrentVehicle, useExpenses, useFuelFills, useVehicleParts, useVehicles, type Part, type Vehicle, useProfile } from '@/lib/queries';
import { consumption } from '@/lib/fuel';
import { EASE_OUT, POP, SWAP } from '@/lib/motion';
import { useOnline, useShowSaved } from '@/lib/online';
import { useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';
import { HeroBlock } from '@/components/HeroBlock';

const num = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-US');

function LightBar() {
  useLightStatusBar();
  return null;
}

const partName = (lang: string, p: Part) => (lang === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en);

function useFirstName() {
  const { data } = useProfile();
  return data?.full_name?.trim().split(/\s+/)[0] ?? '';
}

// Screen 06 — Home / Today; ar-light 06/الرئيسية/سيارتي اليوم.png
function Today({ vehicle }: { vehicle: Vehicle }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onHero = useAppBarHero();
  const refresh = useRefresh(insets.top, '#D3F53D'); // Home draws under the status bar: keep the spinner clear of the notch
  const { started } = useFirstRun();
  usePlanTour(started);
  const odometerTarget = useTourTarget('odometer');
  const priorityTarget = useTourTarget('priority');
  const space = useTabBarSpace();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts, isPending: partsLoading } = useVehicleParts(vehicle);
  const expenses = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle.id);
  const days = vehicle.odometer_updated_at ? differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at)) : 0;
  const urgent = needsAttention(parts).slice(0, 3);

  // Q14/Q32: last 6 calendar months of this vehicle's expenses (a log's cost is an expense too), oldest to newest.
  const first = startOfMonth(subMonths(new Date(), 5));
  const totals = Array.from({ length: 6 }, (_, i) => {
    const key = format(subMonths(first, -i), 'yyyy-MM');
    return expenses.filter((e) => e.expense_date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
  });
  const max = Math.max(...totals, 1);

  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;

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

  const unit = t(`home.${vehicle.odometer_unit}`);
  const fuel = consumption(useFuelFills(vehicle.id).data ?? []);
  const fmt = (x: number, d = 2) => x.toLocaleString('en-US', { maximumFractionDigits: d });

  return (
    // The scroll area itself is dark and the content is the page colour: pulling down shows more of the dark top
    // with the spinner on it (a dark filler view on top of the content would cover the spinner).
    <ScrollView refreshControl={refresh} className="flex-1 bg-panel" contentContainerClassName="grow bg-paper" contentContainerStyle={{ paddingBottom: space }}>
      <LightBar />
      {/* One column, top to bottom: who → which car (name) → the car → dots → its odometer. */}
      <HeroBlock onLayout={onHero} style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center gap-3">
          <CarPill tone="panel" />
          <View className="flex-1" />
          <BellButton />
        </View>
        <Text variant="heading" className="text-onpanel">{t('home.title')}</Text>
        <FlatList
          ref={pager}
          horizontal
          pagingEnabled
          data={vehicles}
          keyExtractor={(v) => v.id}
          scrollEnabled={vehicles.length > 1}
          showsHorizontalScrollIndicator={false}
          className="-mx-6"
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={index}
          onContentSizeChange={() => {
            if (placed.current) return;
            placed.current = true;
            pager.current?.scrollToIndex({ index: page.current, animated: false });
          }}
          onMomentumScrollEnd={onSettle}
          renderItem={({ item }) => (
            <View style={{ width, height: 120 }} className="items-center justify-center">
              <CarPhoto vehicle={item} width={240} height={120} slot="home" onPress={() => openDetails(item, 'home')} />
            </View>
          )}
        />
        <View className="items-center gap-2">
          {vehicles.length > 1 ? (
            <View className="flex-row justify-center gap-1.5">
              {vehicles.map((v) => (
                <Animated.View
                  key={v.id}
                  className={`h-1.5 rounded-full ${v.id === vehicle.id ? 'bg-lime' : 'bg-onpanel'}`}
                  style={{ width: v.id === vehicle.id ? 16 : 6, opacity: v.id === vehicle.id ? 1 : 0.3, transitionProperty: ['width', 'opacity'], transitionDuration: '220ms', transitionTimingFunction: EASE_OUT }}
                />
              ))}
            </View>
          ) : null}
        </View>
        {/* Keyed by vehicle: the odometer fades in fresh when the vehicle changes instead of popping. */}
        <View ref={odometerTarget} collapsable={false}>
        <Animated.View key={vehicle.id} entering={SWAP} className="flex-row items-center gap-3 rounded-metric bg-[#FFFFFF1A] px-4 py-3">
          {hasReading(vehicle) ? (
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="caption" numberOfLines={1} className="text-onpanel" style={{ opacity: 0.75 }}>
              {days > 0 ? t('home.lastReading', { count: days }) : t('home.lastReadingToday')}
            </Text>
            <View className="flex-row items-baseline gap-1.5">
              <Text variant="small-number" className="text-onpanel">{vehicle.current_odometer.toLocaleString('en-US')}</Text>
              <Text variant="caption" className="text-onpanel" style={{ opacity: 0.75 }}>{unit}</Text>
            </View>
          </View>
          ) : (
            // Q105: no first reading yet; records wait for it.
            <View className="flex-1 gap-0.5">
              <Text variant="label" className="text-onpanel">{t('reading.card.title')}</Text>
              <Text variant="caption" className="text-onpanel" style={{ opacity: 0.75 }}>{t('reading.card.body')}</Text>
            </View>
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t(hasReading(vehicle) ? 'home.updateOdometer' : 'reading.card.cta')}
            onPress={() => router.push({ pathname: '/update-odometer', params: { vehicleId: vehicle.id } })}
            className="h-11 shrink-0 flex-row items-center gap-1.5 rounded-full bg-lime px-4">
            {hasReading(vehicle) ? <RefreshCw size={18} color="#222E29" /> : <Plus size={18} color="#222E29" />}
            <Text variant="label" className="text-[#222E29]">{t(hasReading(vehicle) ? 'home.update' : 'reading.card.cta')}</Text>
          </PressableScale>
        </Animated.View>
        </View>
      </HeroBlock>

      {/* Below the hero: the page's depth layer (absolute, starts under the green block) and three blocks 24 apart. */}
      <View className="flex-1 gap-6 px-6 pb-2 pt-6">
        <Backdrop />
        <VoiceQueueCard vehicleId={vehicle.id} />
        <View ref={priorityTarget} collapsable={false}>
          <Section title={t('home.priority')} action={t('home.viewAll')} onAction={() => openDetails(vehicle, 'home', { tab: 'reminders', fly: false })} />
          {/* Q95/Q96: the same card for every car and every state: loading, the top 3 (Q10) split by lines
              (an overdue line in red), all on schedule, or no services logged yet. */}
          <Rise key={vehicle.id}>
            {urgent.length && !partsLoading ? (
              <Card className="flex-row justify-around px-2 py-4">
                {urgent.map((p) => (
                  <PartBadge
                    key={p.serviceType.id}
                    part={p}
                    name={partName(i18n.language, p)}
                    unit={t(`vehicles.unit.${vehicle.odometer_unit}`)}
                    onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
                  />
                ))}
              </Card>
            ) : partsLoading ? (
              <Card className="min-h-[72px] flex-row items-center gap-3 p-3.5">
                <View className="flex-1 flex-row items-center gap-3" accessibilityLabel={t('home.loading')}>
                  <View className="h-10 w-10 rounded-[14px] bg-line" />
                  <View className="flex-1 gap-1.5">
                    <View className="h-3.5 w-3/5 rounded-full bg-line" />
                    <View className="h-3 w-2/5 rounded-full bg-line" />
                  </View>
                </View>
              </Card>
            ) : parts.length ? (
              <Card className="min-h-[72px] flex-row items-center gap-3 p-3.5" onPress={() => openDetails(vehicle, 'home', { tab: 'reminders', fly: false })}>
                <IconTile icon={CircleCheck} tone="mint" />
                <View className="flex-1">
                  <Text variant="label" numberOfLines={2}>{t('home.allGoodTitle')}</Text>
                  <Text variant="caption" className="text-muted" numberOfLines={2}>{t('home.allGood')}</Text>
                </View>
                <Chevron size={18} color={c.muted} />
              </Card>
            ) : (
              // Q125: nothing logged yet, so show what a reminder will look like (not tappable, marked as an example).
              <Card className="gap-2 p-3.5">
                <View className="min-h-[56px] flex-row items-center gap-3">
                  <IconTile icon={Droplets} tone="amber" />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text variant="label" numberOfLines={1} className="shrink">{t('home.example.title')}</Text>
                      <View className="rounded-full bg-lime px-2 py-0.5"><Text variant="caption" className="text-[#222E29]">{t('home.example.badge')}</Text></View>
                    </View>
                    <Text variant="caption" className="text-muted" numberOfLines={2}>{t('home.example.sub')}</Text>
                  </View>
                </View>
                <Text variant="caption" className="px-1 text-muted">{t('home.example.note')}</Text>
              </Card>
            )}
          </Rise>
        </View>

        {/* Q95: this month's expenses (Q14: the 6 bars never animate) and fuel (Q91) in one card. */}
        <View>
          <Section title={t('home.expenses')} action={t('home.viewAll')} onAction={() => router.push('/expenses')} />
          <Card>
            <PressableScale accessibilityRole="button" scale={0.99} onPress={() => router.push('/expenses')} className="flex-row items-center gap-3 p-4">
              <View className="flex-1 flex-row items-baseline gap-1.5">
                <Text variant="small-number" numberOfLines={1} className="shrink">{num(totals[5])}</Text>
                <Text variant="caption" className="text-muted">{t('home.currency')}</Text>
              </View>
              <View className="h-[30px] flex-row items-end gap-1.5">
                {totals.map((v, i) => (
                  <View key={i} className={`w-2 rounded-full ${i === 5 ? 'bg-lime' : 'bg-line'}`} style={{ height: Math.max(6, (v / max) * 30) }} />
                ))}
              </View>
            </PressableScale>
            {/* Q96: the fuel line is always there; until two full tanks give a figure it says how to get one. */}
            <View className="mx-4 h-px bg-line" />
            <PressableScale
              accessibilityRole="button"
              scale={0.99}
              onPress={() => openDetails(vehicle, 'home', { fly: false })}
              className="min-h-[52px] flex-row items-center gap-2.5 px-4 py-3">
              <IconTile icon={Fuel} tone="sky" size={32} />
              <Text variant="caption" numberOfLines={1} className="flex-1 text-muted">{t('fuel.title')}</Text>
              {fuel ? (
                <>
                  <Text variant="caption" style={{ fontFamily: 'Poppins_700Bold' }}>{fmt(fuel.average.kmPerLiter, 1)}</Text>
                  <Text variant="caption" numberOfLines={1} className="shrink text-muted">{`${t('home.kmL')} · ${t('home.perKm', { n: fmt(fuel.average.costPerKm) })}`}</Text>
                </>
              ) : (
                <Text variant="caption" numberOfLines={1} className="shrink text-muted">{t('home.fuelHint')}</Text>
              )}
            </PressableScale>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

// Screen 07 — Home / Empty; ar-light 07/الرئيسية/البداية.png
function Empty() {
  const insets = useSafeAreaInsets();
  const refresh = useRefresh(insets.top, '#D3F53D');
  const space = useTabBarSpace();
  const { t } = useTranslation();
  const c = useColors();
  const onHero = useAppBarHero();
  const name = useFirstName();
  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-panel" contentContainerClassName="grow bg-paper" contentContainerStyle={{ paddingBottom: space }}>
      <LightBar />
      <HeroBlock onLayout={onHero} className="gap-5 pb-6" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }}>{t('home.greeting', { name })}</Text>
            <Text variant="heading" className="text-onpanel">{t('home.empty.title')}</Text>
          </View>
          <BellButton />
        </View>
        <Animated.View entering={POP} className="h-[168px] items-center justify-center self-center">
          <View className="h-[168px] w-[168px] items-center justify-center rounded-full border-[6px] border-[#FFFFFF1F]">
            <View className="h-[100px] w-[100px] items-center justify-center rounded-full bg-[#FFFFFF1A]">
              <Car size={48} color={c.lime} />
            </View>
          </View>
          <View className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-lime">
            <Sparkles size={16} color="#222E29" />
          </View>
        </Animated.View>
      </HeroBlock>
      <View className="flex-1 gap-4 px-6 pt-6">
        <Backdrop />
        <Rise index={1}><Text variant="title">{t('home.empty.heading')}</Text></Rise>
        <Rise index={2}><Text variant="body" className="text-muted">{t('home.empty.body')}</Text></Rise>
        <Button title={t('home.empty.cta')} onPress={() => router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })} />
      </View>
    </ScrollView>
  );
}

/** Home while the first answer is on its way: the same shapes as Today, soft and empty. */
function Skeleton() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const onHero = useAppBarHero();
  const space = useTabBarSpace();
  return (
    <View className="flex-1 bg-paper" accessibilityLabel={t('home.loading')}>
      <LightBar />
      <HeroBlock onLayout={onHero} className="gap-4" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-2">
            <View className="h-3 w-1/3 rounded-full bg-[#FFFFFF1F]" />
            <View className="h-4 w-3/5 rounded-full bg-[#FFFFFF1F]" />
          </View>
          <View className="h-11 w-11 rounded-full bg-[#FFFFFF1F]" />
        </View>
        <View className="h-8 w-40 self-center rounded-full bg-[#FFFFFF1F]" />
        <View className="h-[120px] w-60 self-center rounded-item bg-[#FFFFFF14]" />
        <View className="h-[68px] rounded-metric bg-[#FFFFFF1A]" />
      </HeroBlock>
      <View className="flex-1 gap-3 px-6 pt-6" style={{ paddingBottom: space }}>
        <Backdrop />
        <View className="h-5 w-1/3 rounded-full bg-line" />
        <Card className="h-[104px]">{null}</Card>
        <View className="mt-3 h-5 w-1/3 rounded-full bg-line" />
        <Card className="h-[120px]">{null}</Card>
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
