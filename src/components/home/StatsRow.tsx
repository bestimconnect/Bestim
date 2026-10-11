import { format } from 'date-fns';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, PressableScale, Text } from '@/components/ui';
import { consumption } from '@/lib/fuel';
import { kmThisMonth } from '@/lib/homeStats';
import { useExpenses, useFuelFills, useOdometerReadings, type Part, type Vehicle } from '@/lib/queries';

const n = (x: number, digits = 0) => x.toLocaleString('en-US', { maximumFractionDigits: digits });

function Column({ label, value, unit, caption, tone, onPress, middle }: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  tone?: string;
  onPress: () => void;
  middle?: boolean;
}): ReactNode {
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-1 items-center gap-0.5 px-1 ${middle ? 'border-x border-line' : ''}`}>
      <Text variant="caption" className="text-center text-muted" numberOfLines={1}>{label}</Text>
      <View className="flex-row items-baseline gap-1">
        <Text variant="small-number" className={tone} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {unit ? <Text variant="caption" className="text-muted">{unit}</Text> : null}
      </View>
      {caption ? <Text variant="caption" className="text-center text-muted" numberOfLines={1}>{caption}</Text> : null}
    </PressableScale>
  );
}

/** Home's row of three (Q94): next service · this month · fuel, in one white card of the UI kit. */
export function StatsRow({ vehicle, next }: { vehicle: Vehicle; next: Part | null }) {
  const { t, i18n } = useTranslation();
  const unit = t(`home.${vehicle.odometer_unit}`);
  const month = format(new Date(), 'yyyy-MM');
  const spent = (useExpenses().data ?? [])
    .filter((e) => e.vehicle_id === vehicle.id && e.expense_date.startsWith(month))
    .reduce((s, e) => s + e.amount, 0);
  const driven = kmThisMonth(useOdometerReadings(vehicle.id).data ?? [], vehicle.current_odometer);
  const fuel = consumption(useFuelFills(vehicle.id).data ?? []);

  // Next service: what's left in distance when the part is measured in distance, else in days.
  let nextValue = '—';
  let nextUnit: string | undefined;
  let nextCaption = t('home.nextNone');
  let nextTone: string | undefined;
  if (next) {
    const { remainingKm, remainingDays, state } = next.status;
    const byKm = remainingKm != null;
    nextValue = n(Math.abs((byKm ? remainingKm : remainingDays) ?? 0));
    nextUnit = byKm ? unit : t('home.days');
    const name = i18n.language === 'ar' ? next.serviceType.name_ar : next.serviceType.name_en;
    nextCaption = state === 'overdue' ? t('home.nextOverdue', { name }) : name;
    nextTone = state === 'overdue' ? 'text-danger' : undefined;
  }

  return (
    <Card className="flex-row px-1 py-4">
      <Column
        label={t('home.next')}
        value={nextValue}
        unit={nextUnit}
        caption={nextCaption}
        tone={nextTone}
        onPress={() =>
          next
            ? router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: next.serviceType.id } })
            : router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id, tab: 'reminders' } })
        }
      />
      <Column
        middle
        label={t('home.thisMonth')}
        value={n(spent)}
        unit={t('home.currency')}
        caption={driven != null ? t('home.kmMonth', { km: n(driven), unit }) : undefined}
        onPress={() => router.push('/account/expenses')}
      />
      <Column
        label={t('home.fuel')}
        value={fuel ? n(fuel.average.kmPerLiter, 1) : '—'}
        unit={fuel ? t('home.kmL') : undefined}
        caption={fuel ? t('home.perKm', { n: n(fuel.average.costPerKm, 2) }) : t('home.fuelHint')}
        onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id } })}
      />
    </Card>
  );
}
