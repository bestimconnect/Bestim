import { router } from 'expo-router';
import { Check, CloudOff, Minus, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { Button, FooterBar, Num, PressableScale, Text } from '@/components/ui';
import {
  ctaText, FEATURES, isFree, LIMITS, planLabel, priceText, subscribe, trialPlan, useEntitlements, usePlans, type Plan,
} from '@/lib/entitlements';
import { shadows, useColors } from '@/lib/theme';

const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
const COL = 76; // width of one plan column

/** Every plan side by side on one screen (v2 plans option A): usage limits as thin numerals, perks as ticks. `first` = the first-login tour. */
export function PlanCompare({ first }: { first?: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const plans = usePlans();
  const ent = useEntitlements().data;
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = plans.data ?? [];

  const close = (
    <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={done} className="h-11 w-11 items-center justify-center rounded-full bg-white" style={{ boxShadow: shadows.ring }}>
      <X size={20} color={c.ink} />
    </PressableScale>
  );
  if (!list.length)
    return (
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 8 }}>
        <View className="items-end px-6">{close}</View>
        {plans.isError ? <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} action={t('feedback.error.retry')} onAction={() => plans.refetch()} /> : <LoadingState />}
      </View>
    );

  const mine = list.find((p) => p.id === ent?.plan_id) ?? list.find((p) => p.is_default) ?? list[0];
  const popular = list.find((p) => p.is_popular);
  // The button follows the highlighted plan: the trial, else the most chosen, else the next one up.
  const target = list.find((p) => p.id === picked) ?? trialPlan(list, ent) ?? popular ?? list[list.findIndex((p) => p.id === mine.id) + 1] ?? mine;
  const current = target.id === mine.id;
  const run = async (p: Plan) => {
    setBusy(true);
    await subscribe(p, ent);
    setBusy(false);
    if (first) done();
  };
  const val = (p: Plan, k: (typeof LIMITS)[number]) => p.entitlements[k] ?? null;

  return (
    <View className="flex-1 bg-paper">
      <View className="flex-row items-center justify-between px-6" style={{ paddingTop: insets.top + 8 }}>
        {first ? (
          <PressableScale accessibilityRole="button" onPress={done} className="h-11 items-center justify-center rounded-full bg-white px-4" style={{ boxShadow: shadows.ring }}>
            <Text variant="caption" className="text-ink">{t('plans.welcome.skip')}</Text>
          </PressableScale>
        ) : close}
        {popular ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-lime px-3 py-1.5">
            <Star size={13} color={c.onlime} />
            <Text variant="caption" className="text-onlime">{`${t('plans.popular')}: ${planLabel(popular)}`}</Text>
          </View>
        ) : null}
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pb-6 pt-3" showsVerticalScrollIndicator={false}>
        <Text variant="title">{t('plans.compare.title')}</Text>
        <Text className="text-muted">{t('plans.compare.sub')}</Text>

        {/* One header tile per plan; tap one to point the button at it. */}
        <View className="mt-2 flex-row gap-2.5">
          {list.map((p) => {
            const dark = p.id === target.id && p.id !== mine.id;
            return (
              <PressableScale key={p.id} accessibilityRole="button" onPress={() => setPicked(p.id)} className={`flex-1 gap-0.5 rounded-[22px] p-3.5 ${dark ? 'bg-panel' : 'bg-white'}`} style={dark ? undefined : { boxShadow: shadows.ring }}>
                <Text variant="caption" className={dark ? 'text-onpanel opacity-70' : 'text-muted'}>
                  {p.id === mine.id ? t('plans.current') : p.trial_days && !ent?.trial_used ? t('plans.cta.trialShort', { n: p.trial_days }) : ' '}
                </Text>
                <Text variant="heading" className={dark ? 'text-onpanel' : ''}>{planLabel(p)}</Text>
                <View className={`mt-1.5 self-start rounded-full px-2.5 py-0.5 ${dark ? 'bg-lime' : 'bg-okTint'}`}>
                  <Text variant="caption" className={dark ? 'text-onlime' : 'text-ok'}>{isFree(p) ? t('plans.free') : priceText(t, p)}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <Text variant="label" className="mt-2 px-1 text-muted">{t('plans.compare.usage')}</Text>
        <View className="rounded-[24px] bg-white px-4 py-0.5" style={{ boxShadow: shadows.ring }}>
          {LIMITS.map((k, i) => (
            <View key={k} className={`min-h-[54px] flex-row items-center ${i ? 'border-t border-line' : ''}`}>
              <Text className="flex-1">{t(`plans.limit.${k}`)}</Text>
              {list.map((p) => {
                const v = val(p, k);
                return (
                  <View key={p.id} style={{ width: COL }} className="items-center">
                    {v === null ? <Num value="∞" size={26} /> : <Num value={v.toLocaleString('en-US')} size={20} color={p.id === mine.id ? c.muted : c.ink} />}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text variant="label" className="mt-2 px-1 text-muted">{t('plans.compare.features')}</Text>
        <View className="rounded-[24px] bg-white px-4 py-0.5" style={{ boxShadow: shadows.ring }}>
          {FEATURES.map((f, i) => (
            <View key={f} className={`min-h-[54px] flex-row items-center ${i ? 'border-t border-line' : ''}`}>
              <Text className="flex-1">{t(`plans.feature.${f}`)}</Text>
              {list.map((p) => (
                <View key={p.id} style={{ width: COL }} className="items-center">
                  {p.entitlements[f] ? (
                    <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-okTint"><Check size={13} color={c.ok} /></View>
                  ) : (
                    <Minus size={16} color={c.tick} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <FooterBar>
        {current ? (
          <Button title={t('plans.yourPlan')} variant="secondary" disabled />
        ) : (
          <Button title={ctaText(t, target, ent)} loading={busy} onPress={() => run(target)} />
        )}
        {first ? <Button title={t('plans.welcome.keep', { plan: planLabel(mine) })} variant="ghost" onPress={done} /> : null}
      </FooterBar>
    </View>
  );
}
