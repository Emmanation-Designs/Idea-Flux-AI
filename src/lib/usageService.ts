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
  tts_characters_used_monthly: number;
  last_daily_reset: string;
  last_monthly_reset: string;
  rewarded_bonus: Record<string, number>;
}

/**
 * Retrieves the dynamic limit rules for a given plan.
 */
export async function getPlanLimits(supabaseClient: any, plan: 'free' | 'plus' | 'pro'): Promise<UsageLimits> {
  const catalogLimits = getCatalogPlanLimits(plan as PlanId);
  return {
    chat_limit: catalogLimits.chat === 'unlimited' ? 999999999 : catalogLimits.chat,
    image_generation_limit: catalogLimits.image_generation,
    image_edit_limit: catalogLimits.image_edit,
    image_analysis_limit: catalogLimits.image_analysis,
    document_ai_limit: catalogLimits.document_ai,
    pdf_limit: catalogLimits.pdf,
    ocr_limit: catalogLimits.ocr,
    tts_monthly_limit: catalogLimits.tts,
    tts_max_chars: catalogLimits.tts_max_chars,
  };
}

/**
 * Retrieves the usage tracking state for a user.
 * Lazily handles daily and monthly resets checking.
 */
export async function getUserUsage(supabaseClient: any, userId: string): Promise<UserUsage> {
  let { data, error } = await supabaseClient
    .from('user_usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // If not found, create a new tracking record for the user
    const { data: newData, error: insertError } = await supabaseClient
      .from('user_usage_tracking')
      .insert({ user_id: userId })
      .select()
      .single();

    if (insertError) {
      console.error(`[UsageService] Error inserting tracking row for ${userId}:`, insertError.message);
      return {
        chat_today: 0,
        image_generation_today: 0,
        image_edit_today: 0,
        image_analysis_today: 0,
        document_ai_today: 0,
        pdf_today: 0,
        ocr_today: 0,
        tts_characters_used_monthly: 0,
        last_daily_reset: new Date().toISOString(),
        last_monthly_reset: new Date().toISOString(),
        rewarded_bonus: {},
      };
    }
    data = newData;
  }

  // Dynamic resets checking
  let needsUpdate = false;
  const now = new Date();
  const updateFields: any = {};

  // 1. Daily reset (calendar day change in UTC)
  const lastDailyDate = new Date(data.last_daily_reset);
  const isDifferentDay = 
    lastDailyDate.getUTCFullYear() !== now.getUTCFullYear() ||
    lastDailyDate.getUTCMonth() !== now.getUTCMonth() ||
    lastDailyDate.getUTCDate() !== now.getUTCDate();

  if (isDifferentDay) {
    updateFields.chat_today = 0;
    updateFields.image_generation_today = 0;
    updateFields.image_edit_today = 0;
    updateFields.image_analysis_today = 0;
    updateFields.document_ai_today = 0;
    updateFields.pdf_today = 0;
    updateFields.ocr_today = 0;
    updateFields.rewarded_bonus = {};
    updateFields.last_daily_reset = now.toISOString();
    needsUpdate = true;
  }

  // 2. Monthly reset (30 days since last reset)
  const lastMonthlyDate = new Date(data.last_monthly_reset);
  const oneMonthLater = new Date(lastMonthlyDate);
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
      .single();

    if (!updateError && updatedData) {
      data = updatedData;
    } else {
      console.error(`[UsageService] Error updating lazy resets for ${userId}:`, updateError?.message);
    }
  }

  return {
    chat_today: data.chat_today,
    image_generation_today: data.image_generation_today,
    image_edit_today: data.image_edit_today,
    image_analysis_today: data.image_analysis_today,
    document_ai_today: data.document_ai_today,
    pdf_today: data.pdf_today,
    ocr_today: data.ocr_today,
    tts_characters_used_monthly: data.tts_characters_used_monthly,
    last_daily_reset: data.last_daily_reset,
    last_monthly_reset: data.last_monthly_reset,
    rewarded_bonus: typeof data.rewarded_bonus === 'string' ? JSON.parse(data.rewarded_bonus) : (data.rewarded_bonus || {}),
  };
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
  feature: 'chat' | 'image_generation' | 'image_edit' | 'image_analysis' | 'document_ai' | 'pdf' | 'ocr' | 'tts',
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
      
      console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: tts
Limit: ${maxChars} (Single-Gen)
Used: ${incrementAmount}
Remaining: 0
Decision: DENY
Reason: Single-generation limit exceeded`.trim());

      return {
        allowed: false,
        reason,
        current,
        limit,
      };
    }

    if (current + incrementAmount > limit) {
      const reason = `Monthly speech characters allowance exhausted. Generation requires ${incrementAmount} characters, but only ${limit - current} characters are remaining on your ${plan.toUpperCase()} plan.`;
      
      console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: tts
Limit: ${limit}/month
Used: ${current}
Remaining: ${limit - current}
Decision: DENY
Reason: Monthly limit reached`.trim());

      return {
        allowed: false,
        reason,
        current,
        limit,
      };
    }

    console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: tts
Limit: ${limit}/month
Used: ${current + incrementAmount}
Remaining: ${limit - (current + incrementAmount)}
Decision: ALLOW`.trim());

    return { allowed: true, current, limit };
  } else {
    const usageKey = `${feature}_today` as keyof UserUsage;
    const current = (usage[usageKey] as number) || 0;
    const catalogLimit = catalogLimits[feature];

    if (catalogLimit === 'unlimited') {
      console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: ${feature}
Limit: unlimited
Used: ${current}
Remaining: unlimited
Decision: ALLOW`.trim());

      return { allowed: true, current, limit: Infinity };
    }

    const baseLimit = catalogLimit as number;
    const bonus = usage.rewarded_bonus[feature] || 0;
    const limit = baseLimit + bonus;

    if (current + incrementAmount > limit) {
      const reason = `Daily generation threshold (${limit} requests) reached on your ${plan.toUpperCase()} subscription tier.`;

      console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: ${feature}
Limit: ${limit}/day
Used: ${current}
Remaining: ${limit - current}
Decision: DENY
Reason: Daily limit reached`.trim());

      return {
        allowed: false,
        reason,
        current,
        limit,
      };
    }

    console.log(`[Usage]
Plan: ${plan.toUpperCase()}
Feature: ${feature}
Limit: ${limit}/day
Used: ${current + incrementAmount}
Remaining: ${limit - (current + incrementAmount)}
Decision: ALLOW`.trim());

    return { allowed: true, current, limit };
  }
}

/**
 * Atomic counter increments for user operations.
 */
export async function incrementUsage(
  supabaseClient: any,
  userId: string,
  feature: 'chat' | 'image_generation' | 'image_edit' | 'image_analysis' | 'document_ai' | 'pdf' | 'ocr' | 'tts',
  amount: number = 1
): Promise<void> {
  // Ensure lazy reset check is applied
  await getUserUsage(supabaseClient, userId);

  const usageKey = feature === 'tts' ? 'tts_characters_used_monthly' : `${feature}_today`;
  
  // Call atomic PostgreSQL function
  const { error } = await supabaseClient.rpc('increment_usage_field', {
    user_uuid: userId,
    field_name: usageKey,
    increment_by: amount
  });

  if (error) {
    console.warn(`[UsageService] increment_usage_field RPC failed, falling back to read-write update:`, error.message);
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
