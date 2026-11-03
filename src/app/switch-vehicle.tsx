import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Car, Check, Plus, X } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Group, Item, PressableScale, Rise, Text } from '@/components/ui';
import { blockLimit, useEntitlements } from '@/lib/entitlements';
import { needsAttention, useVehicleParts, useVehicles, vehicleName, type Vehicle } from '@/lib/queries';
import { useVehiclePick } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { hasReading } from '@/lib/reading';
import { vehicleArt } from '@/lib/vehicleArt';

function VehicleRow({ vehicle, current, onPress }: { vehicle: Vehicle; current: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { parts } = useVehicleParts(vehicle);
  const overdue = needsAttention(parts).some((p) => p.status.state === 'overdue');
  const title = vehicleName(vehicle);
  // the plate rides in the subtitle: a plate pill next to the check left the name under 100pt on a 375pt phone
  const subtitle = [vehicle.year, hasReading(vehicle) ? `${vehicle.current_odometer.toLocaleString('en-US')} ${t(`vehicles.unit.${vehicle.odometer_unit}`)}` : null, vehicle.plate_number?.trim() || null].filter(Boolean).join(' · ');
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
  const ent = useEntitlements().data;
  const { currentId, onPick, all } = useVehiclePick();

  const pick = (id: string) => {
    router.back();
    if (id === currentId && !all?.active) return;
    Haptics.selectionAsync();
    onPick(id);
  };
  const add = () => {
    // replace() from a formSheet only closes the sheet on iOS, so close it, then push the full screen.
    router.back();
    if (blockLimit(ent, 'max_cars', vehicles.length)) return;
    router.push({ pathname: '/add-vehicle', params: { mode: 'extra' } });
  };

  return (
    <View className="gap-4 rounded-t-screen border-t border-line bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16 }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <Text variant="heading" className="flex-1">{t('home.switchVehicle')}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.lift }}>
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      {/* a fit-to-contents sheet cannot size a ScrollView: only scroll (fixed height) when the list is long */}
      {(() => {
        const rows = (
          <Group>
            {all ? (
              <Rise index={0}>
                <Item
                  icon={Car}
                  title={t('expenses.allCars')}
                  subtitle={t('expenses.allCarsSub')}
                  chevron={false}
                  accessibilityState={{ selected: all.active }}
                  onPress={() => { router.back(); if (!all.active) { Haptics.selectionAsync(); all.onPick(); } }}
                  aside={all.active ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-lime">
                      <Check size={14} color="#222E29" strokeWidth={3} />
                    </View>
                  ) : null}
                />
              </Rise>
            ) : null}
            {vehicles.map((v, i) => (
              <Rise key={v.id} index={i + 1}>
                <VehicleRow vehicle={v} current={!all?.active && v.id === currentId} onPress={() => pick(v.id)} />
              </Rise>
            ))}
            <Rise index={vehicles.length + 1}>
              <Item icon={Plus} title={t('vehicles.add')} chevron={false} onPress={add} />
            </Rise>
          </Group>
        );
        return vehicles.length > 4 ? <ScrollView style={{ height: 420 }} contentContainerClassName="p-0.5" showsVerticalScrollIndicator={false}>{rows}</ScrollView> : rows;
      })()}
    </View>
  );
}
