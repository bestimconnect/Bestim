import { useRefresh } from '@/components/Refresh';
import { router, useLocalSearchParams } from 'expo-router';
import { Car, Check } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, ScrollView, Share, View } from 'react-native';

import { pickVehicle } from '@/lib/sheet';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/ErrorState';
import { openCapture } from '@/lib/reading';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Choice, Field, FooterBar, Item, Note, Section, Text } from '@/components/ui';
import { blockFeature, useEntitlements } from '@/lib/entitlements';
import { SITE } from '@/lib/links';
import { useCurrentVehicle, useVehicleLogs, useVehicleParts, useVehicles, vehicleName } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

// Screen 41 — Share vehicle history (decisions Q43); ar-light 41/مشاركة تاريخ سيارة.png
type Mode = 'qr' | 'link';

/** A raw token or a pasted `bestim://receive?token=…` link -> the token. */
const tokenOf = (s: string) => s.trim().match(/token=([^&\s#]+)/)?.[1] ?? s.trim();

export default function ShareScreen() {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const vehicles = useVehicles();
  const { vehicle: current } = useCurrentVehicle();
  const { id: startId } = useLocalSearchParams<{ id?: string }>();
  const [pickedId, setPickedId] = useState<string | null>(startId ?? null);
  const [days, setDays] = useState<7 | 30 | 0>(7); // 0 = no expiry
  const vehicle = vehicles.data?.find((v) => v.id === pickedId) ?? current;
  const logs = useVehicleLogs(vehicle?.id);
  const { parts } = useVehicleParts(vehicle);
  const [mode, setMode] = useState<Mode>('qr');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pasted, setPasted] = useState('');
  const ent = useEntitlements().data;

  const name = vehicle ? vehicleName(vehicle) : '';
  const count = logs.data?.length ?? 0;
  const empty = logs.isSuccess && count === 0;
  const pick = () =>
    vehicles.data && vehicles.data.length > 1 &&
    pickVehicle(vehicle?.id ?? null, (id) => { setPickedId(id); setLink(null); });

  const prepare = async () => {
    if (!vehicle || blockFeature(ent, 'share_history')) return;
    setBusy(true);
    setError(false);
    // Q43: reuse a pending unexpired share for this vehicle.
    const old = days !== 7 ? { data: null as { share_token: string }[] | null } : await supabase.from('vehicle_shares').select('share_token').eq('vehicle_id', vehicle.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).limit(1);
    let token = old.data?.[0]?.share_token;
    if (!token) {
      // ponytail: "no expiry" = 10 years
      const ins = await supabase.from('vehicle_shares').insert({ vehicle_id: vehicle.id, ...(days !== 7 ? { expires_at: new Date(Date.now() + (days || 3650) * 864e5).toISOString() } : {}) }).select('share_token').single();
      token = ins.data?.share_token;
      if (!token && ins.error?.code === '42501') blockFeature({ plan_id: '-', entitlements: {} }, 'share_history'); // RLS: plan has no sharing
    }
    setBusy(false);
    if (token) setLink(`${SITE}/receive?token=${token}`);
    else setError(true);
  };
  const send = () => link && Share.share({ message: t('share.message', { vehicle: name, link }) });

  if (logs.isError && !logs.data) return <ErrorState onRetry={logs.refetch} retrying={logs.isRefetching} />;
  const sees = [t('share.see1'), t('share.see2'), t('share.see3')];
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <PageHeader title={t('share.buyerTitle')} sub={t('account.shareSub')} />
      <ScrollView refreshControl={refresh} className="flex-1" contentContainerClassName="gap-5 px-6 pb-6 pt-2" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <Choice<Mode> className="bg-line" value={mode} onChange={setMode} options={[{ value: 'qr', label: t('share.qr') }, { value: 'link', label: t('share.linkTab') }]} />
        <View className="gap-3">
          {vehicle ? (
            <Item icon={Car} title={name} subtitle={t('share.sub', { n: count, m: parts.length })} chevron={(vehicles.data?.length ?? 0) > 1} onPress={pick} />
          ) : null}
          {link && mode === 'qr' ? (
            <Card className="items-center gap-3 p-5">
              <View className="rounded-field bg-[#FFFFFF] p-3">
                <QRCode value={link} size={200} />
              </View>
              <Text variant="caption" className="text-muted">{t('share.noApp')}</Text>
            </Card>
          ) : null}
          {link && mode === 'link' ? (
            <Card className="gap-2 p-4">
              <Text variant="caption" selectable>{link}</Text>
              <Text variant="caption" className="text-muted">{t('share.noApp')}</Text>
            </Card>
          ) : null}
          <Card className="gap-2.5 p-4">
            <Text variant="caption" className="text-muted">{t('share.sees')}</Text>
            {sees.map((x) => (
              <View key={x} className="flex-row items-center gap-2.5">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-ok"><Check size={12} color="#FFFFFF" strokeWidth={3} /></View>
                <Text variant="caption" className="flex-1">{x}</Text>
              </View>
            ))}
          </Card>
          <Choice<'7' | '30' | '0'> className="bg-line" value={String(days) as '7' | '30' | '0'} onChange={(v) => { setDays(Number(v) as 7 | 30 | 0); setLink(null); }} options={[{ value: '7', label: t('share.exp7') }, { value: '30', label: t('share.exp30') }, { value: '0', label: t('share.expNone') }]} />
          <Note tone="info" text={t('share.note')} />
          {vehicle?.removed_records ? <Text variant="caption" className="px-1 text-muted">{t('share.removed', { n: vehicle.removed_records })}</Text> : null}
          {empty ? <Text variant="caption" className="px-1 text-muted">{t('share.empty')}</Text> : null}
          {error ? <Note tone="warning" text={t('share.error')} /> : null}
        </View>
        <View>
          <Section title={t('share.received')} />
          <View className="gap-3">
            <Field label={t('share.paste')} value={pasted} onChangeText={setPasted} autoCapitalize="none" autoCorrect={false} style={{ textAlign: I18nManager.isRTL ? 'right' : 'left' }} />
            <Button title={t('share.continue')} variant="secondary" disabled={!pasted.trim()} onPress={() => router.push({ pathname: '/receive', params: { token: tokenOf(pasted) } })} />
          </View>
        </View>
      </ScrollView>
      <FooterBar>
        {empty ? (
          <Button title={t('history.emptyCta')} onPress={() => openCapture({ vehicleId: vehicle?.id })} />
        ) : (
          <Button title={link ? t('share.send') : t('share.prepare')} loading={busy} disabled={!vehicle || !logs.isSuccess} onPress={link ? send : prepare} />
        )}
      </FooterBar>
    </SafeAreaView>
  );
}
