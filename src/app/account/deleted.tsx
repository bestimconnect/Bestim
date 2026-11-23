import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { toast, toastError } from '@/components/Toast';
import { Button, Card, Text } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// v2 flow 13 #6 "Recently deleted": cars and visits kept for 30 days, each with a Restore button and the days left.
// Opened from Menu > Recently deleted. Data: my_deleted_items(), restore_vehicle(), restore_visit() (20261121110000_v2_soft_delete.sql).
const daysLeft = (purgeAt: string) => Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86400000));

export default function DeletedScreen() {
  const { t } = useTranslation();
  const userId = useSession()?.user.id;
  const list = useQuery({
    queryKey: ['deleted-items', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_deleted_items');
      if (error) throw error;
      return data ?? [];
    },
  });
  const restore = useMutation({
    mutationFn: async (it: { kind: string; id: string }) => {
      const { error } = it.kind === 'vehicle' ? await supabase.rpc('restore_vehicle', { p_vehicle_id: it.id }) : await supabase.rpc('restore_visit', { p_visit_id: it.id });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of ['deleted-items', 'vehicles', 'logs', 'expenses']) queryClient.invalidateQueries({ queryKey: [key] });
      toast(t('restore.restored'));
    },
    onError: (e) => toastError(errorText(e) || t('restore.failed')),
  });
  const items = list.data ?? [];
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('restore.deletedTitle')} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-2">
        <Text variant="caption" className="text-muted">{t('restore.deletedSub')}</Text>
        {items.length === 0 && !list.isPending ? <EmptyState icon={Trash2} title={t('restore.deletedEmpty')} /> : null}
        {items.map((it) => (
          <Card key={`${it.kind}-${it.id}`} className="flex-row items-center gap-3 p-4">
            <View className="flex-1">
              <Text variant="label" numberOfLines={1}>{it.title}</Text>
              <Text variant="caption" className="text-muted">{t(it.kind === 'vehicle' ? 'restore.kindVehicle' : 'restore.kindVisit')} · {t('restore.daysLeft', { n: daysLeft(it.purge_at) })}</Text>
            </View>
            <Button title={t('restore.restoreItem')} size="sm" loading={restore.isPending && restore.variables?.id === it.id} onPress={() => restore.mutate(it)} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
