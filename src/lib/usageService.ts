import { getSubscription } from './subscriptionService.js';
import { getPlanLimits as getCatalogPlanLimits, PlanId } from '../subscription/catalog.js';

export interface UsageLimits {
  chat_limit: number;
  image_generation_limit: number;
  image_edit_limit: number;
  image_analysis_limit: number;
  document_ai_limit: number;
  pdf_limit: number;
  ocr_limit: number;
  tts_monthly_limit: number;
  tts_max_chars: number;
}

export interface UserUsage {
  chat_today: number;
  image_generation_today: number;
  image_edit_today: number;
  image_analysis_today: number;
  document_ai_today: number;
  pdf_today: number;
  ocr_today: number;
  daily_ai_capacity_used: number;
  last_capacity_reset: string;
  tts_characters_used_monthly: number;
  last_daily_reset: string;
  last_monthly_reset: string;
  rewarded_bonus: Record<string, number>;
}

export type CentralizedFeature = 
  | 'chat_simple'
  | 'chat_reasoning'
  | 'image_analysis'
  | 'ocr'
  | 'document_ai'
  | 'pdf'
  | 'image_edit'
  | 'image_generation'
  | 'tts';

/**
 * Internal configurable warning threshold.
 * Currently set to 75% of daily AI Capacity.
 */
export const CAPACITY_WARNING_THRESHOLD = 0.75;

/**
 * Resolves the internal credit cost for a feature.
 */
export function getFeatureCost(feature: string): number {
  switch (feature) {
    case 'chat_simple':
    case 'chat':
      return 1;
    case 'chat_reasoning':
      return 3;
    case 'chat_maximum':
      return 8;
    case 'image_analysis':
      return 3;
    case 'ocr':
      return 3;
    case 'document_ai':
      return 5;
    case 'pdf':
      return 6;
    case 'image_edit':
      return 8;
    case 'image_generation':
      return 10;
    default:
      return 1;
  }
}

/**
 * Retrieves the dynamic limit rules for a given plan.
 */
export async function getPlanLimits(supabaseClient: any, plan: string): Promise<UsageLimits> {
  const normalizedPlan = (['free', 'plus', 'pro'].includes(plan?.toLowerCase()) ? plan.toLowerCase() : 'free') as PlanId;
  const catalogLimits = getCatalogPlanLimits(normalizedPlan);
  return {
    chat_limit: catalogLimits.chat === 'unlimited' ? 999999999 : catalogLimits.chat,
    image_generation_limit: catalogLimits.image_generation === 'unlimited' ? 999999999 : catalogLimits.image_generation,
    image_edit_limit: catalogLimits.image_edit === 'unlimited' ? 999999999 : catalogLimits.image_edit,
    image_analysis_limit: catalogLimits.image_analysis === 'unlimited' ? 999999999 : catalogLimits.image_analysis,
    document_ai_limit: catalogLimits.document_ai === 'unlimited' ? 999999999 : catalogLimits.document_ai,
    pdf_limit: catalogLimits.pdf === 'unlimited' ? 999999999 : catalogLimits.pdf,
    ocr_limit: catalogLimits.ocr === 'unlimited' ? 999999999 : catalogLimits.ocr,
    tts_monthly_limit: catalogLimits.tts,
    tts_max_chars: catalogLimits.tts_max_chars,
  };
}

/**
 * Retrieves the usage tracking state for a user.
 * Lazily handles daily and monthly resets checking.
 */
export async function getUserUsage(supabaseClient: any, userId: string): Promise<UserUsage> {
  const nowIso = new Date().toISOString();
  const fallbackUsage: UserUsage = {
    chat_today: 0,
    image_generation_today: 0,
    image_edit_today: 0,
    image_analysis_today: 0,
    document_ai_today: 0,
    pdf_today: 0,
    ocr_today: 0,
    daily_ai_capacity_used: 0,
    last_capacity_reset: nowIso,
    tts_characters_used_monthly: 0,
    last_daily_reset: nowIso,
    last_monthly_reset: nowIso,
    rewarded_bonus: {},
  };

  try {
    let { data, error } = await supabaseClient
      .from('user_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      const { data: newData, error: insertError } = await supabaseClient
        .from('user_usage_tracking')
        .insert({ 
          user_id: userId,
          daily_ai_capacity_used: 0,
          last_capacity_reset: nowIso,
          last_daily_reset: nowIso,
          last_monthly_reset: nowIso
        })
        .select()
        .maybeSingle();

      if (insertError || !newData) {
        if (insertError) {
          console.error(`[UsageService] Error inserting tracking row for ${userId}:`, insertError.message);
        }
        return fallbackUsage;
      }
      data = newData;
    }

    if (!data) return fallbackUsage;

    // Dynamic resets checking
    let needsUpdate = false;
    const now = new Date();
    const updateFields: any = {};

    // 1. Daily Reset (calendar day change in UTC)
    const resetDateStr = data.last_capacity_reset || data.last_daily_reset || nowIso;
    const lastResetDate = new Date(resetDateStr);
    const validResetDate = !isNaN(lastResetDate.getTime()) ? lastResetDate : now;

    const isDifferentDay = 
      validResetDate.getUTCFullYear() !== now.getUTCFullYear() ||
      validResetDate.getUTCMonth() !== now.getUTCMonth() ||
      validResetDate.getUTCDate() !== now.getUTCDate();

    if (isDifferentDay) {
      updateFields.chat_today = 0;
      updateFields.image_generation_today = 0;
      updateFields.image_edit_today = 0;
      updateFields.image_analysis_today = 0;
      updateFields.document_ai_today = 0;
      updateFields.pdf_today = 0;
      updateFields.ocr_today = 0;
      updateFields.daily_ai_capacity_used = 0;
      updateFields.rewarded_bonus = {};
      updateFields.last_daily_reset = now.toISOString();
      updateFields.last_capacity_reset = now.toISOString();
      needsUpdate = true;
    }

    // 2. Monthly reset (30 days since last reset for TTS)
    const monthlyDateStr = data.last_monthly_reset || nowIso;
    const lastMonthlyDate = new Date(monthlyDateStr);
    const validMonthlyDate = !isNaN(lastMonthlyDate.getTime()) ? lastMonthlyDate : now;
    const oneMonthLater = new Date(validMonthlyDate);
    oneMonthLater.setUTCMonth(oneMonthLater.getUTCMonth() + 1);

    if (now >= oneMonthLater) {
      updateFields.tts_characters_used_monthly = 0;
      updateFields.last_monthly_reset = now.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { data: updatedData, error: updateError } = await supabaseClient
        .from('user_usage_tracking')
        .update(updateFields)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (!updateError && updatedData) {
        data = updatedData;
      } else if (updateError) {
        console.error(`[UsageService] Error updating lazy resets for ${userId}:`, updateError.message);
      }
    }

    return {
      chat_today: data.chat_today ?? 0,
      image_generation_today: data.image_generation_today ?? 0,
      image_edit_today: data.image_edit_today ?? 0,
      image_analysis_today: data.image_analysis_today ?? 0,
      document_ai_today: data.document_ai_today ?? 0,
      pdf_today: data.pdf_today ?? 0,
      ocr_today: data.ocr_today ?? 0,
      daily_ai_capacity_used: data.daily_ai_capacity_used ?? 0,
      last_capacity_reset: data.last_capacity_reset || data.last_daily_reset || nowIso,
      tts_characters_used_monthly: data.tts_characters_used_monthly ?? 0,
      last_daily_reset: data.last_daily_reset || nowIso,
      last_monthly_reset: data.last_monthly_reset || nowIso,
      rewarded_bonus: (() => {
        if (typeof data.rewarded_bonus === 'string') {
          try { return JSON.parse(data.rewarded_bonus); } catch { return {}; }
        }
        return data.rewarded_bonus || {};
      })(),
    };
  } catch (err: any) {
    console.error(`[UsageService] Unexpected error getting usage for ${userId}:`, err?.message || err);
    return fallbackUsage;
  }
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
}

/**
 * Checks if a user has sufficient quota remaining to perform an action.
 */
export async function checkLimit(
  supabaseClient: any,
  userId: string,
  feature: string,
  incrementAmount: number = 1
): Promise<CheckResult> {
  const subscription = await getSubscription(supabaseClient, userId);
  const plan = (subscription.current_plan || 'free').toLowerCase() as PlanId;
  const catalogLimits = getCatalogPlanLimits(plan);
  const usage = await getUserUsage(supabaseClient, userId);

  if (feature === 'tts') {
    const current = usage.tts_characters_used_monthly;
    const limit = catalogLimits.tts;
    const maxChars = catalogLimits.tts_max_chars;

    // Check max character per generation limit
    if (incrementAmount > maxChars) {
      const reason = `Requested text of ${incrementAmount} characters exceeds the single-generation maximum of ${maxChars} characters on the ${plan.toUpperCase()} plan.`;
      return {
        allowed: false,
        reason,
        current,
        limit,
      };
    }

    if (current + incrementAmount > limit) {
      const reason = `Monthly speech characters allowance exhausted. Generation requires ${incrementAmount} characters, but only ${limit - current} characters are remaining on your ${plan.toUpperCase()} plan.`;
      return {
        allowed: false,
        reason,
        current,
        limit,
      };
    }

    return { allowed: true, current, limit };
  } else {
    // RESOLVE cost
    const cost = getFeatureCost(feature);

    // DAILY CAPACITY
    let totalCapacity = 100;
    if (plan === 'plus') totalCapacity = 2000;
    if (plan === 'pro') totalCapacity = 10000;

    const used = usage.daily_ai_capacity_used ?? 0;
    const bonus = usage.rewarded_bonus?.ai_capacity ?? 0;
    const limit = totalCapacity + bonus;

    if (used + cost > limit) {
      const reason = `Your daily AI capacity of ${limit} credits has been exhausted. Please upgrade your plan for more daily capacity.`;

      console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: ${feature} (Cost: ${cost})
Capacity Limit: ${limit}
Used: ${used}
Remaining: ${limit - used}
Decision: DENY
Reason: Daily AI capacity exhausted`.trim());

      return {
        allowed: false,
        reason,
        current: used,
        limit,
      };
    }

    console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: ${feature} (Cost: ${cost})
Capacity Limit: ${limit}
Used: ${used + cost}
Remaining: ${limit - (used + cost)}
Decision: ALLOW`.trim());

    return { allowed: true, current: used, limit };
  }
}

/**
 * Atomic counter increments for user operations.
 */
export async function incrementUsage(
  supabaseClient: any,
  userId: string,
  feature: string,
  amount: number = 1
): Promise<void> {
  // Ensure lazy reset check is applied
  await getUserUsage(supabaseClient, userId);

  if (feature === 'tts') {
    const usageKey = 'tts_characters_used_monthly';
    const { error } = await supabaseClient.rpc('increment_usage_field', {
      user_uuid: userId,
      field_name: usageKey,
      increment_by: amount
    });

    if (error) {
      console.warn(`[UsageService] increment_usage_field RPC failed for TTS, falling back to read-write update:`, error.message);
      const { data: current, error: getErr } = await supabaseClient
        .from('user_usage_tracking')
        .select(usageKey)
        .eq('user_id', userId)
        .single();

      if (!getErr && current) {
        const currentVal = current[usageKey] || 0;
        await supabaseClient
          .from('user_usage_tracking')
          .update({ [usageKey]: currentVal + amount })
          .eq('user_id', userId);
      }
    }
  } else {
    // Centralized AI Capacity increment
    const cost = getFeatureCost(feature);
    await consumeCapacity(supabaseClient, userId, cost);

    // Increment historical fields for backward compatibility
    try {
      let legacyField = '';
      if (feature === 'chat_simple' || feature === 'chat_reasoning' || feature === 'chat') {
        legacyField = 'chat_today';
      } else {
        legacyField = `${feature}_today`;
      }

      await supabaseClient.rpc('increment_usage_field', {
        user_uuid: userId,
        field_name: legacyField,
        increment_by: 1
      });
    } catch (compatErr: any) {
      console.warn(`[UsageService] Failed to increment legacy historical field:`, compatErr.message);
    }
  }
}

/**
 * Retrieves the remaining AI Capacity for a user.
 */
export async function getRemainingCapacity(supabaseClient: any, userId: string): Promise<number> {
  const subscription = await getSubscription(supabaseClient, userId);
  const plan = (subscription.current_plan || 'free').toLowerCase();
  
  let totalCapacity = 100;
  if (plan === 'plus') totalCapacity = 2000;
  if (plan === 'pro') totalCapacity = 10000;

  const usage = await getUserUsage(supabaseClient, userId);
  const used = usage.daily_ai_capacity_used ?? 0;
  const bonus = usage.rewarded_bonus?.ai_capacity ?? 0;

  return Math.max(0, (totalCapacity + bonus) - used);
}

/**
 * Consumes AI Capacity for a user.
 */
export async function consumeCapacity(supabaseClient: any, userId: string, cost: number): Promise<void> {
  await getUserUsage(supabaseClient, userId);

  const { error } = await supabaseClient.rpc('increment_usage_field', {
    user_uuid: userId,
    field_name: 'daily_ai_capacity_used',
    increment_by: cost
  });

  if (error) {
    console.warn(`[UsageService] increment_usage_field RPC failed for daily_ai_capacity_used, falling back to read-write update:`, error.message);
    const { data: current, error: getErr } = await supabaseClient
      .from('user_usage_tracking')
      .select('daily_ai_capacity_used')
      .eq('user_id', userId)
      .single();

    if (!getErr && current) {
      const currentVal = current.daily_ai_capacity_used || 0;
      await supabaseClient
        .from('user_usage_tracking')
        .update({ daily_ai_capacity_used: currentVal + cost })
        .eq('user_id', userId);
    }
  }
}

/**
 * Adds extra daily capacity (e.g. from rewarded ads).
 */
export async function addDailyCapacity(supabaseClient: any, userId: string, amount: number): Promise<void> {
  const usage = await getUserUsage(supabaseClient, userId);
  const currentBonus = usage.rewarded_bonus || {};
  const newBonus = {
    ...currentBonus,
    ai_capacity: (currentBonus.ai_capacity || 0) + amount,
  };

  const { error } = await supabaseClient
    .from('user_usage_tracking')
    .update({ rewarded_bonus: newBonus })
    .eq('user_id', userId);

  if (error) {
    console.error(`[UsageService] Failed to add daily capacity bonus for ${userId}:`, error.message);
    throw new Error(`Failed to add daily capacity bonus: ${error.message}`);
  }
}

/**
 * Dynamic rewarded ads limit offset incrementor.
 */
export async function addRewardedBonus(
  supabaseClient: any,
  userId: string,
  feature: 'chat' | 'image_generation' | 'image_edit' | 'image_analysis' | 'document_ai' | 'pdf' | 'ocr',
  amount: number
): Promise<void> {
  const usage = await getUserUsage(supabaseClient, userId);
  const newBonus = {
    ...usage.rewarded_bonus,
    [feature]: (usage.rewarded_bonus[feature] || 0) + amount,
  };

  const { error } = await supabaseClient
    .from('user_usage_tracking')
    .update({ rewarded_bonus: newBonus })
    .eq('user_id', userId);

  if (error) {
    console.error(`[UsageService] Failed to add rewarded bonus for ${userId}:`, error.message);
    throw new Error(`Failed to add rewarded bonus: ${error.message}`);
  }
}
