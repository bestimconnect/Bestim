import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import i18n from './i18n';
import { useSession } from './session';
import { sheet } from './sheet';
import { supabase } from './supabase';

// Subscription plans (migration 20261030090000_plans.sql). The database enforces every limit; this file only lets the app
// explain it first. No data (offline, still loading, no plan rows) = never block the user.
export const LIMITS = ['max_cars', 'max_logs', 'voice_per_day', 'scans_per_day'] as const;
export const FEATURES = ['receipt_photos', 'share_history', 'export', 'widgets'] as const;
export type Limit = (typeof LIMITS)[number];
export type Feature = (typeof FEATURES)[number];
export type PlanEntitlements = Partial<Record<Limit, number | null>> & Partial<Record<Feature, boolean>>;
export type Entitlements = { plan_id?: string; name_ar?: string; name_en?: string; entitlements?: PlanEntitlements; expires_at?: string | null };
/** A row of the `plans` table (not in the generated types yet: the migration is not pushed). */
export type Plan = { id: string; name_ar: string; name_en: string; desc_ar: string; desc_en: string; sort: number; is_active: boolean; is_default: boolean; entitlements: PlanEntitlements };

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

/** Is the feature on? Permissive without a plan; a plan that doesn't list it means off (same as the database). */
export const can = (ent: Entitlements | null | undefined, f: Feature) => !ent?.plan_id || ent.entitlements?.[f] === true;
/** The plan's limit, or null for none. */
export const limit = (ent: Entitlements | null | undefined, k: Limit) => (ent?.plan_id ? ent.entitlements?.[k] ?? null : null);

let last = 0;
/** The "Pro feature" / "limit reached" sheet. `n` is the plan's limit when known. */
export function showUpgrade(kind: 'feature' | 'limit', ent?: Entitlements | null, n?: number | null) {
  if (Date.now() - last < 1500) return; // a batch of failed saves opens one sheet
  last = Date.now();
  const plan = planName(ent);
  const title =
    kind === 'feature' ? i18n.t('plans.proTitle')
    : n != null && plan ? i18n.t('plans.limitTitle', { n, plan }) : i18n.t('plans.limitTitleShort');
  sheet(title, i18n.t(kind === 'feature' ? 'plans.proBody' : 'plans.limitBody'), [
    { text: i18n.t('plans.see'), onPress: () => setTimeout(() => router.push('/plans'), 350) }, // after the sheet has closed
    { text: i18n.t('plans.close'), style: 'cancel' },
  ]);
}

/** True (and shows the sheet) when the feature is off. */
export function blockFeature(ent: Entitlements | null | undefined, f: Feature) {
  if (can(ent, f)) return false;
  showUpgrade('feature', ent);
  return true;
}

/** True (and shows the sheet) when `count` already fills the plan's limit. */
export function blockLimit(ent: Entitlements | null | undefined, k: Limit, count: number) {
  const n = limit(ent, k);
  if (n == null || count < n) return false;
  showUpgrade('limit', ent, n);
  return true;
}

/** The database's "limit reached" (sqlstate 54000) from a failed insert -> the sheet. Returns whether it was one. */
export function upgradeOnLimitError(e: unknown) {
  if ((e as { code?: string } | null)?.code !== '54000') return false;
  showUpgrade('limit');
  return true;
}
