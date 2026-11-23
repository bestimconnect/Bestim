import { router, useLocalSearchParams } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen, TextLink } from '@/components/auth/AuthKit';
import { Button, Card, Text } from '@/components/ui';
import { shadows } from '@/lib/theme';

// v2 flow 13 #7 "Welcome back": the account was deleted less than 30 days ago.
// TODO(phase 1/5): UI only and NOT linked from anywhere. Wire it after sign-in when profiles.deleted_at is set: "Restore" calls
// restore_my_account(), "Delete it for good" calls delete_my_account(), "Not now" signs out. (Functions: 20261121110000_v2_soft_delete.sql.)
export default function RestoreAccountScreen() {
  const { t } = useTranslation();
  const { days } = useLocalSearchParams<{ days?: string }>();
  const left = days ?? '30';
  return (
    <AuthScreen
      back={false}
      footer={
        <>
          <Button title={t('restore.restore')} onPress={() => {}} />
          <TextLink title={t('restore.forever')} onPress={() => {}} />
          <TextLink title={t('restore.notNow')} onPress={() => router.replace('/login')} />
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
    </AuthScreen>
  );
}
