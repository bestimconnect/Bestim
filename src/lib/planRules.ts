import type { Entitlements, Feature, Limit, Plan } from './entitlements';

// The plan rules with no app dependencies, so planRules.check.ts can run them in plain node.

/** Is the feature on? Permissive without a plan; a plan that doesn't list it means off (same as the database). */
export const can = (ent: Entitlements | null | undefined, f: Feature) => !ent?.plan_id || ent.entitlements?.[f] === true;
/** The plan's limit, or null for none. */
export const limit = (ent: Entitlements | null | undefined, k: Limit) => (ent?.plan_id ? ent.entitlements?.[k] ?? null : null);
/** Plans after `mineId` in the list (all of them when the user's plan is unknown). */
export const plansAbove = (plans: Plan[], mineId?: string) => plans.slice(plans.findIndex((p) => p.id === mineId) + 1);
/** The cheapest plan above the user's that has the feature on. */
export const planWith = (plans: Plan[], mineId: string | undefined, f: Feature) => plansAbove(plans, mineId).find((p) => p.entitlements[f] === true);
/** The nearest plan above the user's that lifts the limit. */
export const planRaising = (plans: Plan[], mine: Plan | undefined, k?: Limit) =>
  plansAbove(plans, mine?.id).find((p) => !k || !mine || p.entitlements[k] == null || (mine.entitlements[k] != null && p.entitlements[k]! > mine.entitlements[k]!));
/** The plan a trial would start (the first one that has trial days), when this account may still take it. */
export const trialPlan = (plans: Plan[], ent?: Entitlements | null) => (ent?.trial_used ? undefined : plans.find((p) => p.trial_days > 0));
