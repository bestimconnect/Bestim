import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Button, Field, FooterBar, IconTile, Note, Text } from '@/components/ui';
import { useColors } from '@/lib/theme';

// v2 flow 13 "confirm delete": the delete button stays off until the user types the word (the car's name). Shared by delete-vehicle (Q36).
// Both deletes are soft: kept 30 days, restored from Recently deleted (cars) or at sign-in (account).
type Props = { header: string; title: string; name?: string; body: string; keep: string; error: string; confirmLabel: string; word: string; onDelete: () => Promise<void> };

export function DeleteConfirm({ header, title, name, body, keep, error, confirmLabel, word, onDelete }: Props) {
  const { t } = useTranslation();
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const match = !!word.trim() && typed.trim().toLowerCase() === word.trim().toLowerCase();
  const run = async () => {
    if (!match) return;
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
      <PageHeader title={header} />
      <ScrollView className="flex-1" contentContainerClassName="grow gap-4 px-6 pb-4 pt-6" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View className="items-center"><IconTile icon={Trash2} tone="blush" size={72} color={c.danger} /></View>
        <Text variant="title" className="text-center">{title}</Text>
        {name ? <Text variant="label" className="text-center text-muted">{name}</Text> : null}
        <Text variant="body" className="px-2 text-center text-muted">{body}</Text>
        <Field label={confirmLabel} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} />
        {failed ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <FooterBar inset={false}>
        <Button title={t('feedback.delete.now')} variant="danger" loading={busy} disabled={!match} onPress={run} />
        <Button title={t('feedback.delete.export')} variant="soft" onPress={() => router.push('/account/export')} />
        <Button title={keep} variant="link" onPress={router.back} />
      </FooterBar>
    </SafeAreaView>
  );
}
