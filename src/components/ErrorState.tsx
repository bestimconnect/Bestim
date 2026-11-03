import { router } from 'expo-router';
import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Backdrop, Button, FooterBar } from '@/components/ui';
import { useShowSaved } from '@/lib/online';
import { useVehicles } from '@/lib/queries';

// Screen 48 — Data load error, PNG 48/تعذّر تحميل البيانات (Q46). Replaces a screen whose main query failed with no cached data.
export function ErrorState({ onRetry, onShowSaved, retrying }: { onRetry: () => void; onShowSaved?: () => void; retrying?: boolean }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} body={t('feedback.error.body')} />
      </View>
      <FooterBar inset={false}>
        <Button title={t('feedback.error.retry')} onPress={onRetry} loading={retrying} />
        {onShowSaved ? <Button title={t('feedback.error.saved')} variant="ghost" onPress={onShowSaved} /> : null}
      </FooterBar>
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
