import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CloudOff } from 'lucide-react-native';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { Backdrop, Card, Header, Text } from '@/components/ui';
import { parseBody } from '@/lib/pageText';
import { supabase } from '@/lib/supabase';

// Privacy, terms, support, about: the text is edited in the admin dashboard (site_pages) and cached for offline.
export default function SitePageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
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
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <Backdrop />
      <Header title={page.data?.title ?? ''} />
      {page.data ? (
        <ScrollView contentContainerClassName="pb-8 pt-2" showsVerticalScrollIndicator={false}>
          <Card className="gap-3 p-5">
            {parseBody(page.data.body).map((b, i) =>
              b.type === 'h' ? (
                <Text key={i} variant="heading" className={i ? 'mt-3' : ''}>{b.text}</Text>
              ) : b.type === 'p' ? (
                <Text key={i} variant="body" className="leading-6 text-muted">{b.text}</Text>
              ) : (
                <View key={i} className="gap-2 ps-1">
                  {b.items!.map((item) => (
                    <View key={item} className="flex-row gap-2.5">
                      <Text variant="body" className="w-3 leading-6 text-teal">•</Text>
                      <Text variant="body" className="flex-1 leading-6 text-muted">{item}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </Card>
        </ScrollView>
      ) : page.isPending ? (
        <LoadingState />
      ) : (
        <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} body={t('errors.generic')} action={t('feedback.error.retry')} onAction={() => page.refetch()} />
      )}
    </SafeAreaView>
  );
}
