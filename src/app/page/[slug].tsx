import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CloudOff } from 'lucide-react-native';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Segment } from '@/components/money/Segment';
import { Text } from '@/components/ui';
import { parseBody } from '@/lib/pageText';
import { supabase } from '@/lib/supabase';

const PAGES = ['terms', 'privacy', 'support', 'about'] as const;

// Privacy, terms, support, about: the text is edited in the admin dashboard (site_pages) and cached for offline.
export default function SitePageScreen() {
  const { slug: first } = useLocalSearchParams<{ slug: string }>();
  const [slug, setSlug] = useState(first);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const page = useQuery({
    queryKey: ['site_page', slug, lang],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_pages' as never).select(`title:title_${lang}, body:body_${lang}`).eq('slug', slug).maybeSingle();
      if (error) throw error;
      return data as unknown as { title: string; body: string } | null;
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('account.legal')} />
      <View className="px-6 pt-1">
        <Segment value={slug} onChange={setSlug} options={PAGES.map((p) => ({ value: p, label: t(`account.${p}`) }))} />
      </View>
      {page.data ? (
        <ScrollView className="flex-1" contentContainerClassName="px-6 pb-8 pt-5" showsVerticalScrollIndicator={false}>
          <Text variant="title" style={{ fontSize: 24, lineHeight: 32 }}>{page.data.title}</Text>
          {parseBody(page.data.body).map((b, i) =>
            b.type === 'h' ? (
              <Text key={i} variant="heading" className="mt-5">{b.text}</Text>
            ) : b.type === 'p' ? (
              <Text key={i} variant="body" className="mt-3.5" style={{ fontSize: 14.5, lineHeight: 25 }}>{b.text}</Text>
            ) : (
              <View key={i} className="mt-3.5 gap-2 ps-1">
                {b.items!.map((item) => (
                  <View key={item} className="flex-row gap-2.5">
                    <Text variant="body" className="w-3 text-muted" style={{ fontSize: 14.5, lineHeight: 25 }}>•</Text>
                    <Text variant="body" className="flex-1" style={{ fontSize: 14.5, lineHeight: 25 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ),
          )}
        </ScrollView>
      ) : page.isPending ? (
        <LoadingState />
      ) : (
        <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} body={t('errors.generic')} action={t('feedback.error.retry')} onAction={() => page.refetch()} />
      )}
    </SafeAreaView>
  );
}
