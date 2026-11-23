import { router } from 'expo-router';
import { Download, TriangleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { toast } from '@/components/Toast';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { shadows, useColors } from '@/lib/theme';
import { Field, Note, PressableScale, Text } from '@/components/ui';

// Delete account (Q34), v2 flow 10 #5 + flow 13: the user types the word to confirm; 30-day recovery.
// The screen 46 layout. The root gate lands on Welcome after signOut().
export default function DeleteAccount() {
  const { t } = useTranslation();
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const match = typed.trim().toLowerCase() === t('feedback.deleteAccount.word').toLowerCase();

  // Soft delete: the account is kept 30 days; signing in again offers "restore" (restore-account).
  // ponytail: Apple's token is revoked only when the account is deleted for good (purgeAccount), so the 30-day purge job must call it too.
  const remove = async () => {
    const { error } = await supabase.rpc('soft_delete_my_account');
    if (error) throw error;
    await signOut();
    toast(t('toast.accountDeleted'));
  };

  const run = async () => {
    if (!match) return;
    setBusy(true);
    setFailed(false);
    try {
      await remove();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('feedback.deleteAccount.header')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-6 pb-4 pt-3" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <View className="items-center">
          <View className="h-[92px] w-[92px] items-center justify-center rounded-full bg-blush">
            <TriangleAlert size={46} color={c.danger} strokeWidth={1.6} />
          </View>
        </View>
        <Text variant="body" className="px-1.5 text-center text-muted" style={{ fontSize: 14.5, lineHeight: 23 }}>{t('feedback.deleteAccount.body')}</Text>
        <View className="gap-[9px] rounded-[24px] bg-white p-4" style={{ boxShadow: shadows.ring }}>
          {(['l1', 'l2', 'l3'] as const).map((k) => (
            <View key={k} className="flex-row items-center gap-2">
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-danger"><X size={10} color="#FFFFFF" strokeWidth={3} /></View>
              <Text variant="body" className="flex-1" style={{ fontSize: 13.5 }}>{t(`feedback.deleteAccount.${k}`)}</Text>
            </View>
          ))}
        </View>
        <PressableScale accessibilityRole="button" onPress={() => router.push('/account/export')} className="flex-row items-center gap-[13px] rounded-[22px] bg-white px-3.5 py-[13px]" style={{ boxShadow: shadows.ring }}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-paper"><Download size={20} color={c.muted} strokeWidth={1.7} /></View>
          <Text variant="label" style={{ fontSize: 14 }}>{t('feedback.delete.export')}</Text>
        </PressableScale>
        <Field label={t('feedback.deleteAccount.confirmLabel')} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} />
        {failed ? <Note tone="warning" text={t('feedback.deleteAccount.error')} /> : null}
      </ScrollView>
      <View className="gap-2.5 px-6 pb-3 pt-2">
        <PressableScale accessibilityRole="button" accessibilityState={{ disabled: !match || busy }} disabled={busy || !match} onPress={run} className={`h-[54px] items-center justify-center rounded-full bg-danger ${match ? '' : 'opacity-40'}`}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text variant="label" className="text-[#FFFFFF]" numberOfLines={1}>{t('feedback.deleteAccount.confirm')}</Text>}
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={router.back} className="min-h-11 items-center justify-center">
          <Text variant="caption" className="text-muted" style={{ fontSize: 13.5 }}>{t('feedback.deleteAccount.keep')}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
