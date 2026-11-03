import { router, useLocalSearchParams } from 'expo-router';
import { Check, Lock, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Card, IconTile, PressableScale, Text } from '@/components/ui';
import {
  ctaText, FEATURES, planLabel, planLines, planRaising, planWith, priceText, subscribe, useEntitlements, useFeatureLocks, usePlans, type Feature, type Limit,
} from '@/lib/entitlements';
import { shadows, useColors } from '@/lib/theme';

// "This is a Pro feature" / "You reached your limit" (decisions Q121). Opened by showUpgrade() in src/lib/entitlements.ts.
// The line under the title is the admin's lock message (dashboard → Plans), else the standard text.
export default function Upgrade() {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const { bottom } = useSafeAreaInsets();
  const { kind, key, n } = useLocalSearchParams<{ kind: 'feature' | 'limit'; key?: string; n?: string }>();
  const ent = useEntitlements().data;
  const plans = usePlans().data ?? [];
  const lock = useFeatureLocks().data?.find((l) => l.id === key);
  const [busy, setBusy] = useState(false);
  const mine = plans.find((p) => p.id === ent?.plan_id);
  const isFeature = kind === 'feature' && !!key;
  const target = isFeature ? planWith(plans, mine?.id, key as Feature) : planRaising(plans, mine, key as Limit | undefined);

  const title = isFeature ? t(`plans.feature.${key}`) : n && mine ? t('plans.limitTitle', { n, plan: planLabel(mine) }) : t('plans.limitTitleShort');
  const msg = (i18n.language === 'ar' ? lock?.msg_ar : lock?.msg_en) || (isFeature ? t(`plans.featureDesc.${key}`) : t('plans.limitBody'));
  const own = isFeature ? t(`plans.feature.${key}`) : '';
  // features first: they are the reason to upgrade; the limits follow
  const featureLabels = FEATURES.map((f) => t(`plans.feature.${f}`));
  const lines = target
    ? planLines(t, target, mine).filter((l) => l !== own).sort((a, b) => Number(featureLabels.includes(b)) - Number(featureLabels.includes(a))).slice(0, 3)
    : [];

  const go = async () => {
    if (!target) return;
    setBusy(true);
    await subscribe(target, ent);
    router.back();
  };
  const seeAll = () => {
    router.back();
    setTimeout(() => router.push('/plans'), 350); // after the sheet has closed
  };

  return (
    <View className="gap-4 rounded-t-screen bg-sheet px-6 pt-6" style={{ paddingBottom: bottom + 16, boxShadow: shadows.nav }}>
      <View className="min-h-11 flex-row items-center gap-3">
        <View className="flex-1 flex-row">
          {target ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-panel px-3 py-1.5">
              <Lock size={14} color={c.lime} />
              <Text variant="caption" className="text-onpanel">{isFeature ? t('plans.isFeature', { plan: planLabel(target) }) : t('plans.limitLifts', { plan: planLabel(target) })}</Text>
            </View>
          ) : null}
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={router.back} className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <X size={20} color={c.ink} />
        </PressableScale>
      </View>
      <View className="flex-row items-center gap-3">
        <IconTile icon={Lock} tone="mint" size={48} />
        <Text variant="heading" className="flex-1" numberOfLines={2}>{title}</Text>
      </View>
      <Text className="text-muted" numberOfLines={4}>{msg}</Text>
      {target && lines.length ? (
        <Card className="gap-2.5 p-4">
          <Text variant="caption" className="text-muted">{t('plans.alsoGet', { plan: planLabel(target) })}</Text>
          {lines.map((l) => (
            <View key={l} className="flex-row items-center gap-2">
              <Check size={16} color={c.teal} />
              <Text className="flex-1">{l}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {target ? <Text variant="heading">{priceText(t, target)}</Text> : null}
      <View className="gap-2 pt-1">
        {target ? <Button title={ctaText(t, target, ent, true)} loading={busy} onPress={go} /> : null}
        <Button title={t(target ? 'plans.seeAll' : 'plans.close')} variant="ghost" onPress={target ? seeAll : router.back} />
      </View>
    </View>
  );
}
