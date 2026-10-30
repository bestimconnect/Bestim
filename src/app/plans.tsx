import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Header, Text } from '@/components/ui';
import { FEATURES, LIMITS, useEntitlements, type Plan } from '@/lib/entitlements';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';

// What each plan includes. No prices yet: upgrades open later.
export default function PlansScreen() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const ar = i18n.language === 'ar';
  const mine = useEntitlements().data?.plan_id;
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase.from('plans' as never).select('*').eq('is_active', true).order('sort');
      if (error) throw error;
      return data as unknown as Plan[];
    },
  });
  const lines = (p: Plan) => [
    ...LIMITS.map((k) => `${t(`plans.limit.${k}`)}: ${p.entitlements[k] ?? t('plans.unlimited')}`),
    ...FEATURES.filter((f) => p.entitlements[f]).map((f) => t(`plans.feature.${f}`)),
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <Header title={t('plans.title')} />
      <ScrollView contentContainerClassName="gap-4 pt-2 pb-6" showsVerticalScrollIndicator={false}>
        {plans.data?.map((p) => (
          <View key={p.id} className="gap-3 rounded-item bg-white p-4" style={{ boxShadow: shadows.soft }}>
            <View className="flex-row items-center gap-2">
              <Text variant="heading" className="flex-1">{ar ? p.name_ar : p.name_en}</Text>
              {p.id === mine ? <View className="rounded-full bg-lime px-3 py-1"><Text variant="caption" className="text-[#222E29]">{t('plans.current')}</Text></View> : null}
            </View>
            {(ar ? p.desc_ar : p.desc_en) ? <Text variant="caption" className="text-muted">{ar ? p.desc_ar : p.desc_en}</Text> : null}
            {lines(p).map((l) => (
              <View key={l} className="flex-row items-center gap-2">
                <Check size={16} color={c.teal} />
                <Text variant="body" className="flex-1">{l}</Text>
              </View>
            ))}
          </View>
        ))}
        {plans.isError ? <Text variant="caption" className="text-muted">{t('errors.generic')}</Text> : null}
        <Text variant="caption" className="text-center text-muted">{t('plans.soon')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
