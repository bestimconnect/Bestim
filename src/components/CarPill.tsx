import { Image } from 'expo-image';
import { Car, ChevronDown } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { useAllCars, useCurrentVehicle, useVehicles, vehicleName } from '@/lib/queries';
import { pickVehicle } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';
import { useSettings } from '@/stores/settingsStore';

/**
 * Header idea 3 (founder, 2026-11-03): the car you are looking at, on top of every tab. Every tab shows this car's data;
 * with two or more cars the pill opens the switcher. `panel` sits on a green block (Home), `paper` on the light page.
 */
export function CarPill({ tone = 'paper', allCars = false }: { tone?: 'panel' | 'paper'; allCars?: boolean }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { vehicle } = useCurrentVehicle();
  const many = (useVehicles().data?.length ?? 0) > 1;
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const set = useSettings((s) => s.set);
  const showAll = useAllCars() && allCars; // only Expenses can show every car
  if (!vehicle) return null;
  const panel = tone === 'panel';
  return (
    <PressableScale
      accessibilityRole={many ? 'button' : undefined}
      accessibilityLabel={many ? t('home.switchVehicle') : undefined}
      disabled={!many}
      onPress={() =>
        pickVehicle(vehicle.id, (id) => { set({ expensesAll: false }); setCurrent(id); }, allCars ? { active: showAll, onPick: () => set({ expensesAll: true }) } : undefined)
      }
      className={`h-11 shrink flex-row items-center gap-2 rounded-full ps-2 pe-3.5 ${panel ? 'bg-[#FFFFFF24]' : 'border border-[#1018140D] bg-white'}`}
      style={panel ? undefined : { boxShadow: shadows.lift }}>
      {showAll ? <Car size={22} color={panel ? c.lime : c.teal} /> : <Image source={vehicleArt(vehicle.vehicle_type)} contentFit="contain" style={{ width: 44, height: 22 }} />}
      <Text variant="caption" numberOfLines={1} className={`shrink ${panel ? 'text-onpanel' : 'text-ink'}`} style={{ fontFamily: i18n.language === 'ar' ? 'Tajawal_700Bold' : 'Poppins_700Bold' }}>
        {showAll ? t('expenses.allCars') : `${vehicleName(vehicle)} · ${vehicle.year}`}
      </Text>
      {many ? <ChevronDown size={16} color={panel ? c.lime : c.teal} /> : <View />}
    </PressableScale>
  );
}
