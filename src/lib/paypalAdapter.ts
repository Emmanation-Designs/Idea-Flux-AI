import { getPlan, getPlanPrice, getPaymentConfiguration, PlanId, Region } from '../subscription/catalog.js';

export interface PayPalAdapterParams {
  planId: PlanId;
  region: Region;
  user: {
    id: string;
    email?: string;
  };
  origin?: string;
}

export class PayPalPaymentAdapter {
  async createCheckoutSession(params: PayPalAdapterParams) {
    const { planId, region, user, origin = 'https://trelvixai.com' } = params;

    const plan = getPlan(planId);
    const priceDetail = getPlanPrice(planId, region);
    const paymentConfig = getPaymentConfiguration(planId, 'paypal', region) as { productId: string; planId: string };

    const planNameUpper = planId.toUpperCase();
    const regionNamePretty = region === 'nigeria' ? 'Nigeria' : 'International';

    // Structured logging as requested in Step 6
    console.log(`[Billing]
Provider: PayPal
Plan: ${planNameUpper}
Region: ${regionNamePretty}
Price: $${priceDetail.price}
Currency: ${priceDetail.currency}
Product ID: ${paymentConfig?.productId || 'NOT CONFIGURED'}
Plan ID: ${paymentConfig?.planId || 'NOT CONFIGURED'}
Checkout Created`.trim());

    // Validation as requested in Step 5 & 7
    if (!paymentConfig || !paymentConfig.planId || !paymentConfig.productId) {
      const errorMsg = `PayPal Plan ID has not yet been configured for ${planNameUpper} (${regionNamePretty}).`;
      console.error(`[PayPalAdapter Error] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // In a real integration, we would create a PayPal billing agreement / subscription checkout session here.
    // For now, this is preparing the architecture, as requested in Step 5 and Step 9.
    const checkoutUrl = `https://www.paypal.com/checkoutnow?token=simulated_paypal_token_${planId}_${region}_${user.id}`;
    
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
