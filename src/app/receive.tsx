import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Num } from '@/components/home/Num';
import { Button, Card, FooterBar, Text } from '@/components/ui';
import { vehicleArt } from '@/lib/vehicleArt';
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
          <PageHeader title={t('receive.header')} />
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

  // v2 flow 7 #2 "shared with you": the car, who sent it, two facts, the copy note, then add or just look.
  // ponytail: the strip also lists the records and shows km and workshops; get_share only returns the count, so those wait for the backend.
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <PageHeader title={t('receive.header')} />
      <View className="flex-1 gap-4 px-6 pt-2">
        {s ? (
          <>
            <View className="items-center"><Image source={vehicleArt(s.vehicle_type)} contentFit="contain" style={{ width: 260, height: 130 }} /></View>
            <View className="gap-0.5">
              <Text variant="title" numberOfLines={2}>{s.nickname?.trim() || `${s.make} ${s.model}`}</Text>
              <Text variant="caption" className="text-muted">{t('receive.fromOwner', { name: s.shared_by_name || t('receive.fallbackName') })}</Text>
            </View>
            <View className="flex-row gap-3">
              <Card className="flex-1 gap-1 p-4"><Num value={String(s.log_count)} size={26} /><Text variant="caption" className="text-muted">{t('passport.records')}</Text></Card>
              <Card className="flex-1 gap-1 p-4"><Num value={String(s.year)} size={26} /><Text variant="caption" className="text-muted">{t('vehicles.facts.year')}</Text></Card>
            </View>
          </>
        ) : null}
        {s?.removed_records ? <Text variant="caption" className="text-muted">{t('share.removed', { n: s.removed_records })}</Text> : null}
        <Text variant="caption" className="text-muted">{t('receive.copyNote')}</Text>
      </View>
      <FooterBar inset={false}>
        <Button title={t('receive.add')} loading={accept.isPending || share.isPending} onPress={() => accept.mutate()} />
        <Button title={t('receive.viewOnly')} variant="secondary" onPress={home} />
      </FooterBar>
    </SafeAreaView>
  );
}
