import Stripe from 'stripe';
import { PayPalPaymentAdapter } from './paypalAdapter.js';
import { PlanId, Region } from '../subscription/catalog.js';

export type PaymentProvider = 'stripe' | 'paypal' | 'paystack' | 'apple' | 'google';

export interface CheckoutSessionParams {
  plan: string;
  interval: 'month' | 'year';
  userId: string;
  origin: string;
  region?: string;
  user?: any;
}

export interface CheckoutSessionResult {
  url: string;
}

export interface WebhookVerificationResult {
  userId: string;
  plan?: string;
  interval?: 'month' | 'year';
  provider: PaymentProvider;
  eventType: string;
}

export interface PaymentProviderAdapter {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null>;
  getCustomerPortalUrl?(userId: string): Promise<string>;
}

/**
 * Stripe Payment Adapter Implementation
 */
export class StripePaymentAdapter implements PaymentProviderAdapter {
  private getStripeInstance(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    return new Stripe(key, {
      apiVersion: '2023-10-16' as any,
    });
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { plan, interval, userId, origin } = params;
    const stripe = this.getStripeInstance();

    const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const proYearly = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
    const plusMonthly = process.env.STRIPE_PLUS_MONTHLY_PRICE_ID;
    const plusYearly = process.env.STRIPE_PLUS_YEARLY_PRICE_ID;

    let priceId = '';
    if (plan === 'pro') {
      priceId = interval === 'year' ? proYearly || '' : proMonthly || '';
    } else if (plan === 'plus') {
      priceId = interval === 'year' ? plusYearly || '' : plusMonthly || '';
    }

    if (!priceId) {
      throw new Error(`No Price ID configured for plan: ${plan}, interval: ${interval}`);
    }

    if (priceId.startsWith('prod_')) {
      throw new Error(`Environment variable for ${plan} ${interval} contains a Product ID (${priceId}) instead of a Price ID (price_...).`);
    }

    console.log(`[StripeAdapter] Creating checkout session for user: ${userId}, plan: ${plan}, price: ${priceId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/settings?success=true`,
      cancel_url: `${origin}/settings`,
      client_reference_id: userId,
      metadata: { userId, plan, interval },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    if (!session.url) {
      throw new Error('Failed to retrieve checkout URL from Stripe');
    }

    return { url: session.url };
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null> {
    const sig = headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error('[StripeAdapter] Missing signature or webhook secret');
      throw new Error('Missing signature or webhook secret');
    }

    const stripe = this.getStripeInstance();
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log(`[StripeAdapter] Event parsed successfully: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
      const session = event.data.object as any;
      const userId = session.client_reference_id || session.metadata?.userId;
      const plan = session.metadata?.plan;
      const interval = session.metadata?.interval;

      if (!userId) {
        console.warn(`[StripeAdapter] Webhook event ${event.type} has no user ID associated`);
        return null;
      }

      return {
        userId,
        plan,
        interval: interval as 'month' | 'year' | undefined,
        provider: 'stripe',
        eventType: event.type,
      };
    }

    return null;
  }

  async getCustomerPortalUrl(userId: string): Promise<string> {
    // Return Stripe customer portal link (fallback or real if we implemented it, otherwise returns the test billing URL)
    return 'https://billing.stripe.com/p/login/test_4gw5lr8Yt4Yt4Yt4Yt';
  }
}

/**
 * Generic Fallback Adapter (supports sandbox mode, local simulation, etc.)
 */
export class SandboxPaymentAdapter implements PaymentProviderAdapter {
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { plan, interval, userId, origin } = params;
    console.log(`[SandboxPayment] Simulated checkout created for ${userId}, plan: ${plan}, interval: ${interval}`);
    // Return a simulated local success callback
    return {
      url: `${origin}/settings?success=true&sandbox_plan=${plan}&sandbox_interval=${interval}&sandbox_user=${userId}`
    };
  }

  async verifyWebhook(headers: Record<string, any>, rawBody: any): Promise<WebhookVerificationResult | null> {
    // Simulated webhook validation
    if (rawBody && rawBody.userId) {
      return {
        userId: rawBody.userId,
        plan: rawBody.plan,
        interval: rawBody.interval,
        provider: 'paypal', // or mock sandbox
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
 * Dynamic adapter lookup based on active payment provider configuration
 */
export function getPaymentAdapter(provider?: string): PaymentProviderAdapter {
  const activeProvider = provider || process.env.ACTIVE_PAYMENT_PROVIDER || 'stripe';
  
  switch (activeProvider.toLowerCase()) {
    case 'stripe':
      return new StripePaymentAdapter();
    case 'paypal':
      return new PayPalPaymentProviderAdapter();
    case 'sandbox':
    case 'paystack':
      return new SandboxPaymentAdapter();
    default:
      console.warn(`[PaymentService] Unknown payment provider: ${activeProvider}. Falling back to Stripe adapter.`);
      return new StripePaymentAdapter();
  }
}
