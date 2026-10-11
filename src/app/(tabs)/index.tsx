import { differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Bell, Car, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Fuel, Plus, RefreshCw, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { FlatList, I18nManager, Pressable, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { useLightStatusBar } from '@/components/Hero';
import { OfflineHome } from '@/components/OfflineHome';
import { VoiceQueueCard } from '@/components/VoiceQueueCard';
import { Button, Item, PressableScale, Rise, Text } from '@/components/ui';
import { needsAttention, useCurrentVehicle, useExpenses, useFuelFills, useIsGuest, useVehicleParts, useVehicles, vehicleName, type Part, type Vehicle, useProfile } from '@/lib/queries';
import { consumption } from '@/lib/fuel';
import { EASE_OUT, POP, SWAP } from '@/lib/motion';
import { useOnline, useShowSaved } from '@/lib/online';
import { pickVehicle } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useInbox } from '@/stores/notifyInbox';
import { useSettings } from '@/stores/settingsStore';

const num = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-US');
const iconOf = (name?: string | null): LucideIcon => (name && (Icons as any)[name]) || Icons.Wrench;

function LightBar() {
  useLightStatusBar();
  return null;
}

/** Part subtitle per decisions Q10 (overdue: km if past due in km, else days; soon: both when known). */
function subtitle(t: TFunction, lang: string, p: Part, unit: string) {
  const u = t(`home.${unit}`);
  const { state, remainingKm: km, remainingDays: d, dueOdometer, dueDate } = p.status;
  if (state === 'overdue') return km != null && km <= 0 ? t('home.overdueDist', { km: num(km), unit: u }) : t('home.overdueDays', { d: num(d!) });
  if (state === 'soon') {
    if (km != null && d != null) return t('home.soonBoth', { km: num(km), unit: u, d: num(d) });
    return km != null ? t('home.soonDist', { km: num(km), unit: u }) : t('home.soonDays', { d: num(d!) });
  }
  return dueOdometer != null
    ? t('home.dueAt', { km: num(dueOdometer), unit: u })
    : t('home.dueOn', { date: format(parseISO(dueDate!), 'd MMM yyyy', { locale: lang === 'ar' ? ar : enUS }) });
}

const partName = (lang: string, p: Part) => (lang === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en);

function useFirstName() {
  const { data } = useProfile();
  return data?.full_name?.trim().split(/\s+/)[0] ?? '';
}

function Bell_() {
  const c = useColors();
  const { t } = useTranslation();
  const guest = useIsGuest();
  const unread = useInbox((s) => s.items.some((i) => !i.read)); // Q92 (replaces Q13's "no badge")
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={unread ? `${t('home.notifications')}, ${t('inbox.unread')}` : t('home.notifications')}
      onPress={() => (guest ? router.push({ pathname: '/feature-gate', params: { feature: 'reminders' } }) : router.push('/notifications'))}
      className="h-10 w-10 items-center justify-center rounded-full bg-white">
      <Bell size={20} color={c.ink} />
      {unread ? <View className="absolute end-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-coral" /> : null}
    </PressableScale>
  );
}

// Screen 06 — Home / Today; ar-light 06/الرئيسية/سيارتي اليوم.png
function Today({ vehicle }: { vehicle: Vehicle }) {
  const refresh = useRefresh();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const name = useFirstName();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts, isPending: partsLoading } = useVehicleParts(vehicle);
  const expenses = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle.id);
  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));
  const urgent = needsAttention(parts).slice(0, 3);

  // Q14/Q32: last 6 calendar months of this vehicle's expenses (a log's cost is an expense too), oldest to newest.
  const first = startOfMonth(subMonths(new Date(), 5));
  const totals = Array.from({ length: 6 }, (_, i) => {
    const key = format(subMonths(first, -i), 'yyyy-MM');
    return expenses.filter((e) => e.expense_date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
  });
  const max = Math.max(...totals, 1);

  const pick = () => pickVehicle(vehicle.id, setCurrent);
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
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingBottom: 120 }}>
      <LightBar />
      {/* Q95: one column, top to bottom: who → the car → which car (name + dots) → its odometer. */}
      <View className="gap-3 rounded-b-[28px] bg-panel px-6 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }}>
              {t(new Date().getHours() < 12 ? 'home.greetingMorning' : 'home.greetingEvening', { name })}
            </Text>
            <Text variant="heading" className="text-onpanel">{t('home.title')}</Text>
          </View>
          <Bell_ />
        </View>
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
              <Image source={vehicleArt(item.vehicle_type)} contentFit="contain" style={{ width: 240, height: 120 }} />
            </View>
          )}
        />
        <View className="items-center gap-2">
          <Pressable
            onPress={pick}
            disabled={vehicles.length < 2}
            accessibilityRole={vehicles.length > 1 ? 'button' : undefined}
            accessibilityLabel={vehicles.length > 1 ? t('home.switchVehicle') : undefined}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-[#FFFFFF1F] px-3.5">
            <Text variant="caption" className="text-onpanel" style={{ fontFamily: i18n.language === 'ar' ? 'Tajawal_700Bold' : 'Poppins_700Bold' }}>
              {`${vehicleName(vehicle)} · ${vehicle.year}`}
            </Text>
            {vehicles.length > 1 ? <ChevronDown size={16} color={c.lime} /> : null}
          </Pressable>
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
        <Animated.View key={vehicle.id} entering={SWAP} className="flex-row items-center gap-3 rounded-metric bg-[#FFFFFF1A] px-4 py-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.75 }}>
              {days > 0 ? t('home.lastReading', { count: days }) : t('home.lastReadingToday')}
            </Text>
            <View className="flex-row items-baseline gap-1.5">
              <Text variant="small-number" className="text-onpanel">{vehicle.current_odometer.toLocaleString('en-US')}</Text>
              <Text variant="caption" className="text-onpanel" style={{ opacity: 0.75 }}>{unit}</Text>
            </View>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('home.updateOdometer')}
            onPress={() => router.push('/update-odometer')}
            className="h-11 w-11 items-center justify-center rounded-full bg-lime">
            <RefreshCw size={20} color="#222E29" />
          </PressableScale>
        </Animated.View>
      </View>

      <View className="gap-3 px-6 pt-4">
        <VoiceQueueCard vehicleId={vehicle.id} />
        <View className="flex-row items-center justify-between">
          <Text variant="heading">{t('home.priority')}</Text>
          <Pressable onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id, tab: 'reminders' } })} hitSlop={8}>
            <Text variant="caption" className="text-teal">{t('home.viewAll')}</Text>
          </Pressable>
        </View>
        {/* Q95/Q96: the same card for every car and every state: loading, the top 3 (Q10) split by lines
            (an overdue line in red), all on schedule, or no services logged yet. */}
        <Rise key={vehicle.id}>
          <View className="rounded-item bg-white px-3.5" style={{ boxShadow: shadows.card }}>
            {partsLoading ? (
              <View className="min-h-[56px] flex-row items-center gap-3 py-2" accessibilityLabel={t('home.loading')}>
                <View className="h-9 w-9 rounded-full bg-line" />
                <View className="flex-1 gap-1.5">
                  <View className="h-3.5 w-3/5 rounded-full bg-line" />
                  <View className="h-3 w-2/5 rounded-full bg-line" />
                </View>
              </View>
            ) : urgent.length ? (
              urgent.map((p, i) => {
                const overdue = p.status.state === 'overdue';
                const Icon = iconOf(p.serviceType.icon);
                return (
                  <PressableScale
                    key={p.serviceType.id}
                    accessibilityRole="button"
                    scale={0.98}
                    onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
                    className={`min-h-[56px] flex-row items-center gap-3 py-2 ${i < urgent.length - 1 ? 'border-b border-line' : ''}`}>
                    <View className={`h-9 w-9 items-center justify-center rounded-full ${overdue ? 'bg-blush' : 'bg-amber'}`}>
                      <Icon size={18} color={c.teal} />
                    </View>
                    <View className="flex-1">
                      <Text variant="label">{t(overdue ? 'home.overdueTitle' : 'home.soonTitle', { part: partName(i18n.language, p) })}</Text>
                      <Text variant="caption" className={overdue ? 'text-danger' : 'text-muted'}>{subtitle(t, i18n.language, p, vehicle.odometer_unit)}</Text>
                    </View>
                    <Chevron size={18} color={c.muted} />
                  </PressableScale>
                );
              })
            ) : (
              <PressableScale
                accessibilityRole="button"
                scale={0.98}
                onPress={() => (parts.length ? router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id, tab: 'reminders' } }) : router.push('/capture'))}
                className="min-h-[56px] flex-row items-center gap-3 py-2">
                <View className={`h-9 w-9 items-center justify-center rounded-full ${parts.length ? 'bg-mint' : 'bg-sky'}`}>
                  {parts.length ? <CircleCheck size={18} color={c.teal} /> : <Plus size={18} color={c.teal} />}
                </View>
                <View className="flex-1">
                  <Text variant="label">{t(parts.length ? 'home.allGoodTitle' : 'home.noParts.title')}</Text>
                  <Text variant="caption" className="text-muted">{t(parts.length ? 'home.allGood' : 'home.noParts.body')}</Text>
                </View>
                <Chevron size={18} color={c.muted} />
              </PressableScale>
            )}
          </View>
        </Rise>

        {/* Q95: this month's expenses (Q14: the 6 bars never animate) and fuel (Q91) in one card. */}
        <View className="gap-2 rounded-item bg-white px-4 py-3" style={{ boxShadow: shadows.card }}>
          <PressableScale accessibilityRole="button" scale={0.98} onPress={() => router.push('/account/expenses')} className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text variant="caption" className="text-muted">{t('home.expenses')}</Text>
              <Text variant="heading">{`${num(totals[5])} ${t('home.currency')}`}</Text>
            </View>
            <View className="h-[30px] flex-row items-end gap-1.5">
              {totals.map((v, i) => (
                <View key={i} className={`w-2 rounded-full ${i === 5 ? 'bg-lime' : 'bg-line'}`} style={{ height: Math.max(6, (v / max) * 30) }} />
              ))}
            </View>
          </PressableScale>
          {/* Q96: the fuel line is always there; until two full tanks give a figure it says how to get one. */}
          <PressableScale
            accessibilityRole="button"
            scale={0.98}
            onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id } })}
            className="flex-row items-center gap-2 border-t border-line pt-2.5">
            <Fuel size={16} color={c.teal} />
            <Text variant="caption" className="flex-1 text-muted">{t('fuel.title')}</Text>
            {fuel ? (
              <>
                <Text variant="caption" style={{ fontFamily: 'Poppins_700Bold' }}>{fmt(fuel.average.kmPerLiter, 1)}</Text>
                <Text variant="caption" className="text-muted">{`${t('home.kmL')} · ${t('home.perKm', { n: fmt(fuel.average.costPerKm) })}`}</Text>
              </>
            ) : (
              <Text variant="caption" className="text-muted">{t('home.fuelHint')}</Text>
            )}
          </PressableScale>
        </View>
      </View>
    </ScrollView>
  );
}

// Screen 07 — Home / Empty; ar-light 07/الرئيسية/البداية.png
function Empty() {
  const refresh = useRefresh();
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const name = useFirstName();
  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 16 }}>
      <View className="gap-6 px-6">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-muted">{t('home.greeting', { name })}</Text>
            <Text variant="heading">{t('home.empty.title')}</Text>
          </View>
          <Bell_ />
        </View>
        <Animated.View entering={POP} className="h-[200px] items-center justify-center self-center">
          <View className="h-[200px] w-[200px] items-center justify-center rounded-full border-[6px] border-line">
            <View className="h-[120px] w-[120px] items-center justify-center rounded-full bg-panel">
              <Car size={56} color={c.lime} />
            </View>
          </View>
          <View className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-lime">
            <Sparkles size={16} color="#222E29" />
          </View>
        </Animated.View>
        <Rise index={1}><Text variant="title">{t('home.empty.heading')}</Text></Rise>
        <Rise index={2}><Text variant="body" className="text-muted">{t('home.empty.body')}</Text></Rise>
        <Button title={t('home.empty.cta')} onPress={() => router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } })} />
      </View>
    </ScrollView>
  );
}

// Screen 36 — Home / Guest; ar-light 36/الرئيسية/زائر.png
function Guest({ vehicle }: { vehicle: Vehicle | null }) {
  const refresh = useRefresh();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { parts } = useVehicleParts(vehicle);
  const gate = (feature: string) => router.push({ pathname: '/feature-gate', params: { feature, vehicleId: vehicle?.id } });
  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 16 }}>
      <View className="gap-4 px-6">
        <View className="gap-1 rounded-field bg-sky p-4">
          <Text variant="label">{t('home.guest.welcomeTitle')}</Text>
          <Text variant="caption" className="text-muted">{t('home.guest.welcomeBody')}</Text>
        </View>
        <Button title={t('home.guest.create')} variant="dark" onPress={() => router.push('/register')} />
        {vehicle ? (
          <>
            <Text variant="title" className="mt-2">{t('home.guest.yourCar')}</Text>
            <Item icon={Car} title={vehicleName(vehicle)} subtitle={String(vehicle.year)} onPress={() => gate('car')} />
          </>
        ) : null}
        {parts.length ? (
          <>
            <Text variant="heading" className="mt-2">{t('home.guest.upcoming')}</Text>
            {parts.slice(0, 2).map((p) => (
              <Item
                key={p.serviceType.id}
                icon={iconOf(p.serviceType.icon)}
                tone={p.status.state === 'ok' ? 'mint' : 'amber'}
                title={partName(i18n.language, p)}
                subtitle={subtitle(t, i18n.language, p, vehicle!.odometer_unit)}
                onPress={() => gate('reminders')}
              />
            ))}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const guest = useIsGuest();
  const { vehicle, isPending, isError, data, dataUpdatedAt, refetch, isRefetching } = useCurrentVehicle();
  const online = useOnline();
  const showSaved = useShowSaved((s) => s.since);
  const onShowSaved = useShowSavedAction();
  useEffect(() => {
    if (showSaved && online && dataUpdatedAt > showSaved) useShowSaved.getState().set(null); // Q46: cleared by the next successful fetch
  }, [showSaved, dataUpdatedAt, online]);
  if (guest) return <Guest vehicle={vehicle} />;
  if (isError && !data) return <ErrorState onRetry={refetch} retrying={isRefetching} onShowSaved={onShowSaved} />;
  if (isPending) return <View className="flex-1 bg-paper" />;
  if (vehicle && (!online || showSaved != null)) return <OfflineHome vehicle={vehicle} />; // Q45 / Q46
  return vehicle ? <Today vehicle={vehicle} /> : <Empty />;
}
