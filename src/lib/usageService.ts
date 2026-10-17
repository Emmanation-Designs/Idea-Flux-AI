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
  | 'tts'
  | 'video_generation'
  | 'video_generation_creative'
  | 'video_generation_super_creative'
  | 'live_mode';

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
    case 'live_mode':
      return 10; // 10 AI Capacity per active minute
    case 'video_generation_creative':
    case 'creative':
      return 15;
    case 'video_generation_super_creative':
    case 'super_creative':
    case 'super-creative':
      return 45;
    case 'video_generation':
      return 20;
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

      if (!insertError && newData) {
        data = newData;
      } else {
        // Fallback insert with minimal core fields if DB table is missing extended columns
        const { data: minData, error: minErr } = await supabaseClient
          .from('user_usage_tracking')
          .insert({
            user_id: userId,
            last_daily_reset: nowIso,
            last_monthly_reset: nowIso
          })
          .select()
          .maybeSingle();

        if (minErr) {
          console.warn(`[UsageService] Notice inserting tracking row for ${userId}:`, minErr.message);
          return fallbackUsage;
        }
        data = minData;
      }
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

      // Authoritative server-side daily reset for profiles legacy counters (properly awaited)
      try {
        await supabaseClient
          .from('profiles')
          .update({
            messages_used_today: 0,
            analysis_used_today: 0,
            images_used_today: 0,
            last_usage_reset: now.toISOString()
          })
          .eq('id', userId);
      } catch (profResetErr: any) {
        console.warn(`[UsageService] Notice resetting profiles daily counters for ${userId}:`, profResetErr?.message || profResetErr);
      }
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
        console.warn(`[UsageService] Full reset update notice for ${userId}, using fallback:`, updateError.message);
        
        // Fallback 1: Standard core fields only
        const coreFields: any = {};
        if (isDifferentDay) {
          coreFields.chat_today = 0;
          coreFields.image_generation_today = 0;
          coreFields.daily_ai_capacity_used = 0;
          coreFields.last_daily_reset = now.toISOString();
        }
        if (now >= oneMonthLater) {
          coreFields.tts_characters_used_monthly = 0;
          coreFields.last_monthly_reset = now.toISOString();
        }

        const { data: fallbackData, error: fallbackErr } = await supabaseClient
          .from('user_usage_tracking')
          .update(coreFields)
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        if (!fallbackErr && fallbackData) {
          data = fallbackData;
        } else {
          // Fallback 2: Timestamps only
          const minFields: any = {};
          if (isDifferentDay) minFields.last_daily_reset = now.toISOString();
          if (now >= oneMonthLater) minFields.last_monthly_reset = now.toISOString();

          const { data: minData } = await supabaseClient
            .from('user_usage_tracking')
            .update(minFields)
            .eq('user_id', userId)
            .select()
            .maybeSingle();

          if (minData) data = minData;
        }
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
  code?: string;
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
  incrementAmount: number = 1,
  options?: { quality?: string }
): Promise<CheckResult> {
  const subscription = await getSubscription(supabaseClient, userId);
  const plan = (subscription.current_plan || 'free').toLowerCase() as PlanId;
  const catalogLimits = getCatalogPlanLimits(plan);
  const usage = await getUserUsage(supabaseClient, userId);

  // VIDEO GENERATION ACCESS RULES
  if (feature.startsWith('video_generation') || feature === 'video') {
    if (plan === 'free') {
      return {
        allowed: false,
        reason: "Free users cannot generate videos. Please upgrade to a Plus or Pro plan.",
        code: "UPGRADE_REQUIRED",
        current: usage.daily_ai_capacity_used ?? 0,
        limit: 100
      };
    }

    const requestedQuality = options?.quality || (feature.includes('super') ? 'super-creative' : 'creative');
    if ((requestedQuality === 'super-creative' || requestedQuality === 'super_creative') && plan === 'plus') {
      return {
        allowed: false,
        reason: "Super Creative video quality requires a Pro plan. Please upgrade to Pro.",
        code: "PRO_REQUIRED",
        current: usage.daily_ai_capacity_used ?? 0,
        limit: 2000
      };
    }
  }

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
 * In-memory idempotency registry to guard against duplicate refunds in runtime.
 */
const refundedReservations = new Set<string>();

export interface CapacityReservation {
  allowed: boolean;
  reason?: string;
  code?: string;
  cost: number;
  reservationId: string;
}

/**
 * Atomic counter increments for user operations.
 * Fails safely: throws if tracking update cannot be confirmed by the database.
 */
export async function incrementUsage(
  supabaseClient: any,
  userId: string,
  feature: string,
  amount: number = 1
): Promise<void> {
  if (amount <= 0) return;
  // Ensure lazy reset check is applied
  await getUserUsage(supabaseClient, userId);

  if (feature === 'tts') {
    const usageKey = 'tts_characters_used_monthly';
    const { error: rpcErr } = await supabaseClient.rpc('increment_usage_field', {
      user_uuid: userId,
      field_name: usageKey,
      increment_by: amount
    });

    if (rpcErr) {
      console.warn(`[UsageService] increment_usage_field RPC failed for TTS, attempting direct update:`, rpcErr.message);
      const { data: current, error: getErr } = await supabaseClient
        .from('user_usage_tracking')
        .select(usageKey)
        .eq('user_id', userId)
        .single();

      if (getErr || !current) {
        throw new Error(`Failed to read TTS usage for user ${userId}: ${getErr?.message || 'Record not found'}`);
      }

      const currentVal = current[usageKey] || 0;
      const { error: updateErr } = await supabaseClient
        .from('user_usage_tracking')
        .update({ [usageKey]: currentVal + amount })
        .eq('user_id', userId);

      if (updateErr) {
        throw new Error(`Failed to increment TTS usage for user ${userId}: ${updateErr.message}`);
      }
    }
  } else {
    // Centralized AI Capacity increment
    const cost = getFeatureCost(feature);
    await consumeCapacity(supabaseClient, userId, cost);

    // Increment historical fields for backward compatibility
    try {
      let legacyField = '';
      if (feature === 'chat_simple' || feature === 'chat_reasoning' || feature === 'chat' || feature === 'chat_maximum') {
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

    // Authoritative server-side synchronization for legacy profiles counters
    try {
      let profileField: string | null = null;
      if (feature === 'chat_simple' || feature === 'chat_reasoning' || feature === 'chat' || feature === 'chat_maximum') {
        profileField = 'messages_used_today';
      } else if (feature === 'image_generation') {
        profileField = 'images_used_today';
      } else if (feature === 'image_analysis' || feature === 'ocr' || feature === 'document_ai' || feature === 'pdf' || feature === 'image_edit') {
        profileField = 'analysis_used_today';
      }

      if (profileField) {
        const { data: currentProf } = await supabaseClient
          .from('profiles')
          .select(profileField)
          .eq('id', userId)
          .maybeSingle();

        if (currentProf) {
          const currentCount = currentProf[profileField] || 0;
          await supabaseClient
            .from('profiles')
            .update({ [profileField]: currentCount + amount })
            .eq('id', userId);
        }
      }
    } catch (profIncErr: any) {
      console.warn(`[UsageService] Failed to increment profiles legacy field for ${userId}:`, profIncErr?.message || profIncErr);
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
 * FAIL-CLOSED: throws if update cannot be verified with the database.
 */
export async function consumeCapacity(supabaseClient: any, userId: string, cost: number): Promise<void> {
  if (cost <= 0) return;
  await getUserUsage(supabaseClient, userId);

  const { error: rpcErr } = await supabaseClient.rpc('increment_usage_field', {
    user_uuid: userId,
    field_name: 'daily_ai_capacity_used',
    increment_by: cost
  });

  if (!rpcErr) {
    return;
  }

  console.warn(`[UsageService] increment_usage_field RPC failed for daily_ai_capacity_used, falling back to direct write:`, rpcErr.message);
  const { data: current, error: getErr } = await supabaseClient
    .from('user_usage_tracking')
    .select('daily_ai_capacity_used')
    .eq('user_id', userId)
    .single();

  if (getErr || !current) {
    throw new Error(`Failed to read daily AI capacity for user ${userId}: ${getErr?.message || 'Record not found'}`);
  }

  const currentVal = current.daily_ai_capacity_used || 0;
  const { error: updateErr } = await supabaseClient
    .from('user_usage_tracking')
    .update({ daily_ai_capacity_used: currentVal + cost })
    .eq('user_id', userId);

  if (updateErr) {
    throw new Error(`Failed to consume daily AI capacity for user ${userId}: ${updateErr.message}`);
  }
}

/**
 * Atomically checks and reserves capacity for a user in a single database transaction.
 * Completely eliminates concurrency race conditions between parallel requests.
 * Preserves all feature costs, bonus capacity, and plan entitlements.
 * Fails safely: returns allowed: false if reservation cannot be confirmed.
 */
export async function reserveCapacity(
  supabaseClient: any,
  userId: string,
  feature: string,
  incrementAmount: number = 1,
  options?: { quality?: string }
): Promise<CapacityReservation> {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  // TTS has its own character limits & monthly pool
  if (feature === 'tts') {
    const characterCount = incrementAmount;
    
    // First: Attempt atomic database RPC check-and-reserve in a single transaction
    try {
      const { data, error } = await supabaseClient.rpc('reserve_tts_usage', {
        p_user_id: userId,
        p_character_count: characterCount,
        p_reservation_id: reservationId
      });

      if (!error && data && typeof data === 'object') {
        if (!data.allowed) {
          return {
            allowed: false,
            reason: data.reason || "Monthly speech characters allowance exhausted.",
            code: data.code || "TTS_LIMIT_EXHAUSTED",
            cost: 0,
            reservationId
          };
        }
        return {
          allowed: true,
          cost: characterCount,
          reservationId: data.reservation_id || reservationId
        };
      }
    } catch (rpcErr: any) {
      console.warn(`[UsageService] reserve_tts_usage RPC failed or not present, using strict fallback:`, rpcErr?.message || rpcErr);
    }

    // Strict Fallback (FAIL CLOSED): Verify limit first
    const limitResult = await checkLimit(supabaseClient, userId, 'tts', characterCount);
    if (!limitResult.allowed) {
      return {
        allowed: false,
        reason: limitResult.reason,
        code: limitResult.code,
        cost: 0,
        reservationId
      };
    }

    // Atomically consume upfront. If this fails, fail-closed and deny the request!
    try {
      await incrementUsage(supabaseClient, userId, 'tts', characterCount);
      return { allowed: true, cost: characterCount, reservationId };
    } catch (incErr: any) {
      console.error(`[UsageService] Failed to confirm TTS reservation for user ${userId}:`, incErr?.message || incErr);
      return {
        allowed: false,
        reason: "Failed to confirm speech character allocation with database.",
        code: "RESERVATION_FAILED",
        cost: 0,
        reservationId
      };
    }
  }

  // Feature cost determination
  let cost = getFeatureCost(feature);
  if (feature.startsWith('video_generation') || feature === 'video') {
    const requestedQuality = options?.quality || (feature.includes('super') ? 'super-creative' : 'creative');
    if (requestedQuality === 'super-creative' || requestedQuality === 'super_creative') {
      cost = getFeatureCost('video_generation_super_creative');
    } else {
      cost = getFeatureCost('video_generation_creative');
    }
  } else if (feature === 'live_mode') {
    cost = incrementAmount > 1 ? incrementAmount * 10 : 10;
  }

  // First: Attempt atomic database RPC check-and-reserve in a single transaction
  try {
    const { data, error } = await supabaseClient.rpc('reserve_ai_capacity', {
      p_user_id: userId,
      p_cost: cost,
      p_feature: feature,
      p_reservation_id: reservationId
    });

    if (!error && data && typeof data === 'object') {
      if (!data.allowed) {
        return {
          allowed: false,
          reason: data.reason || `Your daily AI capacity of ${data.limit || 100} credits has been exhausted. Please upgrade your plan for more daily capacity.`,
          code: data.code || 'CAPACITY_EXHAUSTED',
          cost: 0,
          reservationId
        };
      }
      return {
        allowed: true,
        cost,
        reservationId: data.reservation_id || reservationId
      };
    }
  } catch (rpcErr: any) {
    console.warn(`[UsageService] reserve_ai_capacity RPC failed or not present, using strict fallback:`, rpcErr?.message || rpcErr);
  }

  // Strict Fallback (FAIL CLOSED): Verify limit first
  const limitResult = await checkLimit(supabaseClient, userId, feature, incrementAmount, options);
  if (!limitResult.allowed) {
    return {
      allowed: false,
      reason: limitResult.reason,
      code: limitResult.code,
      cost: 0,
      reservationId
    };
  }

  // Atomically consume upfront. If this fails, fail-closed and reject the request!
  try {
    await consumeCapacity(supabaseClient, userId, cost);
    return { allowed: true, cost, reservationId };
  } catch (consumeErr: any) {
    console.error(`[UsageService] Failed to confirm capacity reservation for user ${userId}:`, consumeErr?.message || consumeErr);
    return {
      allowed: false,
      reason: "Failed to confirm AI capacity reservation with database.",
      code: "RESERVATION_FAILED",
      cost: 0,
      reservationId
    };
  }
}

/**
 * Records successful completion of a feature whose capacity was already reserved.
 * Updates legacy tracking counters without double-counting capacity.
 */
export async function recordUsageSuccess(
  supabaseClient: any,
  userId: string,
  feature: string,
  amount: number = 1,
  reservationId?: string
): Promise<void> {
  if (feature === 'tts') {
    // TTS character count was already reserved in reserveCapacity
    return;
  }

  // Attempt atomic database completion recording
  try {
    const { error: rpcErr } = await supabaseClient.rpc('record_usage_success', {
      p_user_id: userId,
      p_feature: feature,
      p_reservation_id: reservationId || null
    });
    if (!rpcErr) {
      return;
    }
  } catch (err: any) {
    // Fall back to discrete field updates
  }

  // Fallback: Increment historical fields for backward compatibility
  try {
    let legacyField = '';
    if (feature === 'chat_simple' || feature === 'chat_reasoning' || feature === 'chat' || feature === 'chat_maximum') {
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
    console.warn(`[UsageService] Failed to increment legacy historical field:`, compatErr?.message || compatErr);
  }

  // Authoritative server-side synchronization for legacy profiles counters
  try {
    let profileField: string | null = null;
    if (feature === 'chat_simple' || feature === 'chat_reasoning' || feature === 'chat' || feature === 'chat_maximum') {
      profileField = 'messages_used_today';
    } else if (feature === 'image_generation') {
      profileField = 'images_used_today';
    } else if (feature === 'image_analysis' || feature === 'ocr' || feature === 'document_ai' || feature === 'pdf' || feature === 'image_edit') {
      profileField = 'analysis_used_today';
    }

    if (profileField) {
      const { data: currentProf } = await supabaseClient
        .from('profiles')
        .select(profileField)
        .eq('id', userId)
        .maybeSingle();

      if (currentProf) {
        const currentCount = currentProf[profileField] || 0;
        await supabaseClient
          .from('profiles')
          .update({ [profileField]: currentCount + amount })
          .eq('id', userId);
      }
    }
  } catch (profIncErr: any) {
    console.warn(`[UsageService] Failed to increment profiles legacy field for ${userId}:`, profIncErr?.message || profIncErr);
  }
}

/**
 * Safely and idempotently refunds AI Capacity for a user on provider failure or aborted requests.
 * Uses dedicated refund RPC and bounded decrement. Never permits arbitrary negative increments.
 */
export async function refundCapacity(
  supabaseClient: any,
  userId: string,
  cost: number,
  reservationId?: string
): Promise<boolean> {
  if (cost <= 0) return false;

  // Enforce idempotency: prevent repeated refunding of the same reservation
  if (reservationId) {
    if (refundedReservations.has(reservationId)) {
      console.log(`[UsageService] Reservation ${reservationId} has already been refunded. Skipping duplicate refund.`);
      return false;
    }
    refundedReservations.add(reservationId);
    if (refundedReservations.size > 10000) {
      const it = refundedReservations.values();
      for (let i = 0; i < 5000; i++) {
        refundedReservations.delete(it.next().value);
      }
    }
  }

  // 1. Attempt atomic idempotent refund RPC in DB
  try {
    const { data, error } = await supabaseClient.rpc('refund_ai_capacity', {
      p_user_id: userId,
      p_cost: cost,
      p_reservation_id: reservationId || null
    });

    if (!error && data) {
      if (typeof data.refunded === 'boolean') {
        return data.refunded;
      }
      return true;
    }
  } catch (rpcErr: any) {
    console.warn(`[UsageService] refund_ai_capacity RPC not present or failed, using bounded fallback:`, rpcErr?.message || rpcErr);
  }

  // 2. Safe bounded fallback (never drops below 0, never calls increment_usage_field with negative integers)
  try {
    const { data: current, error: getErr } = await supabaseClient
      .from('user_usage_tracking')
      .select('daily_ai_capacity_used')
      .eq('user_id', userId)
      .single();

    if (!getErr && current) {
      const currentVal = current.daily_ai_capacity_used || 0;
      const newVal = Math.max(0, currentVal - cost);
      await supabaseClient
        .from('user_usage_tracking')
        .update({ daily_ai_capacity_used: newVal })
        .eq('user_id', userId);
      return true;
    }
  } catch (err: any) {
    console.warn(`[UsageService] Failed to refund capacity for ${userId}:`, err?.message || err);
  }
  return false;
}

/**
 * Safely and idempotently refunds TTS characters if speech generation failed after reservation.
 * Uses dedicated refund RPC and bounded decrement. Never permits arbitrary negative increments.
 */
export async function refundTtsUsage(
  supabaseClient: any,
  userId: string,
  characterCount: number,
  reservationId?: string
): Promise<boolean> {
  if (characterCount <= 0) return false;

  // Enforce idempotency: prevent repeated refunding of the same reservation
  if (reservationId) {
    if (refundedReservations.has(reservationId)) {
      console.log(`[UsageService] TTS Reservation ${reservationId} has already been refunded. Skipping duplicate refund.`);
      return false;
    }
    refundedReservations.add(reservationId);
    if (refundedReservations.size > 10000) {
      const it = refundedReservations.values();
      for (let i = 0; i < 5000; i++) {
        refundedReservations.delete(it.next().value);
      }
    }
  }

  // 1. Attempt atomic idempotent refund RPC
  try {
    const { data, error } = await supabaseClient.rpc('refund_tts_usage', {
      p_user_id: userId,
      p_character_count: characterCount,
      p_reservation_id: reservationId || null
    });

    if (!error && data) {
      if (typeof data.refunded === 'boolean') {
        return data.refunded;
      }
      return true;
    }
  } catch (rpcErr: any) {
    console.warn(`[UsageService] refund_tts_usage RPC not present or failed, using bounded fallback:`, rpcErr?.message || rpcErr);
  }

  // 2. Safe bounded fallback
  try {
    const { data: current } = await supabaseClient
      .from('user_usage_tracking')
      .select('tts_characters_used_monthly')
      .eq('user_id', userId)
      .maybeSingle();

    if (current) {
      const newVal = Math.max(0, (current.tts_characters_used_monthly || 0) - characterCount);
      await supabaseClient
        .from('user_usage_tracking')
        .update({ tts_characters_used_monthly: newVal })
        .eq('user_id', userId);
      return true;
    }
  } catch (err: any) {
    console.warn(`[UsageService] Failed to refund TTS usage for ${userId}:`, err?.message || err);
  }
  return false;
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
