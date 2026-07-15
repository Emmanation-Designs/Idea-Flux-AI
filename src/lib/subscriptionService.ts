export interface SubscriptionDetails {
  current_plan: 'free' | 'plus' | 'pro';
  subscription_status: string;
  subscription_provider: 'paypal' | 'paystack' | 'stripe' | 'apple' | 'google' | null;
  subscription_start: string;
  subscription_end: string | null;
  country_code: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * Retrieves the complete subscription information for a user.
 * Automatically falls back to free plan if profile is missing.
 */
export async function getSubscription(supabaseClient: any, userId: string): Promise<SubscriptionDetails> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('current_plan, plan, subscription_status, subscription_provider, subscription_start, subscription_end, country_code, currency, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn(`[SubscriptionService] No profile found or error for ${userId}:`, error?.message || error);
      return {
        current_plan: 'free',
        subscription_status: 'active',
        subscription_provider: null,
        subscription_start: new Date().toISOString(),
        subscription_end: null,
        country_code: null,
        currency: 'USD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return {
      current_plan: (data.current_plan || data.plan || 'free').toLowerCase() as any,
      subscription_status: data.subscription_status || 'active',
      subscription_provider: data.subscription_provider || null,
      subscription_start: data.subscription_start || data.created_at || new Date().toISOString(),
      subscription_end: data.subscription_end || null,
      country_code: data.country_code || null,
      currency: data.currency || 'USD',
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error(`[SubscriptionService] Exception while fetching subscription for ${userId}:`, err);
    return {
      current_plan: 'free',
      subscription_status: 'active',
      subscription_provider: null,
      subscription_start: new Date().toISOString(),
      subscription_end: null,
      country_code: null,
      currency: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Updates subscription details for a user.
 * Supports backward-compatibility syncing both current_plan and plan.
 */
export async function updateSubscription(
  supabaseClient: any, 
  userId: string, 
  details: Partial<SubscriptionDetails> & { plan?: string }
): Promise<void> {
  const updatedData: any = {
    ...details,
    updated_at: new Date().toISOString(),
  };

  if (details.current_plan) {
    updatedData.plan = details.current_plan;
  } else if (details.plan) {
    updatedData.current_plan = details.plan;
  }

  const { error } = await supabaseClient
    .from('profiles')
    .update(updatedData)
    .eq('id', userId);

  if (error) {
    console.error(`[SubscriptionService] Failed to update subscription for ${userId}:`, error.message);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}
