import { router, useLocalSearchParams } from 'expo-router';
import { Droplets, Ellipsis, Fuel, Package, Wrench, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PartArt } from '@/components/PartArt';
import { StepsBar } from '@/components/StepsBar';
import { Button, Field, Header, Item, PressableScale, Text } from '@/components/ui';
import { expenseChip } from '@/lib/quickAdd';
import { useRecordCategories, useServiceTypes } from '@/lib/queries';
import { shadows, useColors } from '@/lib/theme';

type Group = 'maintenance' | 'services' | 'accessories' | 'fuel' | 'other';
const TILES: { id: Group; icon: LucideIcon }[] = [
  { id: 'maintenance', icon: Wrench },
  { id: 'services', icon: Droplets },
  { id: 'accessories', icon: Package },
  { id: 'fuel', icon: Fuel },
  { id: 'other', icon: Ellipsis },
];
const SERVICE_COSTS = ['wash', 'parking', 'tolls', 'insurance', 'registration']; // running costs that are a service you paid for

// Typing a record, step by step: 1 what you are adding, 2 which one, 3 price, date and reminder (the quick-add sheet, opened for that item).
export default function NewRecord() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { top, bottom } = useSafeAreaInsets();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const services = (useServiceTypes().data ?? []).filter((s) => s.category_id);
  const tree = useRecordCategories().data ?? [];
  const [group, setGroup] = useState<Group | null>(null);
  const [custom, setCustom] = useState<string | null>(null); // "Other": the owner names it
  const isAcc = (x: { parentCategory?: { name_en: string } | null }) => x.parentCategory?.name_en === 'Accessories';
  const nm = (x: { name_en: string; name_ar: string }) => (i18n.language === 'ar' ? x.name_ar : x.name_en);

  // Step 3: the quick-add sheet with the item chosen.
  const next = (chip: string, name?: string) => router.push({ pathname: '/capture/step3', params: { serviceTypeId: chip, guided: '1', ...(name ? { custom: name } : {}), ...(vehicleId ? { vehicleId } : {}) } });
  // Where a typed-in name is saved: a general repair for maintenance, otherwise the matching cost type with the name as its note.
  const fallback = () => (group === 'maintenance' ? (services.find((s) => s.name_en === 'General Repair')?.id ?? expenseChip('other')) : group === 'accessories' ? (services.find((s) => s.name_en === 'Other Accessory')?.id ?? expenseChip('parts')) : expenseChip('other'));
  const pick = (g: Group) => {
    if (g === 'fuel') return next(expenseChip('fuel'));
    if (g === 'other') return next(expenseChip('other'));
    setGroup(g);
  };

  type Row = { id: string; label: string; art: string; hint?: string };
  const rows = (): { title?: string; items: Row[] }[] => {
    if (group === 'maintenance') {
      const out: { title?: string; items: Row[] }[] = [];
      for (const s of services.filter((x) => x.has_reminder)) {
        const top = s.parentCategory ? nm(s.parentCategory) : undefined;
        let sec = out.find((o) => o.title === top);
        if (!sec) out.push((sec = { title: top, items: [] }));
        sec.items.push({ id: s.id, label: nm(s), art: s.name_en });
      }
      return out;
    }
    if (group === 'services') {
      const costs = tree.filter((x) => x.expense_code && SERVICE_COSTS.includes(x.expense_code));
      return [{
        items: [
          ...costs.map((x) => ({ id: expenseChip(x.expense_code!), label: nm(x), art: x.name_en })),
          ...services.filter((x) => !x.has_reminder && !isAcc(x)).map((s) => ({ id: s.id, label: nm(s), art: s.name_en })),
        ],
      }];
    }
    // accessories: the services under the "Accessories" category (until it is in the database, spare parts)
    const items = services.filter(isAcc).filter((x) => x.name_en !== 'Other Accessory');
    if (!items.length) return [{ items: tree.filter((x) => x.expense_code === 'parts').map((x) => ({ id: expenseChip(x.expense_code!), label: nm(x), art: x.name_en })) }];
    return [{ items: items.map((s) => ({ id: s.id, label: nm(s), art: s.name_en })) }];
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: top }}>
      <View className="px-6">
        <Header title={group ? t('capture.new.step2') : t('capture.new.step1')} sub={t('capture.new.stepOf', { n: group ? 2 : 1 })} below={<StepsBar step={group ? 2 : 1} />} belowH={6} />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pt-2" contentContainerStyle={{ paddingBottom: bottom + 24 }}>
        {group == null ? (
          <View className="flex-row flex-wrap gap-3">
            {TILES.map(({ id, icon: Icon }) => (
              <PressableScale
                key={id}
                accessibilityRole="button"
                onPress={() => pick(id)}
                className="min-h-[132px] items-center justify-center gap-2 rounded-item bg-white p-4"
                style={{ width: '47.8%', boxShadow: shadows.soft }}>
                <View className="h-14 w-14 items-center justify-center rounded-full bg-mint">
                  <Icon size={26} color={c.teal} />
                </View>
                <Text variant="heading">{t(`capture.new.${id}`)}</Text>
                <Text variant="caption" className="text-center text-muted">{t(`capture.new.${id}Sub`)}</Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          [...rows().map((sec, i) => (
            <View key={i} className="gap-2">
              {sec.title ? <Text variant="caption" className="mt-2 text-muted">{sec.title}</Text> : null}
              {sec.items.map((r) => (
                <Item key={r.id} leading={<PartArt nameEn={r.art} size={28} />} title={r.label} onPress={() => next(r.id)} />
              ))}
            </View>
          )),
          <View key="other" className="gap-3">
            <Item icon={Ellipsis} title={t('capture.new.otherItem')} subtitle={t('capture.new.otherItemSub')} onPress={() => setCustom(custom ?? '')} />
            {custom != null ? (
              <>
                <Field label={t('capture.new.nameIt')} value={custom} onChangeText={setCustom} autoFocus returnKeyType="done" />
                <Button title={t('capture.new.next')} disabled={!custom.trim()} onPress={() => next(fallback(), custom.trim())} />
              </>
            ) : null}
          </View>]
        )}
      </ScrollView>
    </View>
  );
}
