import { SUBSCRIPTION_CATALOG } from '../subscription/catalog';

export interface SubscriptionPlan {
  id: 'free' | 'pro' | 'plus';
  name: string;
  monthlyAllowance: number;
  maxCharactersPerGeneration: number;
}

export const SUBSCRIPTION_PLANS: Record<'free' | 'pro' | 'plus', SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free Plan',
    monthlyAllowance: SUBSCRIPTION_CATALOG.free.limits.tts,
    maxCharactersPerGeneration: SUBSCRIPTION_CATALOG.free.limits.tts_max_chars,
  },
  plus: {
    id: 'plus',
    name: 'Plus Plan',
    monthlyAllowance: SUBSCRIPTION_CATALOG.plus.limits.tts,
    maxCharactersPerGeneration: SUBSCRIPTION_CATALOG.plus.limits.tts_max_chars,
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    monthlyAllowance: SUBSCRIPTION_CATALOG.pro.limits.tts,
    maxCharactersPerGeneration: SUBSCRIPTION_CATALOG.pro.limits.tts_max_chars,
  },
};

/**
 * Returns the plan settings based on the plan name.
 * If the plan name is unknown, it defaults to the 'free' plan.
 */
export function getSubscriptionPlan(planName: string | undefined | null): SubscriptionPlan {
  const normalized = (planName || 'free').toLowerCase();
  if (normalized === 'pro') return SUBSCRIPTION_PLANS.pro;
  if (normalized === 'plus') return SUBSCRIPTION_PLANS.plus;
  return SUBSCRIPTION_PLANS.free;
}
