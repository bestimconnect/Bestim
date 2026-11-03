import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Car, CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Backdrop, Button, FooterBar, Group, Header, IconTile, Item, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settingsStore';

// Screen 42 — Receive vehicle history (decisions Q44, Q49); ar-light 42/استلام تاريخ سيارة.png
export default function ReceiveScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const share = useQuery({
    queryKey: ['share', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_share', { token: token! });
      if (error) throw error;
      return data[0] ?? null; // plain JSON only (query data is persisted)
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('accept_share', { token: token! });
      if (error) throw error;
      return data;
    },
    onSuccess: async (id) => {
      await Promise.all(['vehicles', 'logs', 'expenses'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      useSettings.getState().setCurrentVehicle(id);
      router.replace('/');
    },
  });
  const home = () => router.replace('/');
  const s = share.data;
  // Invalid / expired / used (no row), or own share, or accept failed: the 48-style state.
  const bad = !token || (share.isSuccess && (!s || s.own)) || accept.isError;
  if (bad || share.isError)
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <Backdrop />
        <View className="px-6"><Header title={t('receive.header')} /></View>
        <View className="flex-1 justify-center px-6">
          <EmptyState
            icon={CloudOff}
            tone={share.isError ? 'amber' : 'blush'}
            title={share.isError ? t('receive.retryTitle') : t('receive.invalidTitle')}
            body={share.isError ? t('receive.retryBody') : s?.own ? t('receive.own') : t('receive.invalidBody')}
          />
        </View>
        <FooterBar inset={false}>
          {share.isError ? <Button title={t('receive.retry')} onPress={() => share.refetch()} loading={share.isFetching} /> : null}
          <Button title={t('receive.home')} variant={share.isError ? 'secondary' : 'primary'} onPress={home} />
        </FooterBar>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <Backdrop />
      <View className="px-6"><Header title={t('receive.header')} /></View>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-4">
          <IconTile icon={Car} size={80} />
          <Text variant="title" className="text-center">{t('receive.title')}</Text>
        </View>
        {s ? (
          <Group>
            <Item icon={Car} title={`${s.make} ${s.model} ${s.year}`} subtitle={t('receive.sub', { n: s.log_count })} chevron={false} disabled />
            <View className="min-h-[48px] flex-row items-center justify-between gap-3 px-3.5 py-3">
              <Text variant="caption" className="text-muted">{t('receive.by')}</Text>
              <Text variant="label" className="shrink" numberOfLines={1}>{s.shared_by_name || t('receive.fallbackName')}</Text>
            </View>
          </Group>
        ) : null}
        {s?.removed_records ? <Text variant="caption" className="text-center text-muted">{t('share.removed', { n: s.removed_records })}</Text> : null}
        <Text variant="body" className="text-center text-muted">{t('receive.body')}</Text>
      </View>
      <FooterBar inset={false}>
        <Button title={t('receive.accept')} loading={accept.isPending || share.isPending} onPress={() => accept.mutate()} />
        <Button title={t('receive.decline')} variant="ghost" onPress={home} />
      </FooterBar>
    </SafeAreaView>
  );
}
