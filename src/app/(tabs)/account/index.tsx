import { router } from 'expo-router';
import { Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Header, Item } from '@/components/ui';

// Placeholder until Account & settings (screen 26, Phase 5). Expenses is reachable from here (decisions Q32).
export default function AccountScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 gap-4 bg-paper px-6">
      <Header title={t('tabs.account')} back={false} />
      <Item icon={Wallet} tone="mint" title={t('expenses.title')} onPress={() => router.push('/account/expenses')} />
    </SafeAreaView>
  );
}
