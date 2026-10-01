import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Car, CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Header, Item, Text } from '@/components/ui';
import { useIsGuest } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useSettings } from '@/stores/settingsStore';

// Screen 42 — Receive vehicle history (decisions Q44, Q49); ar-light 42/استلام تاريخ سيارة.png
export default function ReceiveScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const guest = useIsGuest();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const share = useQuery({
    queryKey: ['share', token],
    enabled: !!token && !guest,
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
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'receive' } }} />;

  const home = () => router.replace('/');
  const s = share.data;
  // Invalid / expired / used (no row), or own share, or accept failed: the 48-style state.
  const bad = !token || (share.isSuccess && (!s || s.own)) || accept.isError;
  if (bad || share.isError)
    return (
      <SafeAreaView className="flex-1 bg-paper px-6">
        <Header title={t('receive.header')} />
        <View className="flex-1 justify-center gap-5">
          <View className="h-[70px] w-[70px] items-center justify-center self-center rounded-full bg-line">
            <CloudOff size={30} color={c.muted} />
          </View>
          <Text variant="title">{share.isError ? t('receive.retryTitle') : t('receive.invalidTitle')}</Text>
          <Text variant="body" className="text-muted">{share.isError ? t('receive.retryBody') : s?.own ? t('receive.own') : t('receive.invalidBody')}</Text>
        </View>
        <View className="gap-3 pb-6">
          {share.isError ? <Button title={t('receive.retry')} onPress={() => share.refetch()} loading={share.isFetching} /> : null}
          <Button title={t('receive.home')} variant={share.isError ? 'secondary' : 'primary'} onPress={home} />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-paper px-6">
      <Header title={t('receive.header')} />
      <View className="flex-1 justify-center gap-5">
        <View className="h-[70px] w-[70px] items-center justify-center self-center rounded-full bg-mint">
          <Car size={30} color={c.teal} />
        </View>
        <Text variant="title">{t('receive.title')}</Text>
        {s ? <Item icon={Car} title={`${s.make} ${s.model} ${s.year}`} subtitle={t('receive.sub', { n: s.log_count })} chevron={false} disabled /> : null}
        <View className="flex-row justify-between">
          <Text variant="caption" className="text-muted">{t('receive.by')}</Text>
          <Text variant="label">{s?.shared_by_name || t('receive.fallbackName')}</Text>
        </View>
        <Text variant="body" className="text-muted">{t('receive.body')}</Text>
      </View>
      <View className="gap-3 pb-6">
        <Button title={t('receive.accept')} loading={accept.isPending || share.isPending} onPress={() => accept.mutate()} />
        <Button title={t('receive.decline')} variant="secondary" onPress={home} />
      </View>
    </SafeAreaView>
  );
}
