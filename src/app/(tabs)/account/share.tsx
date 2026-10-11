import { Redirect, router } from 'expo-router';
import { Car, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { I18nManager, ScrollView, Share, View } from 'react-native';

import { pickVehicle } from '@/lib/sheet';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Choice, Field, Header, Item, Note, Text } from '@/components/ui';
import { SITE } from '@/lib/links';
import { useCurrentVehicle, useIsGuest, useVehicleLogs, useVehicleParts, useVehicles, vehicleName } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

// Screen 41 — Share vehicle history (decisions Q43); ar-light 41/مشاركة تاريخ سيارة.png
type Mode = 'qr' | 'link';

/** A raw token or a pasted `bestim://receive?token=…` link -> the token. */
const tokenOf = (s: string) => s.trim().match(/token=([^&\s#]+)/)?.[1] ?? s.trim();

export default function ShareScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const guest = useIsGuest();
  const vehicles = useVehicles();
  const { vehicle: current } = useCurrentVehicle();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const vehicle = vehicles.data?.find((v) => v.id === pickedId) ?? current;
  const logs = useVehicleLogs(vehicle?.id);
  const { parts } = useVehicleParts(vehicle);
  const [mode, setMode] = useState<Mode>('qr');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pasted, setPasted] = useState('');
  if (guest) return <Redirect href={{ pathname: '/feature-gate', params: { feature: 'account' } }} />;

  const name = vehicle ? vehicleName(vehicle) : '';
  const count = logs.data?.length ?? 0;
  const empty = logs.isSuccess && count === 0;
  const pick = () =>
    vehicles.data && vehicles.data.length > 1 &&
    pickVehicle(vehicle?.id ?? null, (id) => { setPickedId(id); setLink(null); });

  const prepare = async () => {
    if (!vehicle) return;
    setBusy(true);
    setError(false);
    // Q43: reuse a pending unexpired share for this vehicle.
    const old = await supabase.from('vehicle_shares').select('share_token').eq('vehicle_id', vehicle.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).limit(1);
    let token = old.data?.[0]?.share_token;
    if (!token) {
      const ins = await supabase.from('vehicle_shares').insert({ vehicle_id: vehicle.id }).select('share_token').single();
      token = ins.data?.share_token;
    }
    setBusy(false);
    if (token) setLink(`${SITE}/receive?token=${token}`);
    else setError(true);
  };
  const send = () => link && Share.share({ message: t('share.message', { vehicle: name, link }) });

  return (
    <SafeAreaView className="flex-1 bg-paper px-6" edges={['top']}>
      <Header title={t('share.header')} />
      <ScrollView contentContainerClassName="gap-5 pb-[120px] pt-4" showsVerticalScrollIndicator={false}>
        <View className="h-[60px] w-[60px] items-center justify-center self-center rounded-full bg-mint">
          <Repeat size={26} color={c.teal} />
        </View>
        <Text variant="title">{t('share.title')}</Text>
        <Text variant="body" className="text-muted">{t('share.body')}</Text>
        <Choice<Mode> className="bg-line" value={mode} onChange={setMode} options={[{ value: 'qr', label: t('share.qr') }, { value: 'link', label: t('share.linkTab') }]} />
        {vehicle ? (
          <Item icon={Car} title={name} subtitle={t('share.sub', { n: count, m: parts.length })} chevron={(vehicles.data?.length ?? 0) > 1} onPress={pick} />
        ) : null}
        {link && mode === 'qr' ? (
          <View className="items-center gap-2">
            <View className="rounded-item bg-[#FFFFFF] p-4">
              <QRCode value={link} size={200} />
            </View>
            <Text variant="caption" className="text-muted">{t('share.valid')}</Text>
          </View>
        ) : null}
        {link && mode === 'link' ? (
          <View className="gap-2 rounded-field bg-white p-4">
            <Text variant="caption" selectable>{link}</Text>
            <Text variant="caption" className="text-muted">{t('share.valid')}</Text>
          </View>
        ) : null}
        <Note tone="info" text={t('share.note')} />
        {empty ? <Text variant="caption" className="text-muted">{t('share.empty')}</Text> : null}
        {error ? <Note tone="warning" text={t('share.error')} /> : null}
        <Button title={link ? t('share.send') : t('share.prepare')} loading={busy} disabled={!vehicle || !logs.isSuccess || empty} onPress={link ? send : prepare} />
        <View className="gap-3 pt-4">
          <Text variant="label">{t('share.received')}</Text>
          <Field label={t('share.paste')} value={pasted} onChangeText={setPasted} autoCapitalize="none" autoCorrect={false} style={{ textAlign: I18nManager.isRTL ? 'right' : 'left' }} />
          <Button title={t('share.continue')} variant="secondary" disabled={!pasted.trim()} onPress={() => router.push({ pathname: '/receive', params: { token: tokenOf(pasted) } })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
