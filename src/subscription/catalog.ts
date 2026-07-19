export type PlanId = 'free' | 'plus' | 'pro';
export type Region = 'nigeria' | 'international';
export type PaymentProviderType = 'paypal' | 'paystack' | 'stripe' | 'apple' | 'google';

export interface PlanIdentity {
  id: PlanId;
  displayName: string;
  description: string;
  badge: string;
  status?: 'active' | 'inactive';
}

export interface PricingDetail {
  currency: string;
  price: number;
}

export interface PlanPricing {
  nigeria: PricingDetail;
  international: PricingDetail;
}

export interface PlanLimits {
  chat: 'unlimited' | number;
  tts: number;
  tts_max_chars: number;
  image_generation: 'unlimited' | number;
  image_edit: 'unlimited' | number;
  image_analysis: 'unlimited' | number;
  ocr: 'unlimited' | number;
  document_ai: 'unlimited' | number;
  pdf: 'unlimited' | number;
  ads: 'enabled' | 'disabled';
}

export interface PlanFeatures {
  voice_mode: boolean;
  image_generation: boolean;
  image_edit: boolean;
  image_analysis: boolean;
  ocr: boolean;
  document_ai: boolean;
  pdf: boolean;
  premium_models: boolean;
  priority_queue: boolean;
  ads: boolean;
  [key: string]: boolean; // Facilitates easy future extension of feature flags
}

export interface PaypalPaymentConfig {
  productId: string;
  planId: string;
}

export interface PaystackPaymentConfig {
  planCode: string;
}

export interface PlanPayment {
  paypal: {
    nigeria: PaypalPaymentConfig;
    international: PaypalPaymentConfig;
  };
  paystack: {
    nigeria: PaystackPaymentConfig;
    international: PaystackPaymentConfig;
  };
}

export interface PlanMarketing {
  headline: string;
  buttonText: string;
  badge: string;
}

export interface PlanCatalogEntry {
  identity: PlanIdentity;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
  payment: PlanPayment;
  marketing: PlanMarketing;
}

export const SUBSCRIPTION_CATALOG: Record<PlanId, PlanCatalogEntry> = {
  free: {
    identity: {
      id: 'free',
      displayName: 'Free',
      description: 'Get started with basic features.',
      badge: 'Free',
      status: 'active',
    },
    pricing: {
      nigeria: { currency: 'USD', price: 0 },
      international: { currency: 'USD', price: 0 },
    },
    limits: {
      chat: 25,
      tts: 10000,
      tts_max_chars: 2000,
      image_generation: 5,
      image_edit: 3,
      image_analysis: 10,
      ocr: 5,
      document_ai: 5,
      pdf: 3,
      ads: 'enabled',
    },
    features: {
      voice_mode: true,
      image_generation: true,
      image_edit: true,
      image_analysis: true,
      ocr: true,
      document_ai: true,
      pdf: true,
      premium_models: false,
      priority_queue: false,
      ads: true,
    },
    payment: {
      paypal: {
        nigeria: { productId: '', planId: '' },
        international: { productId: '', planId: '' },
      },
      paystack: {
        nigeria: { planCode: '' },
        international: { planCode: '' },
      },
    },
    marketing: {
      headline: 'Get started for free',
      buttonText: 'Current Plan',
      badge: 'Free',
    },
  },
  plus: {
    identity: {
      id: 'plus',
      displayName: 'Plus',
      description: 'More power, higher limits, and no ads.',
      badge: 'Most Popular',
      status: 'active',
    },
    pricing: {
      nigeria: { currency: 'USD', price: 8 },
      international: { currency: 'USD', price: 10 },
    },
    limits: {
      chat: 'unlimited',
      tts: 10000,
      tts_max_chars: 20000,
      image_generation: 'unlimited',
      image_edit: 'unlimited',
      image_analysis: 'unlimited',
      ocr: 'unlimited',
      document_ai: 'unlimited',
      pdf: 'unlimited',
      ads: 'disabled',
    },
    features: {
      voice_mode: true,
      image_generation: true,
      image_edit: true,
      image_analysis: true,
      ocr: true,
      document_ai: true,
      pdf: true,
      premium_models: true,
      priority_queue: true,
      ads: false,
    },
    payment: {
      paypal: {
        nigeria: { productId: '', planId: '' },
        international: { productId: '', planId: '' },
      },
      paystack: {
        nigeria: { planCode: '' },
        international: { planCode: '' },
      },
    },
    marketing: {
      headline: 'More power. No ads.',
      buttonText: 'Upgrade to Plus',
      badge: 'Most Popular',
    },
  },
  pro: {
    identity: {
      id: 'pro',
      displayName: 'Pro',
      description: 'Maximum performance for professionals.',
      badge: 'Best Value',
      status: 'active',
    },
    pricing: {
      nigeria: { currency: 'USD', price: 25 },
      international: { currency: 'USD', price: 30 },
    },
    limits: {
      chat: 'unlimited',
      tts: 10000,
      tts_max_chars: 100000,
      image_generation: 'unlimited',
      image_edit: 'unlimited',
      image_analysis: 'unlimited',
      ocr: 'unlimited',
      document_ai: 'unlimited',
      pdf: 'unlimited',
      ads: 'disabled',
    },
    features: {
      voice_mode: true,
      image_generation: true,
      image_edit: true,
      image_analysis: true,
      ocr: true,
      document_ai: true,
      pdf: true,
      premium_models: true,
      priority_queue: true,
      ads: false,
    },
    payment: {
      paypal: {
        nigeria: { productId: '', planId: '' },
        international: { productId: '', planId: '' },
      },
      paystack: {
        nigeria: { planCode: '' },
        international: { planCode: '' },
      },
    },
    marketing: {
      headline: 'Maximum performance.',
      buttonText: 'Upgrade to Pro',
      badge: 'Best Value',
    },
  },
};

/**
 * Retrieves catalog entry for a specific plan.
 */
export function getPlan(planId: PlanId): PlanCatalogEntry {
  const plan = SUBSCRIPTION_CATALOG[planId];
  if (!plan) {
    throw new Error(`Invalid planId: ${planId}`);
  }
  return plan;
}

/**
 * Returns pricing configuration based on plan and region.
 */
export function getPlanPrice(planId: PlanId, region: Region): PricingDetail {
  const plan = getPlan(planId);
  return plan.pricing[region];
}

/**
 * Returns dynamic feature limits of a plan.
 */
export function getPlanLimits(planId: PlanId): PlanLimits {
  const plan = getPlan(planId);
  return plan.limits;
}

/**
 * Returns active feature flags of a plan.
 */
export function getPlanFeatures(planId: PlanId): PlanFeatures {
  const plan = getPlan(planId);
  return plan.features;
}

/**
 * Returns provider-specific payment gateway setup details.
 */
export function getPaymentConfiguration(
  planId: PlanId,
  provider: 'paypal' | 'paystack',
  region: Region
): PaypalPaymentConfig | PaystackPaymentConfig {
  const plan = getPlan(planId);
  return plan.payment[provider][region];
}
