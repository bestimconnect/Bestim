import { router } from 'expo-router';
import { ListTree, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Card, Field, PressableScale, Text } from '@/components/ui';
import { useOnline } from '@/lib/online';
import { bilingual, usePartSearch, type CatalogPick } from '@/lib/services';
import { supabase } from '@/lib/supabase';

// v2 flow 12 "Search a part": type, see jobs first then parts (Arabic aliases match: جوان = وش = راس السلندر), tap to pick.
// What "pick" does is the caller's choice (usePartSearch.onPick): Services filters visits, manual add starts a record.
// ponytail: online only (search_catalog RPC); the offline local catalog cache arrives with flow 14.
type Hit = Awaited<ReturnType<typeof search>>[number];
async function search(q: string, vehicleId?: string) {
  const { data, error } = await supabase.rpc('search_catalog', { q, p_vehicle_id: vehicleId, max_rows: 40 });
  if (error) throw error;
  return data ?? [];
}

export default function PartSearchScreen() {
  const { t, i18n } = useTranslation();
  const arabic = i18n.language === 'ar';
  const online = useOnline();
  const { vehicleId, onPick } = usePartSearch();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = q.trim();
    if (!text) return;
    let live = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await search(text, vehicleId);
        if (live) setHits(r);
      } catch {
        if (live) setHits([]);
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, vehicleId]);

  const pick = (h: Hit) => {
    const p: CatalogPick = { kind: h.kind === 'job' ? 'job' : 'item', id: h.id, name_en: h.name_en, name_ar: h.name_ar };
    router.back();
    onPick(p);
  };
  const jobs = (q.trim() ? hits : null)?.filter((h) => h.kind === 'job') ?? [];
  const parts = (q.trim() ? hits : null)?.filter((h) => h.kind !== 'job') ?? [];
  const section = (label: string, rows: Hit[]) =>
    rows.length ? (
      <View className="gap-2">
        <Text variant="caption" className="px-1 text-muted">{label}</Text>
        {rows.map((h) => (
          <Card key={`${h.kind}-${h.id}`} onPress={() => pick(h)} className="px-4 py-3">
            <Text variant="label" numberOfLines={2}>{bilingual(h, arabic)}</Text>
            <Text variant="caption" className="text-muted" numberOfLines={1}>{bilingual({ name_en: h.name_ar, name_ar: h.name_en }, arabic)}</Text>
          </Card>
        ))}
      </View>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('services.searchTitle')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <Field label={t('services.searchHint')} value={q} onChangeText={setQ} autoFocus autoCorrect={false} returnKeyType="search" />
        {!online ? <Text variant="caption" className="text-muted">{t('services.needsConnection')}</Text> : null}
        {busy ? <ActivityIndicator /> : null}
        {section(t('services.kindJob'), jobs)}
        {section(t('services.kindPart'), parts)}
        {q.trim() && hits && !busy && hits.length === 0 ? (
          <View className="flex-row items-center gap-2 px-1"><Search size={16} color="#8A948F" /><Text variant="caption" className="text-muted">{t('services.noResult')}</Text></View>
        ) : null}
        <PressableScale accessibilityRole="button" onPress={() => router.push('/part-browse')} className="flex-row items-center gap-2 self-start px-1 py-3">
          <ListTree size={16} color="#8A948F" />
          <Text variant="caption" className="text-ink">{t('services.browse')}</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}
