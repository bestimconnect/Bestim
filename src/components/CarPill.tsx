import { Car, ChevronDown } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PressableScale, Text } from '@/components/ui';
import { useAllCars, useCurrentVehicle, vehicleName } from '@/lib/queries';
import { pickVehicle } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

/**
 * Header idea 3 (founder, 2026-11-03): the car you are looking at, on top of every tab. Every tab shows this car's data;
 * v2 (Q133): the pill always opens the My cars sheet (switch, add, manage). `panel` sits on a green block (Home), `paper` on the light page.
 */
export function CarPill({ tone = 'paper', allCars = false }: { tone?: 'panel' | 'paper'; allCars?: boolean }) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { vehicle } = useCurrentVehicle();
  const setCurrent = useSettings((s) => s.setCurrentVehicle);
  const set = useSettings((s) => s.set);
  const showAll = useAllCars() && allCars; // only Expenses can show every car
  if (!vehicle) return null;
  const panel = tone === 'panel';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('vehicles.title')}
      onPress={() =>
        pickVehicle(vehicle.id, (id) => { set({ expensesAll: false }); setCurrent(id); }, allCars ? { active: showAll, onPick: () => set({ expensesAll: true }) } : undefined)
      }
      className={`h-[50px] shrink flex-row items-center gap-2 rounded-full ps-2.5 pe-3.5 ${panel ? 'bg-[#FFFFFF24]' : 'border border-[#1018140D] bg-white'}`}
      style={panel ? undefined : { boxShadow: shadows.lift }}>
      {showAll ? <Car size={22} color={panel ? c.lime : c.ink} /> : (
        // v2 (bug #7): the brand's first letter in a ring, no small car picture.
        <View className="h-[26px] w-[26px] items-center justify-center rounded-full border-[1.6px] border-ink">
          <Text variant="caption" className="!text-[11px] !leading-[14px]" style={{ fontFamily: 'Poppins_400Regular' }}>{(vehicle.car_models?.car_makes?.name_en ?? vehicle.make ?? '?').trim()[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text variant="caption" numberOfLines={1} className={`shrink ${panel ? 'text-onpanel' : 'text-ink'}`} style={{ fontFamily: i18n.language === 'ar' ? 'Tajawal_700Bold' : 'Poppins_700Bold' }}>
        {showAll ? t('expenses.allCars') : `${vehicleName(vehicle)} · ${vehicle.year}`}
      </Text>
      <ChevronDown size={16} color={panel ? c.lime : c.muted} />
    </PressableScale>
  );
}
