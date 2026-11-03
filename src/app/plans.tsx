import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, I18nManager, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/EmptyState';
import { Backdrop, Button, Card, Choice, FooterBar, Header, PressableScale, Text } from '@/components/ui';
import {
  ctaText, isFree, planLabel, planLines, subscribe, useEntitlements, usePlans, type Plan,
} from '@/lib/entitlements';
import { useColors } from '@/lib/theme';

// My plan (decisions Q121, layout B): plan tabs and a live price in the green bar, feature cards you swipe sideways
// (the tab and price follow), and the Subscribe button pinned at the bottom. Tap a card for that plan's own page (/plan).
const GAP = 12;
const num = (n: number) => n.toLocaleString('en-US');

export default function PlansScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const ent = useEntitlements().data;
  const plans = usePlans();
  const list = plans.data ?? [];
  const ref = useRef<FlatList<Plan>>(null);
  const [swiped, setSwiped] = useState<number | null>(null);
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState(0);

  const cardW = width * 0.8;
  const stride = cardW + GAP;
  const pad = (width - cardW) / 2;
  const mine = Math.max(0, list.findIndex((p) => p.id === ent?.plan_id));
  const at = Math.min(swiped ?? mine, Math.max(0, list.length - 1));
  const plan = list[at];
  const canSwitch = list.some((p) => p.price_monthly && p.price_yearly != null);
  const perYear = canSwitch && yearly && plan?.price_yearly != null;

  // Open on the user's own plan, centred.
  useEffect(() => {
    if (!list.length) return;
    const id = setTimeout(() => ref.current?.scrollToIndex({ index: mine, viewPosition: 0.5, animated: false }), 0);
    return () => clearTimeout(id);
  }, [list.length, mine]);

  const go = (i: number) => {
    setSwiped(i);
    ref.current?.scrollToIndex({ index: i, viewPosition: 0.5, animated: true });
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // iOS reports x from the physical left, while an RTL list starts at the right (same as Home's car pager).
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = I18nManager.isRTL ? contentSize.width - layoutMeasurement.width - contentOffset.x : contentOffset.x;
    setSwiped(Math.max(0, Math.min(list.length - 1, Math.round(x / stride))));
  };

  const price = () => {
    if (!plan) return null;
    if (isFree(plan)) return <Text variant="display" className="text-onpanel">{t('plans.free')}</Text>;
    const v = perYear ? plan.price_yearly : plan.price_monthly;
    if (v == null) return <Text variant="title" className="text-onpanel">{t('plans.priceSoon')}</Text>;
    const cut = plan.price_yearly != null && plan.price_monthly ? Math.round(100 - (plan.price_yearly / (plan.price_monthly * 12)) * 100) : 0;
    return (
      <View className="gap-1">
        <View className="flex-row items-end gap-2">
          <Text variant="display" className="text-onpanel">{num(v)}</Text>
          <Text variant="caption" className="pb-2 text-onpanel" style={{ opacity: 0.7 }}>{`${t('home.currency')} / ${t(perYear ? 'plans.year' : 'plans.month')}`}</Text>
        </View>
        {perYear && cut > 0 ? <Text variant="caption" className="text-lime">{t('plans.save', { n: cut })}</Text> : null}
      </View>
    );
  };

  const pinned = plan && !(isFree(plan) && plan.id !== ent?.plan_id);
  const run = async () => {
    if (!plan) return;
    setBusy(true);
    await subscribe(plan, ent);
    setBusy(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Backdrop />
      <Header
        title={t('plans.title')}
        belowH={44 + 12 + 72}
        below={
          list.length ? (
            <View className="gap-3">
              <Choice onDark className="bg-[#FFFFFF1F]" value={plan?.id ?? ''} onChange={(id) => go(list.findIndex((p) => p.id === id))} options={list.map((p) => ({ value: p.id, label: planLabel(p) }))} />
              <View className="h-[72px] flex-row items-start justify-between">
                <View className="flex-1 gap-1">
                  {price()}
                </View>
                {canSwitch && plan && !isFree(plan) ? (
                  <View className="flex-row gap-1 rounded-full bg-[#FFFFFF1F] p-1">
                    {([false, true] as const).map((y) => (
                      <PressableScale key={String(y)} accessibilityRole="button" onPress={() => setYearly(y)} className={`rounded-full px-3 py-1.5 ${yearly === y ? 'bg-white' : ''}`}>
                        <Text variant="caption" className={yearly === y ? 'text-[#222E29]' : 'text-onpanel'}>{t(y ? 'plans.yearly' : 'plans.monthly')}</Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : undefined
        }
      />
      <View className="flex-1 justify-center pb-6 pt-3" onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
        {plan ? (
          <Text variant="label" className="px-6 pb-3 text-muted">
            {at > 0 ? t(planLines(t, plan, list[at - 1]).length ? 'plans.everything' : 'plans.sameAs', { plan: planLabel(list[at - 1]) }) : t('plans.includes', { plan: planLabel(plan) })}
          </Text>
        ) : null}
        <FlatList
          ref={ref}
          style={{ flexGrow: 0 }}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={stride}
          decelerationRate="fast"
          data={list}
          keyExtractor={(p) => p.id}
          getItemLayout={(_, i) => ({ length: stride, offset: pad - GAP / 2 + i * stride, index: i })}
          contentContainerStyle={{ paddingHorizontal: pad - GAP / 2, paddingVertical: 4 }}
          onMomentumScrollEnd={onSettle}
          renderItem={({ item, index: i }) => (
            <View style={{ width: stride, paddingHorizontal: GAP / 2, opacity: i === at ? 1 : 0.55 }}>
              <FeatureCard plan={item} prev={list[i - 1]} current={item.id === ent?.plan_id} maxH={Math.max(150, area - 120)} />
            </View>
          )}
        />
        <View className="flex-row justify-center gap-1.5 pt-3">
          {list.map((p, i) => (
            <View key={p.id} className={`h-1.5 rounded-full ${i === at ? 'w-5 bg-teal' : 'w-1.5 bg-line'}`} />
          ))}
        </View>
        {plans.isPending ? <LoadingState /> : null}
        {plans.isError ? <Text variant="caption" className="pt-4 text-center text-muted">{t('errors.generic')}</Text> : null}
      </View>
      {pinned ? (
        <FooterBar>
          {plan.id === ent?.plan_id ? (
            <Button title={t('plans.yourPlan')} variant="dark" disabled />
          ) : (
            <Button title={ctaText(t, plan, ent)} loading={busy} onPress={run} />
          )}
        </FooterBar>
      ) : null}
    </SafeAreaView>
  );
}

function FeatureCard({ plan, prev, current, maxH }: { plan: Plan; prev?: Plan; current: boolean; maxH: number }) {
  const { t } = useTranslation();
  const c = useColors();
  const lines = planLines(t, plan, prev);
  const ink = current ? 'text-[#222E29]' : '';
  return (
    <Card
      tone={current ? 'lime' : 'white'}
      onPress={() => router.push({ pathname: '/plan', params: { page: plan.id } })}
      className="rounded-[28px] px-5 py-3">
      {plan.is_popular || current ? (
        <View className="flex-row gap-2 pb-1">
          {current ? <View className="rounded-full bg-[#222E29] px-3 py-1"><Text variant="caption" className="text-lime">{t('plans.yourPlan')}</Text></View> : null}
          {plan.is_popular ? <View className="rounded-full bg-lime px-3 py-1"><Text variant="caption" className="text-[#222E29]">{t('plans.popular')}</Text></View> : null}
        </View>
      ) : null}
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: maxH }}>
        {(lines.length ? lines : [t('plans.sameAs', { plan: prev ? planLabel(prev) : '' })]).map((l, i) => (
          <View key={l} className={`flex-row items-center gap-3 py-2.5 ${i ? `border-t ${current ? 'border-[#222E2933]' : 'border-line'}` : ''}`}>
            <View className={`h-6 w-6 items-center justify-center rounded-full ${current ? 'bg-[#FFFFFFB3]' : 'bg-mint'}`}>
              <Check size={14} color={current ? '#222E29' : c.teal} />
            </View>
            <Text className={`flex-1 ${ink}`}>{l}</Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}
