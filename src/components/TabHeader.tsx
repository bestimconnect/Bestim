import { View } from 'react-native';

import { CarPill } from '@/components/CarPill';
import { BellButton, Text } from '@/components/ui';

/** The top of Expenses, Cars and Account (header idea 3): no bar, the car pill and the bell on the page, then a large title. */
export function TabHeader({ title, allCars }: { title: string; allCars?: boolean }) {
  return (
    <View className="gap-3 pt-2">
      <View className="flex-row items-center gap-3">
        <CarPill allCars={allCars} />
        <View className="flex-1" />
        <BellButton tone="paper" />
      </View>
      <Text variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
    </View>
  );
}
