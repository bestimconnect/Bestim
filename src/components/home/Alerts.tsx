import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { partSub } from '@/components/PartStatus';
import { Card, Text } from '@/components/ui';
import type { Part, Vehicle } from '@/lib/queries';
import { useColors } from '@/lib/theme';

const ART = { ok: 'ok', soon: 'soon', overdue: 'late', snoozed: 'ok', none: 'ok' } as const;

/** One "coming up" row: the part art, its name, and how far (or how late) on the other side. */
export function AlertRow({ part, vehicle, name }: { part: Part; vehicle: Vehicle; name: string }) {
  const { t } = useTranslation();
  const c = useColors();
  const state = part.snoozedUntil ? 'snoozed' : part.status.state;
  const late = state === 'overdue';
  const tone = late ? c.late : state === 'soon' ? c.soon : c.muted;
  const unit = t(`vehicles.unit.${vehicle.odometer_unit}`);
  return (
    <Card
      accessibilityLabel={`${name}, ${partSub(t, part, unit)}`}
      // Licence and insurance have no Part page (no wear): they open their item in the Timeline. Oil, brakes and the rest open the Part page.
      onPress={() =>
        /licen[cs]e|insurance/i.test(part.serviceType.name_en)
          ? router.push({ pathname: '/timeline', params: { item: part.serviceType.id } })
          : router.push({ pathname: '/part', params: { vehicleId: vehicle.id, serviceTypeId: part.serviceType.id } })
      }
      className="min-h-[72px] flex-row items-center gap-3 px-3.5 py-3">
      <View className="h-[50px] w-[50px] items-center justify-center rounded-full bg-paper">
        <PartArt nameEn={part.serviceType.name_en} size={42} state={ART[state]} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="label" numberOfLines={1}>{name}</Text>
        <Text variant="caption" numberOfLines={1} className="text-muted">{t(`partStatus.${state}`)}</Text>
      </View>
      <Text variant="caption" numberOfLines={1} className="shrink-0" style={{ color: tone, fontFamily: late ? 'Tajawal_700Bold' : undefined }}>{partSub(t, part, unit)}</Text>
    </Card>
  );
}

/** Flow 8, "all clear": a lime check, the good news, and the next thing coming. */
export function AllClear({ next, vehicle, name }: { next?: Part; vehicle: Vehicle; name: string }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <Card className="items-center gap-1 px-4 py-6">
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-lime">
          <Check size={40} color="#171B19" strokeWidth={2} />
        </View>
        <Text variant="heading" className="mt-3">{t('home.clear.title')}</Text>
        <Text variant="caption" className="text-center text-muted">{t('home.clear.body')}</Text>
      </Card>
      {next ? (
        <View className="gap-2">
          <Text variant="caption" className="px-1 text-muted">{t('home.clear.next')}</Text>
          <AlertRow part={next} vehicle={vehicle} name={name} />
        </View>
      ) : null}
    </View>
  );
}
