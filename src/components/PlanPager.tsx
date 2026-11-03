import { router } from 'expo-router';
import { Check, CloudOff, Crown, Sparkles, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, I18nManager, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/EmptyState';
import { useLightStatusBar } from '@/components/Hero';
import { Backdrop, Button, Card, FooterBar, PressableScale, Text } from '@/components/ui';
import {
  ctaText, isFree, planDesc, planLabel, planLines, priceText, subscribe, trialPlan, useEntitlements, usePlans, type Entitlements, type Plan,
} from '@/lib/entitlements';
import { useColors } from '@/lib/theme';
import { HeroBlock } from '@/components/HeroBlock';

type Page = { kind: 'welcome' } | { kind: 'plan'; plan: Plan; prev?: Plan };

const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** One plan per screen, swipe between them (the "Showcase", decisions Q121). `first` adds the welcome page and is the first-login tour. */
export function PlanPager({ first, start }: { first?: boolean; start?: string }) {
  useLightStatusBar();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t } = useTranslation();
  const plans = usePlans();
  const ent = useEntitlements().data;
  const list = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState<number | null>(null);

  if (!plans.data?.length)
    return (
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 8 }}>
        <View className="items-end px-6">
          <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={done} className="h-11 w-11 items-center justify-center rounded-full bg-white">
            <X size={20} color={c.ink} />
          </PressableScale>
        </View>
        {plans.isError ? <EmptyState icon={CloudOff} tone="sky" title={t('feedback.error.title')} action={t('feedback.error.retry')} onAction={() => plans.refetch()} /> : <LoadingState />}
      </View>
    );
  const pages: Page[] = [
    ...(first ? [{ kind: 'welcome' } as const] : []),
    // The welcome page already shows the user's own plan, so the first-login tour skips its page.
    ...plans.data.map((plan, i) => ({ kind: 'plan', plan, prev: plans.data[i - 1] }) as const).filter((p) => !(first && p.plan.id === ent?.plan_id)),
  ];
  const startAt = Math.max(0, pages.findIndex((p) => p.kind === 'plan' && p.plan.id === start));
  const at = index ?? startAt;
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // iOS reports x from the physical left, while an RTL list starts at the right (same as Home's car pager).
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = I18nManager.isRTL ? contentSize.width - layoutMeasurement.width - contentOffset.x : contentOffset.x;
    setIndex(Math.round(x / width));
  };

  return (
    <View className="flex-1 bg-paper">
      <Backdrop />
      <FlatList
        ref={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={pages}
        keyExtractor={(p) => (p.kind === 'welcome' ? 'welcome' : p.plan.id)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        initialScrollIndex={startAt}
        onMomentumScrollEnd={onSettle}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <PageView page={item} plans={plans.data} ent={ent} first={first} seeNext={() => list.current?.scrollToIndex({ index: 1, animated: true })} />
          </View>
        )}
      />
      <View pointerEvents="box-none" className="absolute inset-x-0 flex-row items-center gap-3 px-6" style={{ top: insets.top + 8 }}>
        <View className="flex-1 flex-row justify-center gap-1.5 ps-11">
          {pages.map((_, i) => (
            <View key={i} className={`h-1.5 rounded-full ${i === at ? 'w-5 bg-lime' : 'w-1.5 bg-[#FFFFFF4D]'}`} />
          ))}
        </View>
        {first ? (
          <PressableScale accessibilityRole="button" onPress={done} className="h-11 w-11 items-center justify-center">
            <Text variant="caption" className="text-onpanel">{t('plans.welcome.skip')}</Text>
          </PressableScale>
        ) : (
          <PressableScale accessibilityRole="button" accessibilityLabel={t('capture.quick.close')} onPress={done} className="h-11 w-11 items-center justify-center rounded-full bg-[#FFFFFF1F]">
            <X size={20} color={c.lime} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function PageView({ page, plans, ent, first, seeNext }: { page: Page; plans: Plan[]; ent?: Entitlements; first?: boolean; seeNext: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const mine = plans.find((p) => p.id === ent?.plan_id) ?? plans.find((p) => p.is_default) ?? plans[0];
  const welcome = page.kind === 'welcome';
  const plan = page.kind === 'plan' ? page.plan : mine;
  const prev = page.kind === 'plan' ? page.prev : undefined;
  const trial = trialPlan(plans, ent);
  const current = !welcome && plan.id === mine.id;
  const lines = planLines(t, plan, prev);

  const run = async (p: Plan) => {
    setBusy(true);
    await subscribe(p, ent);
    setBusy(false);
    if (first) done();
  };

  return (
    <View className="flex-1">
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <HeroBlock className="!pb-7" style={{ paddingTop: insets.top + 64 }}>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1.5 self-start rounded-full bg-lime px-3 py-1">
            {welcome ? <Sparkles size={14} color="#222E29" /> : <Crown size={14} color="#222E29" />}
            <Text variant="caption" className="text-[#222E29]">{welcome ? t('plans.welcome.badge') : planLabel(plan)}</Text>
          </View>
          {!welcome && plan.is_popular ? <Text variant="caption" className="text-lime">{t('plans.popular')}</Text> : null}
        </View>
        <Text variant="title" className="text-onpanel" numberOfLines={3}>{welcome ? t('plans.welcome.title') : planDesc(plan) || planLabel(plan)}</Text>
        {welcome ? <Text className="text-onpanel" style={{ opacity: 0.8 }}>{t('plans.welcome.start', { plan: planLabel(mine) })}</Text> : null}
      </HeroBlock>
      <View className="gap-3 px-6 pb-6 pt-5">
        <Text variant="caption" className="text-muted">{prev ? t(lines.length ? 'plans.everything' : 'plans.sameAs', { plan: planLabel(prev) }) : t('plans.includes', { plan: planLabel(plan) })}</Text>
        {lines.length ? (
          <Card className="gap-3 p-4">
            {lines.map((l) => (
              <View key={l} className="flex-row items-center gap-2.5">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-mint"><Check size={14} color={c.teal} /></View>
                <Text className="flex-1">{l}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        {!welcome ? (
          <Card tone="mint" className="mt-3 gap-0.5 p-4">
            <Text variant="title">{priceText(t, plan)}</Text>
            {!isFree(plan) && plan.price_monthly != null && plan.price_yearly != null ? <Text variant="caption" className="text-muted">{priceText(t, plan, true)}</Text> : null}
          </Card>
        ) : null}
      </View>
    </ScrollView>
    {welcome || current || !isFree(plan) ? (
      <FooterBar>
        {welcome ? (
          trial ? (
            <>
              <Button title={ctaText(t, trial, ent)} loading={busy} onPress={() => run(trial)} />
              <Button title={t('plans.welcome.keep', { plan: planLabel(mine) })} variant="secondary" onPress={done} />
            </>
          ) : (
            <>
              <Button title={t('plans.welcome.go')} onPress={done} />
              <Button title={t('plans.welcome.see', { plan: planLabel(plans.find((p) => p.is_popular) ?? plans[1] ?? mine) })} variant="secondary" onPress={seeNext} />
            </>
          )
        ) : current ? (
          <Button title={t('plans.yourPlan')} variant="secondary" disabled />
        ) : (
          <Button title={ctaText(t, plan, ent)} loading={busy} onPress={() => run(plan)} />
        )}
        {welcome ? <Text variant="caption" className="text-center text-muted">{t('plans.welcome.swipe')}</Text> : null}
      </FooterBar>
    ) : null}
    </View>
  );
}
