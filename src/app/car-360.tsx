import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartRow } from '@/components/PartStatus';
import { PlateView } from '@/components/Plate';
import { Car3D } from '@/components/Car3D';
import { LoadingState } from '@/components/EmptyState';
import { Backdrop, Card, Chip, Header, Sheen, Text } from '@/components/ui';
import { frames360, groupOfPart, type Marker } from '@/lib/car360';
import { STATE_COLOR } from '@/lib/health';
import { useColors } from '@/lib/theme';
import { useVehicle, useVehicleParts, vehicleName, type Part } from '@/lib/queries';

const ORDER = { overdue: 0, soon: 1, ok: 2 } as const;

// The car on a turntable: drag to turn it, tap a dot to see that part.
export default function Car360Screen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicle } = useVehicle(vehicleId);
  const { parts } = useVehicleParts(vehicle);
  const [group, setGroup] = useState<Marker['group'] | null>(null);
  const frames = vehicle ? frames360(vehicle.vehicle_type) : undefined;
  const name = (p: Part) => (i18n.language === 'ar' ? p.serviceType.name_ar : p.serviceType.name_en);

  // Parts per dot group, and each group's colour = its worst part.
  const byGroup = new Map<Marker['group'], Part[]>();
  const loose: Part[] = [];
  for (const p of parts) {
    const g = groupOfPart(p.serviceType.name_en);
    if (!g) loose.push(p);
    else byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
  }
  const colors: Partial<Record<Marker['group'], string>> = {};
  for (const [g, list] of byGroup) {
    const worst = [...list].sort((a, b) => ORDER[a.status.state] - ORDER[b.status.state])[0];
    colors[g] = STATE_COLOR[worst.status.state];
  }
  const shown = group ? (byGroup.get(group) ?? []) : loose;
  const open = (p: Part) => router.push({ pathname: '/part', params: { vehicleId: vehicle!.id, serviceTypeId: p.serviceType.id } });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Backdrop />
      <Header title={vehicle ? vehicleName(vehicle) : ''} sub={vehicle ? `${vehicle.year}` : undefined} />
      <ScrollView contentContainerClassName="gap-3 px-6 pb-10 pt-2" showsVerticalScrollIndicator={false}>
        <Card>
          <Sheen color={c.teal} opacity={0.14} glow="tl" radius={1.2} />
          {frames ? <Car3D colors={colors} onGroup={(g) => setGroup((cur) => (cur === g ? null : g))} /> : <View style={{ aspectRatio: 4 / 3 }}><LoadingState /></View>}
        </Card>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="caption" className="flex-1 text-muted" numberOfLines={2}>{t('car360.hint')}</Text>
          {vehicle?.plate_number ? <PlateView plate={vehicle.plate_number} size="sm" /> : null}
        </View>
        {group ? (
          <View className="flex-row"><Chip selected label={`${t(`car360.group.${group}`)} · ${t('car360.showOther')}`} onPress={() => setGroup(null)} /></View>
        ) : null}
        {shown.map((p) => (
          <PartRow key={p.serviceType.id} part={p} name={name(p)} unit={t(`vehicles.unit.${vehicle!.odometer_unit}`)} onPress={() => open(p)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
