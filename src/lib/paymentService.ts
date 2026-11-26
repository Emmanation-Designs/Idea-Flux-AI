import { PayPalPaymentAdapter } from './paypalAdapter.js';
import { WittyPayGatewayAdapter } from './wittypayAdapter.js';
import { PlanId, Region } from '../subscription/catalog.js';

export type PaymentProvider = 'paypal' | 'paystack' | 'wittypay' | 'apple' | 'google';

export interface CheckoutSessionParams {
  plan: string;
  interval: 'month' | 'year';
  userId: string;
  origin: string;
  region?: string;
  user?: any;
  usdToNgnRate?: number;
}

export interface CheckoutSessionResult {
  url: string;
}

export interface WebhookVerificationResult {
  userId: string;
  plan?: string;
  interval?: 'month' | 'year';
  provider: PaymentProvider;
  region?: Region;
  eventType: string;
  reference?: string;
  orderNo?: string;
  paidAmount?: number;
  payMethod?: string;
}

export interface PaymentProviderAdapter {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null>;
  getCustomerPortalUrl?(userId: string): Promise<string>;
}

/**
 * Generic Fallback Adapter (supports sandbox mode, local simulation, etc.)
 */
export class SandboxPaymentAdapter implements PaymentProviderAdapter {
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { plan, interval, userId, origin } = params;
    console.log(`[SandboxPayment] Simulated checkout created for ${userId}, plan: ${plan}, interval: ${interval}`);
    return {
      url: `${origin}/settings?success=true&sandbox_plan=${plan}&sandbox_interval=${interval}&sandbox_user=${userId}`
    };
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null> {
    if (rawBody && rawBody.userId) {
      return {
        userId: rawBody.userId,
        plan: rawBody.plan,
        interval: rawBody.interval,
        provider: 'paypal',
        eventType: 'checkout.session.completed',
      };
    }
    return null;
  }

  async getCustomerPortalUrl(userId: string): Promise<string> {
    return '#';
  }
}

/**
 * PayPal Payment Adapter Wrap
 */
export class PayPalPaymentProviderAdapter implements PaymentProviderAdapter {
  private paypal = new PayPalPaymentAdapter();

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const planId = params.plan.toLowerCase() as PlanId;
    const region = (params.region || 'international') as Region;
    const user = params.user || { id: params.userId };

    return this.paypal.createCheckoutSession({
      planId,
      region,
      user,
      origin: params.origin
    });
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null> {
    const result = await this.paypal.verifyWebhook(headers, rawBody);
    if (result) {
      return {
        userId: (result as any).userId,
        plan: (result as any).plan,
        interval: (result as any).interval,
        provider: 'paypal',
        eventType: (result as any).eventType,
      };
    }
    return null;
  }
}

/**
 * WittyPay Payment Adapter (Nigeria NGN checkout via WittyPay Merchant API v1)
 */
export class WittyPayPaymentAdapter implements PaymentProviderAdapter {
  private wittypay = new WittyPayGatewayAdapter();

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const res = await this.wittypay.createCheckoutSession(params);
    return { url: res.url };
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null> {
    return this.wittypay.verifyWebhook(headers, rawBody);
  }
}

/**
 * Dynamic adapter lookup based on active payment provider configuration
 */
export function getPaymentAdapter(provider?: string): PaymentProviderAdapter {
  const activeProvider = provider || process.env.ACTIVE_PAYMENT_PROVIDER || 'paypal';
  
  switch (activeProvider.toLowerCase()) {
    case 'paypal':
      return new PayPalPaymentProviderAdapter();
    case 'wittypay':
      return new WittyPayPaymentAdapter();
    case 'sandbox':
    case 'paystack':
      return new SandboxPaymentAdapter();
    default:
      console.warn(`[PaymentService] Unknown payment provider: ${activeProvider}. Falling back to PayPal adapter.`);
      return new PayPalPaymentProviderAdapter();
  }
}
