import { createClient } from '@supabase/supabase-js';
import { getPlan, getPlanPrice, PlanId, Region } from '../subscription/catalog.js';

export interface PayPalAdapterParams {
  planId: PlanId;
  region: Region;
  user: {
    id: string;
    email?: string;
  };
  origin?: string;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration or service role key is missing in environment variables.');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getStoredPaypalId(key: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('plan_limits')
      .select('plan_name')
      .like('plan_name', `${key}:%`);
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    const fullValue = data[0].plan_name;
    const match = fullValue.substring(key.length + 1);
    return match || null;
  } catch (err) {
    console.warn(`[PayPal Storage Get Error] Failed to retrieve key ${key}:`, err);
    return null;
  }
}

async function savePaypalId(key: string, id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const value = `${key}:${id}`;
  
  // Check if it already exists to avoid conflict
  const existing = await getStoredPaypalId(key);
  if (existing) {
    if (existing === id) return;
    // Delete existing
    await supabase.from('plan_limits').delete().like('plan_name', `${key}:%`);
  }
  
  const { error } = await supabase
    .from('plan_limits')
    .insert({
      plan_name: value,
      chat_limit: 0,
      image_generation_limit: 0,
      image_edit_limit: 0,
      image_analysis_limit: 0,
      document_ai_limit: 0,
      pdf_limit: 0,
      ocr_limit: 0,
      tts_monthly_limit: 0,
      tts_max_chars: 0
    });
    
  if (error) {
    console.error(`[PayPal Storage Save Error] Failed to persist ${key}:`, error.message);
    throw error;
  }
}

export class PayPalPaymentAdapter {
  private getBaseUrl(): string {
    return process.env.PAYPAL_ENVIRONMENT === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getPaypalAccessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('PayPal Client ID or Client Secret has not been configured. Please verify PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in settings.');
    }
    
    const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = this.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`PayPal authentication failed: ${response.status} ${response.statusText} - ${errBody}`);
    }
    
    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  private async createProduct(token: string, planId: PlanId): Promise<string> {
    const productName = `Trelvix AI ${planId === 'plus' ? 'Plus' : 'Pro'}`;
    const baseUrl = this.getBaseUrl();
    
    console.log(`[PayPal] Creating Product: ${productName}`);
    
    const response = await fetch(`${baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: productName,
        description: `Premium tier offering advanced access to Trelvix AI ${planId === 'plus' ? 'Plus' : 'Pro'}.`,
        type: 'SERVICE',
        category: 'SOFTWARE'
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      const errorMsg = `[PayPal Catalog Products API Error] Failed to create product for ${productName}: ${response.status} - ${errText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const data = await response.json() as { id: string };
    const productId = data.id;
    
    console.log(`[PayPal] Product Created: ${productId}`);
    return productId;
  }

  private async createPlan(token: string, productId: string, planId: PlanId, region: Region): Promise<string> {
    const regionNamePretty = region === 'nigeria' ? 'Nigeria' : 'International';
    const planNamePretty = `${regionNamePretty} ${planId === 'plus' ? 'Plus' : 'Pro'}`;
    const baseUrl = this.getBaseUrl();
    
    let price = 10.00;
    if (planId === 'plus') {
      price = region === 'nigeria' ? 8.00 : 10.00;
    } else if (planId === 'pro') {
      price = 30.00;
    }
    
    console.log(`[PayPal] Creating Plan: ${planNamePretty}`);
    
    const response = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        product_id: productId,
        name: planNamePretty,
        description: `${planNamePretty} Monthly Subscription`,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: price.toFixed(2),
                currency_code: 'USD'
              }
            }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      const errorMsg = `[PayPal Subscriptions API Error] Failed to create billing plan for ${planNamePretty}: ${response.status} - ${errText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const data = await response.json() as { id: string };
    const planIdResult = data.id;
    
    console.log(`[PayPal] Plan Created: ${planIdResult}`);
    return planIdResult;
  }

  async createCheckoutSession(params: PayPalAdapterParams) {
    const { planId, region, user, origin = 'https://trelvixai.com' } = params;
    const regionNamePretty = region === 'nigeria' ? 'Nigeria' : 'International';
    
    const productKey = `paypal_product_${planId}`;
    const planKey = `paypal_plan_${planId}_${region}`;
    
    // 1. Look up existing IDs from persistent storage
    let productId = await getStoredPaypalId(productKey);
    let paypalPlanId = await getStoredPaypalId(planKey);
    
    let token = '';
    
    // 2. If Product ID doesn't exist, create it
    if (!productId) {
      token = await this.getPaypalAccessToken();
      productId = await this.createProduct(token, planId);
      await savePaypalId(productKey, productId);
    }
    
    // 3. If Plan ID doesn't exist, create it
    if (!paypalPlanId) {
      if (!token) {
        token = await this.getPaypalAccessToken();
      }
      paypalPlanId = await this.createPlan(token, productId, planId, region);
      await savePaypalId(planKey, paypalPlanId);
      console.log('Saved to persistent storage.');
    }
    
    // 4. Authenticate if not already
    if (!token) {
      token = await this.getPaypalAccessToken();
    }
    
    // 5. Get user email
    let userEmail = user?.email;
    if (!userEmail && user?.id) {
      try {
        const supabase = getSupabaseAdminClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();
        if (profile?.email) {
          userEmail = profile.email;
        }
      } catch (err) {
        console.warn(`[PayPal] Failed to fetch user email for user.id: ${user.id}`, err);
      }
    }
    
    // 6. Create Subscription on PayPal
    const baseUrl = this.getBaseUrl();
    const returnUrl = `${origin}/settings?success=true&provider=paypal&plan=${planId}&region=${region}`;
    const cancelUrl = `${origin}/settings`;
    
    const response = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        subscriber: {
          email_address: userEmail || 'customer@trelvixai.com'
        },
        application_context: {
          brand_name: 'Trelvix AI',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      const errorMsg = `[PayPal Subscription Checkout Error] Failed to initiate subscription: ${response.status} - ${errText}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const data = await response.json() as { id: string; links: Array<{ href: string; rel: string }> };
    const subscriptionId = data.id;
    const approvalLink = data.links.find(link => link.rel === 'approve');
    
    if (!approvalLink) {
      const errorMsg = `[PayPal Checkout Error] No approval URL found in PayPal response.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const checkoutUrl = approvalLink.href;
    
    // Structured checkout logging as requested
    console.log(`[Billing]
Provider: PayPal
Region: ${regionNamePretty}
Plan: ${planId.toUpperCase()}
Real Product ID: ${productId}
Real Plan ID: ${paypalPlanId}
Subscription ID: ${subscriptionId}
Approval URL: ${checkoutUrl}`);
    
    return {
      url: checkoutUrl
    };
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any) {
    // PayPal Webhook validation logic placeholder for Phase 3 backward compatibility
    console.log('[PayPalAdapter] Webhook verification initiated');
    return null;
  }
}
