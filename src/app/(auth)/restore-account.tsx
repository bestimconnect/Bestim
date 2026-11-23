import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen, TextLink } from '@/components/auth/AuthKit';
import { toast } from '@/components/Toast';
import { Button, Card, Note, Text } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { purgeAccount } from '@/lib/purgeAccount';
import { useProfile } from '@/lib/queries';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { shadows } from '@/lib/theme';

// v2 flow 13 #7 "Welcome back": shown by the root gate (_layout.tsx) after sign-in when profiles.deleted_at is set (deleted < 30 days ago).
// Restore -> restore_my_account(); Delete it for good -> purgeAccount(); Not now -> sign out (the account stays recoverable).
export default function RestoreAccountScreen() {
  const { t } = useTranslation();
  const userId = useSession()?.user.id;
  const deletedAt = useProfile().data?.deleted_at;
  const [now] = useState(Date.now);
  const left = deletedAt ? Math.max(0, Math.ceil((new Date(deletedAt).getTime() + 30 * 86400000 - now) / 86400000)) : 30;
  const [busy, setBusy] = useState<'restore' | 'forever' | null>(null);
  const [failed, setFailed] = useState(false);
  const run = (kind: 'restore' | 'forever') => async () => {
    if (!userId) return;
    setBusy(kind);
    setFailed(false);
    try {
      if (kind === 'restore') {
        const { error } = await supabase.rpc('restore_my_account');
        if (error) throw error;
        await queryClient.invalidateQueries();
        toast(t('restore.restored'));
        router.replace('/');
      } else await purgeAccount(userId);
    } catch {
      setFailed(true);
      setBusy(null);
    }
  };
  return (
    <AuthScreen
      back={false}
      footer={
        <>
          <Button title={t('restore.restore')} loading={busy === 'restore'} disabled={!!busy} onPress={run('restore')} />
          <TextLink title={t('restore.forever')} onPress={run('forever')} />
          <TextLink title={t('restore.notNow')} onPress={() => signOut()} />
        </>
      }>
      <View className="mt-11 h-[104px] w-[104px] items-center justify-center self-center rounded-full bg-lime" style={{ boxShadow: shadows.ring }}>
        <RotateCcw size={44} color="#171B19" strokeWidth={1.8} />
      </View>
      <Text variant="title" className="mt-7 text-center" style={{ letterSpacing: -0.5 }}>{t('restore.title')}</Text>
      <Text className="mt-2 text-center text-muted" style={{ fontSize: 15, lineHeight: 24 }}>{t('restore.body', { n: left })}</Text>
      <Card className="mt-6 items-center p-4">
        <Text variant="number" style={{ fontSize: 40, lineHeight: 48 }}>{left} <Text variant="caption" className="text-muted">{t('restore.days')}</Text></Text>
      </Card>
      {failed ? <View className="mt-4"><Note tone="warning" text={t('restore.failed')} /></View> : null}
    </AuthScreen>
  );
}
