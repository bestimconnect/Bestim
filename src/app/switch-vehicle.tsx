import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Item, PressableScale, Rise, Text } from '@/components/ui';
import { needsAttention, useVehicleParts, useVehicles, vehicleName, type Vehicle } from '@/lib/queries';
import { useVehiclePick } from '@/lib/sheet';
import { useColors } from '@/lib/theme';
import { vehicleArt } from '@/lib/vehicleArt';

function VehicleRow({ vehicle, current, onPress }: { vehicle: Vehicle; current: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { parts } = useVehicleParts(vehicle);
  const overdue = needsAttention(parts).some((p) => p.status.state === 'overdue');
  const title = vehicleName(vehicle);
  const subtitle = `${vehicle.year} · ${vehicle.current_odometer.toLocaleString('en-US')} ${t(`vehicles.unit.${vehicle.odometer_unit}`)}`;
  return (
    <Item
      image={vehicleArt(vehicle.vehicle_type)}
      tone="paper"
      title={title}
      subtitle={subtitle}
      accessibilityLabel={[title, subtitle, overdue ? t('vehicles.attention') : ''].filter(Boolean).join(', ')}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      aside={
        <View className="flex-row items-center gap-2">
          {overdue ? <View className="h-2.5 w-2.5 rounded-full bg-danger" /> : null}
          {current ? (
            <View className="h-6 w-6 items-center justify-center rounded-full bg-lime">
              <Check size={14} color="#222E29" strokeWidth={3} />
            </View>
          ) : null}
        </View>
      }
    />
  );
}

// Switch vehicle (formSheet, decisions Q56). Opened with `pickVehicle()` from src/lib/sheet.ts.
export default function SwitchVehicle() {
  const { t } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const vehicles = useVehicles().data ?? [];
  const { currentId, onPick } = useVehiclePick();

  const pick = (id: string) => {
    router.back();
    if (id === currentId) return;
    Haptics.selectionAsync();
    onPick(id);
  };
  const add = () => {
    // replace() from a formSheet only closes the sheet on iOS, so close it, then push the full screen.
    router.back();
    router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } });
  };

  return (
    <View className="gap-4 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <Text variant="heading" className="flex-1">{t('home.switchVehicle')}</Text>
        <PressableScale accessibilityRole="button" onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      {/* ponytail: no scrolling (a ScrollView breaks the fit-to-content sheet layout); fine for a personal garage of up to ~6 vehicles, fleets live in Bestim Connect. */}
      <View className="gap-2">
        {vehicles.map((v, i) => (
          <Rise key={v.id} index={i}>
            <VehicleRow vehicle={v} current={v.id === currentId} onPress={() => pick(v.id)} />
          </Rise>
        ))}
        <Rise index={vehicles.length}>
          <Item icon={Plus} title={t('vehicles.add')} chevron={false} onPress={add} />
        </Rise>
      </View>
    </View>
  );
}
