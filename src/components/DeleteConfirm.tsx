import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Backdrop, Button, FooterBar, Header, IconTile, Note, PressableScale, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

// Screen 46 layout, PNG 46/تأكيد حذف السيارة — shared by delete-vehicle (Q36) and delete-account (Q34).
type Props = { header: string; title: string; name?: string; body: string; keep: string; error: string; onDelete: () => Promise<void> };

export function DeleteConfirm({ header, title, name, body, keep, error, onDelete }: Props) {
  const { t } = useTranslation();
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onDelete();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <Header title={header} />
      <ScrollView className="flex-1" contentContainerClassName="grow justify-center gap-5 px-6">
        <View className="items-center"><IconTile icon={Trash2} tone="blush" size={72} color={c.danger} /></View>
        <Text variant="title" className="text-center">{title}</Text>
        {name ? <Text variant="label" className="text-center text-muted">{name}</Text> : null}
        <Text variant="body" className="text-center text-muted">{body}</Text>
        <Button title={t('feedback.delete.export')} variant="secondary" onPress={() => router.push('/account/export')} />
        {failed ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={keep} onPress={router.back} />
        {/* the destructive action: outlined, set apart from the safe primary above */}
        <PressableScale
          accessibilityRole="button"
          disabled={busy}
          onPress={run}
          className="mt-2 h-14 flex-row items-center justify-center rounded-[18px] border border-danger">
          {busy ? <ActivityIndicator color={c.danger} /> : <Text variant="label" className="text-danger" numberOfLines={1}>{t('feedback.delete.confirm')}</Text>}
        </PressableScale>
      </FooterBar>
    </SafeAreaView>
  );
}
