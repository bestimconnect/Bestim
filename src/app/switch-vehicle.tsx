import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Car, Check, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Item, PressableScale, Rise, Text } from '@/components/ui';
import { blockLimit, useEntitlements } from '@/lib/entitlements';
import { needsAttention, useVehicleParts, useVehicles, vehicleName, type Vehicle } from '@/lib/queries';
import { useVehiclePick } from '@/lib/sheet';
import { shadows, useColors } from '@/lib/theme';
import { hasReading } from '@/lib/reading';
import { vehicleArt } from '@/lib/vehicleArt';

function VehicleRow({ vehicle, current, onPress }: { vehicle: Vehicle; current: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const { parts } = useVehicleParts(vehicle);
  const overdue = needsAttention(parts).some((p) => p.status.state === 'overdue');
  const title = vehicleName(vehicle);
  const subtitle = [vehicle.year, hasReading(vehicle) ? `${vehicle.current_odometer.toLocaleString('en-US')} ${t(`vehicles.unit.${vehicle.odometer_unit}`)}` : null, vehicle.plate_number?.trim() || null].filter(Boolean).join(' · ');
  // From a sheet: close it first, then open the full screen.
  const go = (pathname: '/edit-vehicle' | '/delete-vehicle', params: Record<string, string>) => {
    router.back();
    router.push({ pathname, params });
  };
  return (
    <View className="rounded-row bg-white" style={{ boxShadow: current ? `0 0 0 2px ${c.ink}` : shadows.ring }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle, overdue ? t('vehicles.attention') : ''].filter(Boolean).join(', ')}
        accessibilityState={{ selected: current }}
        onPress={onPress}
        className="min-h-[76px] flex-row items-center gap-3 px-3.5 py-3"
        scale={0.99}>
        <Image source={vehicleArt(vehicle.vehicle_type)} contentFit="contain" style={{ width: 72, height: 40 }} />
        <View className="flex-1 gap-0.5">
          <Text variant="label" numberOfLines={2}>{title}</Text>
          <Text variant="caption" className="text-muted" numberOfLines={1}>{subtitle}</Text>
        </View>
        {overdue ? <View className="h-2.5 w-2.5 rounded-full bg-danger" /> : null}
        {current ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
            <Check size={14} color={c.paper} strokeWidth={3} />
          </View>
        ) : null}
      </PressableScale>
      {current ? (
        <View className="flex-row gap-1 px-3.5 pb-2.5">
          <PressableScale accessibilityRole="button" onPress={() => go('/delete-vehicle', { vehicleId: vehicle.id })} className="min-h-9 justify-center">
            <Text variant="caption" className="text-danger">{t('vehicles.deleteShort')}</Text>
          </PressableScale>
          <Text variant="caption" className="self-center text-muted">·</Text>
          <PressableScale accessibilityRole="button" onPress={() => go('/edit-vehicle', { id: vehicle.id })} className="min-h-9 justify-center">
            <Text variant="caption" className="text-muted">{t('vehicles.editShort')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
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
      <Text variant="heading">{t('vehicles.title')}</Text>
      {/* a fit-to-contents sheet cannot size a ScrollView: only scroll (fixed height) when the list is long */}
      {(() => {
        const rows = (
          <View className="gap-2.5">
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
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
                      <Check size={14} color={c.paper} strokeWidth={3} />
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
              <PressableScale accessibilityRole="button" onPress={add} className="h-[54px] flex-row items-center justify-center gap-2 rounded-row border border-dashed border-line">
                <Text variant="label">{t('vehicles.add')}</Text>
                <Plus size={18} color={c.ink} />
              </PressableScale>
            </Rise>
          </View>
        );
        return vehicles.length > 4 ? <ScrollView style={{ height: 420 }} contentContainerClassName="p-0.5" showsVerticalScrollIndicator={false}>{rows}</ScrollView> : rows;
      })()}
    </View>
  );
}
