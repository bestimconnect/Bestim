import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Bell, Car, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { I18nManager, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { CarStage } from '@/components/home/CarStage';
import { StatsRow } from '@/components/home/StatsRow';
import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { OfflineHome } from '@/components/OfflineHome';
import { VoiceQueueCard } from '@/components/VoiceQueueCard';
import { Button, Item, PressableScale, Rise, Text } from '@/components/ui';
import { needsAttention, useCurrentVehicle, useIsGuest, useVehicleParts, useVehicles, vehicleName, type Part, type Vehicle, useProfile } from '@/lib/queries';
import { nextDue, statusCounts } from '@/lib/homeStats';
import { POP, SWAP } from '@/lib/motion';
import { useOnline, useShowSaved } from '@/lib/online';
import { pickVehicle } from '@/lib/sheet';
import { useColors } from '@/lib/theme';
import { useInbox } from '@/stores/notifyInbox';
import { useSettings } from '@/stores/settingsStore';

const num = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-US');
const iconOf = (name?: string | null): LucideIcon => (name && (Icons as any)[name]) || Icons.Wrench;

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
      className="h-11 w-11 items-center justify-center rounded-full">
      <Bell size={22} color={c.ink} strokeWidth={1.8} />
      {unread ? <View className="absolute end-2.5 top-2.5 h-2 w-2 rounded-full bg-coral" /> : null}
    </PressableScale>
  );
}

// Screen 06 — Home / Today. Layout: decisions Q94 (car on a lime oval, one row of numbers, a light priority list).
function Today({ vehicle }: { vehicle: Vehicle }) {
  const refresh = useRefresh();
  const { t, i18n } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const name = useFirstName();
  const vehicles = useVehicles().data ?? [];
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const { parts } = useVehicleParts(vehicle);
  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));
  const urgent = needsAttention(parts).slice(0, 3);
  const counts = statusCounts(parts);
  const next = nextDue(parts, urgent);
  const unit = t(`home.${vehicle.odometer_unit}`);
  const toReminders = () => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id, tab: 'reminders' } });
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const status =
    counts.overdue && counts.soon
      ? t('home.statusBoth', { o: counts.overdue, s: counts.soon })
      : counts.overdue
        ? t('home.statusOverdue', { count: counts.overdue })
        : counts.soon
          ? t('home.statusSoon', { count: counts.soon })
          : t('home.viewAll');

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 12 }}>
      <View className="flex-row items-start gap-3 px-6">
        <View className="flex-1 gap-0.5">
          <Text variant="caption" className="text-muted">
            {t(new Date().getHours() < 12 ? 'home.greetingMorning' : 'home.greetingEvening', { name })}
          </Text>
          <Pressable
            onPress={() => pickVehicle(vehicle.id, setCurrent)}
            disabled={vehicles.length < 2}
            accessibilityRole={vehicles.length > 1 ? 'button' : undefined}
            accessibilityLabel={vehicles.length > 1 ? t('home.switchVehicle') : undefined}
            className="flex-row items-center gap-1.5">
            <Text variant="title" numberOfLines={1} className="shrink">{vehicleName(vehicle)}</Text>
            {vehicles.length > 1 ? <ChevronDown size={20} color={c.muted} /> : null}
          </Pressable>
        </View>
        <Bell_ />
      </View>

      <CarStage vehicle={vehicle} vehicles={vehicles} />

      {/* Keyed by vehicle: the figures fade in fresh when the car changes instead of popping (Q57). */}
      <Animated.View key={vehicle.id} entering={SWAP} className="gap-4 px-6 pt-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <View className="flex-row items-baseline gap-1.5">
              <Text variant="number">{vehicle.current_odometer.toLocaleString('en-US')}</Text>
              <Text variant="body" className="text-muted">{unit}</Text>
            </View>
            {/* Q23: a reading 30+ days old is stale; said here in amber, never added to the priority list. */}
            <Text variant="caption" className={days >= 30 ? 'text-[#B7791F]' : 'text-muted'}>
              {days > 0 ? t('home.lastReading', { count: days }) : t('home.lastReadingToday')}
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('home.updateOdometer')}
            onPress={() => router.push('/update-odometer')}
            className="h-[52px] w-[52px] items-center justify-center rounded-full bg-panel">
            <RefreshCw size={22} color={c.lime} />
          </PressableScale>
        </View>

        <StatsRow vehicle={vehicle} next={next} />

        <VoiceQueueCard vehicleId={vehicle.id} />

        <View>
          <View className="flex-row items-center justify-between">
            <Text variant="heading">{t('home.priority')}</Text>
            <Pressable onPress={toReminders} hitSlop={8}>
              <Text variant="caption" className="text-teal">{status}</Text>
            </Pressable>
          </View>
          {urgent.length ? (
            urgent.map((p, i) => {
              const overdue = p.status.state === 'overdue';
              return (
                <Rise key={p.serviceType.id} index={i}>
                  <PressableScale
                    accessibilityRole="button"
                    scale={0.98}
                    onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
                    className={`min-h-[60px] flex-row items-center gap-3 ${i < urgent.length - 1 ? 'border-b border-line' : ''}`}>
                    <View className={`h-2 w-2 rounded-full ${overdue ? 'bg-coral' : 'bg-[#E9B23A]'}`} />
                    <View className="flex-1">
                      <Text variant="label">{partName(i18n.language, p)}</Text>
                      <Text variant="caption" className="text-muted">{subtitle(t, i18n.language, p, vehicle.odometer_unit)}</Text>
                    </View>
                    <Chevron size={18} color={c.muted} />
                  </PressableScale>
                </Rise>
              );
            })
          ) : (
            <Rise><Text variant="body" className="pt-2 text-muted">{t('home.allGood')}</Text></Rise>
          )}
        </View>

        <PressableScale
          accessibilityRole="button"
          scale={0.98}
          onPress={() => router.push({ pathname: '/history', params: { vehicleId: vehicle.id } })}
          className="min-h-[56px] flex-row items-center gap-3 border-t border-line">
          <ClipboardList size={20} color={c.teal} />
          <View className="flex-1">
            <Text variant="label">{t('home.carLog')}</Text>
            <Text variant="caption" className="text-muted">{t('home.carLogSub')}</Text>
          </View>
          <Chevron size={18} color={c.muted} />
        </PressableScale>
      </Animated.View>
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
