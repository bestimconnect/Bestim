import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Card, Text } from '@/components/ui';
import { bilingual, usePartSearch, useSystems } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// v2 flow 12 "Browse all parts": the 16 systems, then one system's parts grouped by sub-system. Search-first is the main path;
// this tree sits behind a small link on Search a part and picks through the same usePartSearch.onPick.
export default function PartBrowseScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const arabic = i18n.language === 'ar';
  const systems = useSystems().data ?? [];
  const [system, setSystem] = useState<number | null>(null);
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const items = useQuery({
    queryKey: ['v2-system-items', system],
    enabled: system != null,
    staleTime: Infinity,
    queryFn: async () => (await supabase.from('catalog_items').select('id,name_en,name_ar,subsystem,subsystem_ar').eq('system_id', system!).eq('item_type', 'part').order('subsystem').order('name_en')).data ?? [],
  });
  const groups = new Map<string, { label: string; rows: NonNullable<typeof items.data> }>();
  for (const it of items.data ?? []) {
    const key = it.subsystem ?? '';
    if (!groups.has(key)) groups.set(key, { label: (arabic ? it.subsystem_ar : it.subsystem) ?? '', rows: [] });
    groups.get(key)!.rows.push(it);
  }
  const chosen = systems.find((s) => s.id === system);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={chosen ? bilingual(chosen, arabic) : t('services.browseTitle')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-2 px-6 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        {system == null ? (
          systems.map((s) => (
            <Card key={s.id} onPress={() => setSystem(s.id)} className="flex-row items-center justify-between px-4 py-3.5">
              <Text variant="label" className="flex-1" numberOfLines={1}>{bilingual(s, arabic)}</Text>
              <Chevron size={18} color={c.muted} />
            </Card>
          ))
        ) : items.isPending ? (
          <LoadingState />
        ) : (
          [...groups.values()].map((g) => (
            <View key={g.label} className="gap-2 pb-2">
              {g.label ? <Text variant="caption" className="px-1 pt-2 text-muted">{g.label}</Text> : null}
              {g.rows.map((it) => (
                <Card
                  key={it.id}
                  onPress={() => {
                    const { onPick, pops } = usePartSearch.getState();
                    router.dismiss(pops); // browse (+ search when opened from it)
                    onPick({ kind: 'item', id: it.id, name_en: it.name_en, name_ar: it.name_ar });
                  }}
                  className="px-4 py-3">
                  <Text variant="label" numberOfLines={2}>{bilingual(it, arabic)}</Text>
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
