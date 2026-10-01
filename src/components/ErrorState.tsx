import { router } from 'expo-router';
import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@/components/ui';
import { useShowSaved } from '@/lib/online';
import { useVehicles } from '@/lib/queries';
import { useColors } from '@/lib/theme';

// Screen 48 — Data load error, PNG 48/تعذّر تحميل البيانات (Q46). Replaces a screen whose main query failed with no cached data.
export function ErrorState({ onRetry, onShowSaved, retrying }: { onRetry: () => void; onShowSaved?: () => void; retrying?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sky">
          <CloudOff size={36} color={c.teal} />
        </View>
        <View className="gap-3 self-stretch">
          <Text variant="title" className="text-center">{t('feedback.error.title')}</Text>
          <Text variant="body" className="text-center text-muted">{t('feedback.error.body')}</Text>
        </View>
      </View>
      <View className="gap-2 pb-4">
        <Button title={t('feedback.error.retry')} onPress={onRetry} loading={retrying} />
        {onShowSaved ? <Button title={t('feedback.error.saved')} variant="secondary" onPress={onShowSaved} /> : null}
      </View>
    </SafeAreaView>
  );
}

/** `onShowSaved` for ErrorState: only when the cache holds the user's vehicles (Q46); sends Home to its offline variant. */
export function useShowSavedAction() {
  const has = !!useVehicles().data?.length;
  return has
    ? () => {
        useShowSaved.getState().set(Date.now());
        router.replace('/');
      }
    : undefined;
}
