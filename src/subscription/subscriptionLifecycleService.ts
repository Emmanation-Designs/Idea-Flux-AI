import { getSubscription } from '../lib/subscriptionService.js';
import { PlanId, Region } from './catalog.js';

/**
 * Resets daily and monthly usage tracking counters for a given user.
 */
async function resetUsageCounters(supabaseClient: any, userId: string): Promise<void> {
  const now = new Date().toISOString();
  
  const { error } = await supabaseClient
    .from('user_usage_tracking')
    .update({
      chat_today: 0,
      image_generation_today: 0,
      image_edit_today: 0,
      image_analysis_today: 0,
      document_ai_today: 0,
      pdf_today: 0,
      ocr_today: 0,
      tts_characters_used_monthly: 0,
      last_daily_reset: now,
      last_monthly_reset: now
    })
    .eq('user_id', userId);

  if (error) {
    console.warn(`[Usage Reset Warning] Failed to update usage tracking for ${userId}:`, error.message);
  }
}

/**
 * Activates a premium subscription (PLUS or PRO) for a user.
 */
export async function activateSubscription(
  supabaseClient: any,
  userId: string,
  planId: 'plus' | 'pro',
  provider: 'paypal' | 'paystack' | 'stripe' | 'apple' | 'google',
  region: 'nigeria' | 'international',
  interval: 'month' | 'year' = 'month'
): Promise<void> {
  const now = new Date();
  const days = interval === 'year' ? 366 : 31;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const planUpper = planId.toUpperCase();
  const providerUpper = provider.toUpperCase();
  const regionPretty = region === 'nigeria' ? 'Nigeria' : 'International';

  // Structured Logging (STEP 10)
  console.log(`[Subscription]
User: ${userId}
Action: Activate
Plan: ${planUpper}
Provider: ${providerUpper}
Region: ${regionPretty}
Expiry: ${expiresAt.toISOString()}`.trim());

  // Database Update (STEP 5)
  const updateData = {
    current_plan: planId,
    plan: planId, // backward-compatibility
    subscription_status: 'ACTIVE',
    subscription_provider: provider,
    subscription_start: now.toISOString(),
    subscription_end: expiresAt.toISOString(),
    subscription_expires_at: expiresAt.toISOString(), // legacy compatibility
    last_usage_reset: now.toISOString().split('T')[0], // legacy compatibility
    country_code: region === 'nigeria' ? 'NG' : 'US',
    billing_country: region === 'nigeria' ? 'Nigeria' : 'International',
    currency: 'USD',
    billing_currency: 'USD',
    updated_at: now.toISOString()
  };

  const { error } = await supabaseClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`[Subscription Error] Failed to activate subscription for ${userId}:`, error.message);
    throw error;
  }

  // Reset monthly usage counters (STEP 5)
  await resetUsageCounters(supabaseClient, userId);
}

/**
 * Renews an existing active subscription.
 */
export async function renewSubscription(
  supabaseClient: any,
  userId: string,
  interval: 'month' | 'year' = 'month'
): Promise<void> {
  const profile = await getSubscription(supabaseClient, userId);
  const now = new Date();
  const days = interval === 'year' ? 366 : 31;
  
  let baseDate = now;
  if (profile.subscription_end) {
    const currentEnd = new Date(profile.subscription_end);
    if (currentEnd > now) {
      baseDate = currentEnd;
    }
  }
  const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  const planUpper = (profile.current_plan || 'FREE').toUpperCase();
  const providerUpper = (profile.subscription_provider || 'UNKNOWN').toUpperCase();

  // Structured Logging (STEP 10)
  console.log(`[Subscription]
User: ${userId}
Action: Renew
Plan: ${planUpper}
Provider: ${providerUpper}
Expiry: ${newExpiresAt.toISOString()}`.trim());

  const updateData = {
    subscription_status: 'ACTIVE',
    subscription_end: newExpiresAt.toISOString(),
    subscription_expires_at: newExpiresAt.toISOString(),
    updated_at: now.toISOString()
  };

  const { error } = await supabaseClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`[Subscription Error] Failed to renew subscription for ${userId}:`, error.message);
    throw error;
  }

  // Reset monthly usage counters on successful renewal (Step 6)
  await resetUsageCounters(supabaseClient, userId);
}

/**
 * Cancels a subscription, setting status to CANCELLED but retaining active status until expiry.
 */
export async function cancelSubscription(
  supabaseClient: any,
  userId: string
): Promise<void> {
  const profile = await getSubscription(supabaseClient, userId);
  const now = new Date();

  const planUpper = (profile.current_plan || 'FREE').toUpperCase();
  const providerUpper = (profile.subscription_provider || 'UNKNOWN').toUpperCase();

  // Structured Logging (STEP 10)
  console.log(`[Subscription]
User: ${userId}
Action: Cancel
Plan: ${planUpper}
Provider: ${providerUpper}`.trim());

  // Do NOT downgrade immediately (STEP 7)
  const updateData = {
    subscription_status: 'CANCELLED',
    updated_at: now.toISOString()
  };

  const { error } = await supabaseClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`[Subscription Error] Failed to cancel subscription for ${userId}:`, error.message);
    throw error;
  }
}

/**
 * Automatically downgrades a subscription once it passes its expiry date.
 */
export async function expireSubscription(
  supabaseClient: any,
  userId: string
): Promise<void> {
  const profile = await getSubscription(supabaseClient, userId);

  const planUpper = (profile.current_plan || 'FREE').toUpperCase();
  const providerUpper = (profile.subscription_provider || 'UNKNOWN').toUpperCase();

  // Structured Logging (STEP 10)
  console.log(`[Subscription]
User: ${userId}
Action: Expire
Plan: ${planUpper}
Provider: ${providerUpper}`.trim());

  // Step 8: Plan -> FREE, Status -> EXPIRED. Provider remains stored for historical analytics.
  await downgradeToFree(supabaseClient, userId, 'EXPIRED');
}

/**
 * Downgrades a user's subscription to the Free tier.
 */
export async function downgradeToFree(
  supabaseClient: any,
  userId: string,
  status: 'EXPIRED' | 'PAST_DUE' | 'FAILED' = 'EXPIRED'
): Promise<void> {
  const now = new Date();

  // Structured Logging (STEP 10)
  console.log(`[Subscription]
User: ${userId}
Action: Downgrade
Status: ${status}`.trim());

  const updateData = {
    current_plan: 'free',
    plan: 'free', // backward-compatibility
    subscription_status: status,
    // Provider is retained for historical analytics (STEP 8)
    subscription_end: null,
    subscription_expires_at: null,
    updated_at: now.toISOString()
  };

  const { error } = await supabaseClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error(`[Subscription Error] Failed to downgrade user ${userId} to free:`, error.message);
    throw error;
  }

  // Reset counters to free level
  await resetUsageCounters(supabaseClient, userId);
}

/**
 * Changes a user's subscription plan.
 */
export async function changePlan(
  supabaseClient: any,
  userId: string,
  newPlanId: 'plus' | 'pro',
  provider: 'paypal' | 'paystack' | 'stripe' | 'apple' | 'google',
  region: 'nigeria' | 'international',
  interval: 'month' | 'year' = 'month'
): Promise<void> {
  await activateSubscription(supabaseClient, userId, newPlanId, provider, region, interval);
}

/**
 * Syncs the subscription details to enforce active expiration checking.
 */
export async function syncSubscription(
  supabaseClient: any,
  userId: string
): Promise<void> {
  const profile = await getSubscription(supabaseClient, userId);
  const now = new Date();

  if (profile.current_plan !== 'free' && profile.subscription_end) {
    const expiresAt = new Date(profile.subscription_end);
    if (now > expiresAt) {
      console.log(`[Subscription] Expiration detected during sync for user: ${userId}. Subscription ended on: ${profile.subscription_end}`);
      await expireSubscription(supabaseClient, userId);
    }
  }
}

/**
 * Validates a user's subscription, running automatically on authentication.
 */
export async function validateSubscription(
  supabaseClient: any,
  userId: string
): Promise<void> {
  // Prevent users from keeping paid access forever by syncing dynamically (STEP 9)
  await syncSubscription(supabaseClient, userId);
}
