import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { consumption } from '@/lib/fuel';
import { useFuelFills } from '@/lib/queries';
import { Card, Text } from './ui';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Average fuel consumption of a car, once two full tanks have both litres and a reading. `hint`: say how to get it until then. */
export function FuelCard({ vehicleId, hint }: { vehicleId: string; hint?: boolean }) {
  const { t } = useTranslation();
  const c = consumption(useFuelFills(vehicleId).data ?? []);
  if (!c) return hint ? <Text variant="caption" className="text-muted">{t('fuel.hint')}</Text> : null;
  return (
    <Card className="gap-3 p-4">
      <Text variant="label">{t('fuel.title')}</Text>
      <View className="flex-row gap-4">
        <View className="flex-1 gap-0.5">
          <Text variant="small-number">{fmt(c.average.kmPerLiter)}</Text>
          <Text variant="caption" className="text-muted">{t('fuel.kmPerLiter')}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="small-number">{fmt(c.average.costPerKm)}</Text>
          <Text variant="caption" className="text-muted">{t('fuel.costPerKm')}</Text>
        </View>
      </View>
    </Card>
  );
}
