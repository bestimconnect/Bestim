import { router, useLocalSearchParams } from 'expo-router';
import { Box, Check, HelpCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useLogDraft } from '@/stores/logDraft';

// Screen 17 — Clarify one detail, PNG 17/توضيح معلومة (decisions Q18).
export default function Clarify() {
  const { t } = useTranslation();
  const c = useColors();
  const { value, phrase } = useLocalSearchParams<{ value: string; phrase: string }>();
  const n = Number(value);
  const draft = useLogDraft();

  const done = (patch: Parameters<typeof draft.set>[0] = {}) => {
    draft.set(patch);
    router.replace('/capture/review');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 gap-5 p-6">
        <Header title={t('capture.clarify.header')} />
        <View className="items-center pt-6">
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-mint">
            <HelpCircle size={26} color={c.teal} />
          </View>
        </View>
        <Text variant="title">{t('capture.clarify.title')}</Text>
        <Text className="text-muted">{t('capture.clarify.body', { phrase })}</Text>
        <View className="gap-2.5">
          <Item
            icon={Check}
            title={t('capture.clarify.interval', { value: n.toLocaleString('en-US') })}
            subtitle={t('capture.clarify.intervalSub', { due: ((draft.odometer ?? 0) + n).toLocaleString('en-US') })}
            onPress={() => done({ intervalKm: n })}
          />
          <Item
            icon={Box}
            tone="paper"
            title={t('capture.clarify.product')}
            subtitle={t('capture.clarify.productSub')}
            onPress={() => done({ parts: [{ name: [draft.parts[0]?.name, n.toLocaleString('en-US')].filter(Boolean).join(' ') }] })}
          />
        </View>
        <View className="flex-1" />
        <Button variant="secondary" title={t('capture.clarify.skip')} onPress={() => done()} />
      </View>
    </SafeAreaView>
  );
}
