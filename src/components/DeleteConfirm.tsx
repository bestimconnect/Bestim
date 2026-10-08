import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Note, Text } from '@/components/ui';

// Screen 46 layout, PNG 46/تأكيد حذف السيارة — shared by delete-vehicle (Q36) and delete-account (Q34).
type Props = { header: string; title: string; name?: string; body: string; keep: string; error: string; canExport?: boolean; onDelete: () => Promise<void> };

export function DeleteConfirm({ header, title, name, body, keep, error, canExport = true, onDelete }: Props) {
  const { t } = useTranslation();
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
      <View className="px-6">
        <Header title={header} />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="grow justify-center gap-5 px-6">
        <View className="h-[70px] w-[70px] items-center justify-center self-center rounded-full bg-blush">
          <Trash2 size={32} color="#E5566D" />
        </View>
        <Text variant="title">{title}</Text>
        {name ? <Text variant="label" className="text-muted">{name}</Text> : null}
        <Text variant="body" className="text-muted">{body}</Text>
        {canExport ? <Button title={t('feedback.delete.export')} variant="secondary" onPress={() => router.push('/account/export')} /> : null}
        {failed ? <Note tone="warning" text={error} /> : null}
      </ScrollView>
      <View className="gap-2 px-6 pb-4">
        <Button title={keep} onPress={router.back} />
        <Button title={t('feedback.delete.confirm')} variant="danger" onPress={run} loading={busy} />
      </View>
    </SafeAreaView>
  );
}
