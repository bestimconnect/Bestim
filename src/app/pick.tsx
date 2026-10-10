import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Field, Header, Item, Text } from '@/components/ui';
import { fold, matches } from '@/lib/search';
import { usePick } from '@/lib/sheet';

// Search picker (brand, model, year). Opened with `pickOption()` from src/lib/sheet.ts.
export default function Pick() {
  const { t } = useTranslation();
  const { title, options, allowCustom, onPick } = usePick();
  const [query, setQuery] = useState('');
  const found = useMemo(() => options.filter((o) => matches(query, o.label, o.hint ?? '', o.also ?? '')), [options, query]);
  const typed = query.trim();
  // Offer the typed text only when it is not already a row (typing "Corolla" should not also offer "use Corolla").
  const isNew = !found.some((o) => fold(o.label) === fold(typed) || fold(o.hint ?? '') === fold(typed));

  const pick = (id: string | null, label: string) => {
    router.back();
    Haptics.selectionAsync();
    onPick({ id, label });
  };

  return (
    <SafeAreaView className="flex-1 rounded-t-screen border-t border-line bg-sheet" edges={['top', 'bottom']}>
      <View className="flex-1 gap-4 px-6 pt-6">
        <Header title={title} />
        <Field label={t('pick.search')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
        <FlatList
          data={found}
          keyExtractor={(o) => o.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          contentContainerClassName="gap-2 pb-6"
          renderItem={({ item }) => (
            <View style={{ paddingStart: query ? 0 : (item.depth ?? 0) * 16 }}>
              <Item title={item.label} subtitle={item.hint} chevron={false} onPress={() => pick(item.id, item.label)} />
            </View>
          )}
          ListEmptyComponent={allowCustom && typed ? null : <Text variant="body" className="text-muted">{t(allowCustom ? 'pick.type' : 'pick.empty')}</Text>}
          ListFooterComponent={
            allowCustom && typed && isNew ? <Item icon={Plus} title={t('pick.custom', { text: typed })} chevron={false} onPress={() => pick(null, typed)} /> : null
          }
        />
      </View>
    </SafeAreaView>
  );
}
