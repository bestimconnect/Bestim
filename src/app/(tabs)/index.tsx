import { differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { router } from 'expo-router';
import * as Icons from 'lucide-react-native';
import { Bell, Car, ChevronLeft, ChevronRight, RefreshCw, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, I18nManager, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useRefresh } from '@/components/Refresh';
import { ErrorState, useShowSavedAction } from '@/components/ErrorState';
import { useLightStatusBar } from '@/components/Hero';
import { OfflineHome } from '@/components/OfflineHome';
import { Button, Item, Metric, Text } from '@/components/ui';
import { needsAttention, useCurrentVehicle, useExpenses, useIsGuest, useVehicleParts, useVehicles, type Part, type Vehicle, useProfile } from '@/lib/queries';
import { useOnline, useShowSaved } from '@/lib/online';
import { useColors } from '@/lib/theme';
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.notifications')}
      onPress={() => (guest ? router.push({ pathname: '/feature-gate', params: { feature: 'reminders' } }) : router.push('/reminders'))}
      className="h-10 w-10 items-center justify-center rounded-full bg-white">
      <Bell size={20} color={c.ink} />
    </Pressable>
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
  const { parts } = useVehicleParts(vehicle);
  const expenses = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicle.id);
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  const days = differenceInCalendarDays(new Date(), parseISO(vehicle.odometer_updated_at));
  const urgent = needsAttention(parts).slice(0, 3);

  // Q14/Q32: last 6 calendar months of this vehicle's expenses (a log's cost is an expense too), oldest to newest.
  const first = startOfMonth(subMonths(new Date(), 5));
  const totals = Array.from({ length: 6 }, (_, i) => {
    const key = format(subMonths(first, -i), 'yyyy-MM');
    return expenses.filter((e) => e.expense_date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
  });
  const max = Math.max(...totals, 1);

  const pick = () =>
    Alert.alert(t('home.switchVehicle'), undefined, vehicles.map((v) => ({ text: `${v.make} ${v.model} · ${v.year}`, onPress: () => setCurrent(v.id) })));

  return (
    <ScrollView refreshControl={refresh} className="flex-1 bg-paper" contentContainerStyle={{ paddingBottom: 120 }}>
      <LightBar />
      <View className="gap-5 rounded-b-[28px] bg-panel px-6 pb-6" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" className="text-onpanel" style={{ opacity: 0.7 }}>
              {t(new Date().getHours() < 12 ? 'home.greetingMorning' : 'home.greetingEvening', { name })}
            </Text>
            <Text variant="heading" className="text-onpanel">{t('home.title')}</Text>
          </View>
          <Bell_ />
        </View>
        <Pressable onPress={pick} disabled={vehicles.length < 2} className="flex-row items-center gap-2">
          <Text variant="label" className="flex-1 text-onpanel">{`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}</Text>
          {vehicles.length > 1 ? <Chevron size={18} color={c.lime} /> : null}
        </Pressable>
        <Metric
          label={days > 0 ? t('home.lastReading', { count: days }) : t('home.lastReadingToday')}
          value={vehicle.current_odometer.toLocaleString('en-US')}
          aside={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.updateOdometer')}
              onPress={() => router.push('/update-odometer')}
              className="h-11 w-11 items-center justify-center rounded-full bg-lime">
              <RefreshCw size={20} color="#222E29" />
            </Pressable>
          }
        />
      </View>

      <View className="gap-3 px-6 pt-6">
        <View className="flex-row items-center justify-between">
          <Text variant="heading">{t('home.priority')}</Text>
          <Pressable onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id, tab: 'reminders' } })}>
            <Text variant="caption" className="text-teal">{t('home.viewAll')}</Text>
          </Pressable>
        </View>
        {urgent.length ? (
          urgent.map((p) => {
            const Icon = iconOf(p.serviceType.icon);
            const overdue = p.status.state === 'overdue';
            return (
              <Pressable
                key={p.serviceType.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: p.serviceType.id } })}
                className={`min-h-[72px] flex-row items-center gap-3 rounded-item p-3.5 active:opacity-80 ${overdue ? 'bg-blush' : 'bg-amber'}`}>
                <Icon size={22} color={c.ink} />
                <View className="flex-1 gap-0.5">
                  <Text variant="label">{t(overdue ? 'home.overdueTitle' : 'home.soonTitle', { part: partName(i18n.language, p) })}</Text>
                  <Text variant="caption" className="text-muted">{subtitle(t, i18n.language, p, vehicle.odometer_unit)}</Text>
                </View>
                <Chevron size={18} color={c.ink} />
              </Pressable>
            );
          })
        ) : (
          <Text variant="body" className="text-muted">{t('home.allGood')}</Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/account/expenses')}
          className="mt-2 flex-row items-end gap-4 rounded-item border border-line bg-white p-4 active:opacity-80">
          <View className="flex-1 gap-1">
            <Text variant="caption" className="text-muted">{t('home.expenses')}</Text>
            <Text variant="heading">{`${num(totals[5])} ${t('home.currency')}`}</Text>
          </View>
          <View className="h-10 flex-row items-end gap-1.5">
            {totals.map((v, i) => (
              <View key={i} className={`w-2 rounded-full ${i === 5 ? 'bg-lime' : 'bg-line'}`} style={{ height: Math.max(6, (v / max) * 40) }} />
            ))}
          </View>
        </Pressable>
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
        <View className="h-[200px] items-center justify-center self-center">
          <View className="h-[200px] w-[200px] items-center justify-center rounded-full border-[6px] border-line">
            <View className="h-[120px] w-[120px] items-center justify-center rounded-full bg-panel">
              <Car size={56} color={c.lime} />
            </View>
          </View>
          <View className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-lime">
            <Sparkles size={16} color="#222E29" />
          </View>
        </View>
        <Text variant="title">{t('home.empty.heading')}</Text>
        <Text variant="body" className="text-muted">{t('home.empty.body')}</Text>
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
            <Item icon={Car} title={`${vehicle.make} ${vehicle.model}`} subtitle={String(vehicle.year)} onPress={() => gate('car')} />
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
