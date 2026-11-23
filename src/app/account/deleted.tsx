import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Text } from '@/components/ui';

// v2 flow 13 #6 "Recently deleted": cars and visits kept for 30 days, each with a dark "Restore" pill and the days left.
// TODO(phase 1/5): UI only and NOT linked from anywhere. Rows come from my_deleted_items() and restore with restore_vehicle() /
// restore_visit() (20261121110000_v2_soft_delete.sql); the generated types do not know them yet, so the list is empty for now.
export default function DeletedScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('restore.deletedTitle')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2">
        <Text variant="caption" className="text-muted">{t('restore.deletedSub')}</Text>
        <EmptyState icon={Trash2} title={t('restore.deletedEmpty')} />
      </ScrollView>
    </SafeAreaView>
  );
}
