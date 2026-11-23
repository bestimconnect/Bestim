import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';

import { toast, toastError } from '@/components/Toast';
import i18n from './i18n';
import { can, limit, planWith, trialPlan } from './planRules';
import { useSession } from './session';
import { supabase } from './supabase';

export { can, limit, planRaising, planWith, plansAbove, trialPlan } from './planRules';

// Subscription plans (migration 20261030090000_plans.sql). The database enforces every limit; this file only lets the app
// explain it first. No data (offline, still loading, no plan rows) = never block the user.
export const LIMITS = ['max_cars', 'max_logs', 'voice_per_day', 'scans_per_day'] as const;
export const FEATURES = ['receipt_photos', 'share_history', 'export', 'widgets'] as const;
export type Limit = (typeof LIMITS)[number];
export type Feature = (typeof FEATURES)[number];
export type PlanEntitlements = Partial<Record<Limit, number | null>> & Partial<Record<Feature, boolean>>;
export type Entitlements = {
  plan_id?: string; name_ar?: string; name_en?: string; entitlements?: PlanEntitlements; expires_at?: string | null;
  source?: string | null; // 'trial' while a trial runs
  trial_used?: boolean; // the account has had a plan row before, so no new trial
};
/** A row of the `plans` table (not in the generated types yet: the migrations are not pushed). Prices are EGP; 0 = free, null = not priced yet. */
export type Plan = {
  id: string; name_ar: string; name_en: string; desc_ar: string; desc_en: string; sort: number; is_active: boolean; is_default: boolean;
  entitlements: PlanEntitlements; is_popular: boolean; price_monthly: number | null; price_yearly: number | null; trial_days: number;
};
/** How a locked feature looks: hidden entirely, or shown locked with this message (empty = the standard text). */
export type FeatureLock = { id: string; hidden: boolean; msg_ar: string; msg_en: string };

export const planName = (p?: { name_ar?: string; name_en?: string } | null) => (i18n.language === 'ar' ? p?.name_ar : p?.name_en) ?? '';

/** The signed-in user's plan. Key ['entitlements', userId]. */
export function useEntitlements() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ['entitlements', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Entitlements> => {
      const { data, error } = await supabase.rpc('my_entitlements' as never);
      if (error) throw error;
      return (data ?? {}) as Entitlements;
    },
  });
}

/** Locked state of one feature for the signed-in user: `hidden` when the admin chose to hide it, `plan` = the cheapest plan above theirs that has it. */
export function useLock(f: Feature) {
  const ent = useEntitlements().data;
  const plans = usePlans().data ?? [];
  const locks = useFeatureLocks().data;
  const locked = !can(ent, f);
  return { locked, hidden: locked && !!locks?.find((l) => l.id === f)?.hidden, plan: locked ? planWith(plans, ent?.plan_id, f) : undefined, ent };
}


/** The active plans, cheapest first. Key ['plans'] (also read by the plans screens and the upgrade sheet). */
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase.from('plans' as never).select('*').eq('is_active', true).order('sort');
      if (error) throw error;
      return data as unknown as Plan[];
    },
  });
}

/** Admin rules for locked features. Key ['feature_locks']. No row = shown locked with the standard text. */
export function useFeatureLocks() {
  return useQuery({
    queryKey: ['feature_locks'],
    queryFn: async (): Promise<FeatureLock[]> => {
      const { data, error } = await supabase.from('feature_locks' as never).select('*');
      if (error) throw error;
      return data as unknown as FeatureLock[];
    },
  });
}

export const isFree = (p: Plan) => p.price_monthly === 0;
export const planLabel = (p: Plan) => (i18n.language === 'ar' ? p.name_ar : p.name_en);
export const planDesc = (p: Plan) => (i18n.language === 'ar' ? p.desc_ar : p.desc_en);
/** Text for a plan's card: what it adds over `prev` (every line when there is no `prev`). */
export function planLines(t: TFunction, p: Plan, prev?: Plan) {
  const lines: string[] = [];
  for (const k of LIMITS) {
    const v = p.entitlements[k] ?? null;
    const pv = prev ? prev.entitlements[k] ?? null : undefined;
    if (pv === undefined || (pv !== null && (v === null || v > pv))) lines.push(`${t(`plans.limit.${k}`)}: ${v ?? t('plans.unlimited')}`);
  }
  for (const f of FEATURES) if (p.entitlements[f] && !prev?.entitlements[f]) lines.push(t(`plans.feature.${f}`));
  return lines;
}
const num = (n: number) => n.toLocaleString('en-US');
/** "99 EGP / month", "Free", or "Coming soon" when the plan has no price yet. */
export function priceText(t: TFunction, p: Plan, yearly = false) {
  if (isFree(p)) return t('plans.free');
  const v = yearly ? p.price_yearly : p.price_monthly;
  return v == null ? t('plans.priceSoon') : `${num(v)} ${t('home.currency')} / ${t(yearly ? 'plans.year' : 'plans.month')}`;
}
/** The main button's wording for a plan: trial, subscribe, or "tell me when it opens". */
export function ctaText(t: TFunction, p: Plan, ent?: Entitlements | null, unlock = false) {
  if (trialPlan([p], ent)) return t('plans.cta.trial', { plan: planLabel(p), n: p.trial_days });
  return t(p.price_monthly ? (unlock ? 'plans.cta.unlock' : 'plans.cta.subscribe') : 'plans.cta.notify', { plan: planLabel(p) });
}

/** The button's action. No payments yet: a trial really starts; otherwise we save that the user wants the plan. */
export async function subscribe(p: Plan, ent?: Entitlements | null) {
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) return;
  if (trialPlan([p], ent)) {
    const { data, error } = await supabase.rpc('start_trial' as never);
    if (!error && data) {
      // lazy: queryClient -> saveLog imports this file
      await (await import('./queryClient')).queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      toast(i18n.t('plans.trialStarted', { plan: planLabel(p), n: p.trial_days }));
      return;
    }
  }
  const { error } = await supabase.from('plan_interest' as never).upsert({ user_id: userId, plan_id: p.id } as never);
  (error ? toastError : toast)(i18n.t(error ? 'errors.generic' : 'plans.interestSaved'));
}

let last = 0;
/** The "This is a Pro feature" / "limit reached" sheet (the /upgrade route). `n` is the plan's limit when known, `key` the feature or limit. */
export function showUpgrade(kind: 'feature' | 'limit', _ent?: Entitlements | null, n?: number | null, key?: Feature | Limit) {
  if (Date.now() - last < 1500) return; // a batch of failed saves opens one sheet
  last = Date.now();
  router.push({ pathname: '/upgrade', params: { kind, ...(key ? { key } : {}), ...(n != null ? { n: String(n) } : {}) } });
}

/** True (and shows the sheet) when the feature is off. */
export function blockFeature(ent: Entitlements | null | undefined, f: Feature) {
  if (can(ent, f)) return false;
  showUpgrade('feature', ent, null, f);
  return true;
}

/** True (and shows the sheet) when `count` already fills the plan's limit. */
export function blockLimit(ent: Entitlements | null | undefined, k: Limit, count: number) {
  const n = limit(ent, k);
  if (n == null || count < n) return false;
  showUpgrade('limit', ent, n, k);
  return true;
}

/** The database's "limit reached" (sqlstate 54000) from a failed insert -> the sheet. Returns whether it was one. */
export function upgradeOnLimitError(e: unknown) {
  if ((e as { code?: string } | null)?.code !== '54000') return false;
  showUpgrade('limit');
  return true;
}
