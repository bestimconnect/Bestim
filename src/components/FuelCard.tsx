import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { consumption } from '@/lib/fuel';
import { useExpenses } from '@/lib/queries';
import { shadows } from '@/lib/theme';
import { Text } from './ui';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Average fuel consumption of a car, once two of its fill-ups have both litres and a reading. `hint`: say how to get it until then. */
export function FuelCard({ vehicleId, hint }: { vehicleId: string; hint?: boolean }) {
  const { t } = useTranslation();
  const fills = (useExpenses().data ?? []).filter((e) => e.vehicle_id === vehicleId && e.category === 'fuel');
  const c = consumption(fills);
  if (!c) return hint ? <Text variant="caption" className="text-muted">{t('fuel.hint')}</Text> : null;
  return (
    <View className="gap-3 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
      <Text variant="label">{t('fuel.title')}</Text>
      <View className="flex-row gap-4">
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{fmt(c.average.kmPerLiter)}</Text>
          <Text variant="caption" className="text-muted">{t('fuel.kmPerLiter')}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{fmt(c.average.costPerKm)}</Text>
          <Text variant="caption" className="text-muted">{t('fuel.costPerKm')}</Text>
        </View>
      </View>
    </View>
  );
}
