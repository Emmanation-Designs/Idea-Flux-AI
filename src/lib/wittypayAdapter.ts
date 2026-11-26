import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_USD_TO_NGN_RATE,
  getRegionalPlanPrice,
  PlanId,
  Region,
} from '../subscription/catalog.js';

const WITTYPAY_BASE_URL = 'https://wittypay.co/api/merchant/v1';

export interface WittyPayVerifyResult {
  verified: boolean;
  status: string;
  reference: string;
  orderNo?: string;
  amount: number;
  currency: string;
  payMethod?: string;
  userId: string;
  plan: 'plus' | 'pro';
  interval: 'month' | 'year';
  region: Region;
}

function getOptionalSupabaseAdmin() {
  const rawUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://wxezfzhhzlauggufecmm.supabase.co';
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (
    !serviceKey ||
    serviceKey.includes('your_supabase') ||
    serviceKey.startsWith('http') ||
    !serviceKey.startsWith('eyJ') ||
    serviceKey.split('.').length !== 3
  ) {
    return null;
  }
  return createClient(rawUrl.trim(), serviceKey);
}

function getWittyPaySecretKey(): string {
  const key = (process.env.WITTYPAY_SECRET_KEY || '').trim();
  if (!key) {
    throw new Error(
      'WITTYPAY_SECRET_KEY is not configured. Add your sk_test_... or sk_live_... secret key in environment variables.'
    );
  }
  return key;
}

function signOrderMetadata(
  secret: string,
  payload: {
    reference: string;
    userId: string;
    plan: string;
    interval: string;
    amount: number;
  }
): string {
  const msg = `${payload.reference}|${payload.userId}|${payload.plan}|${payload.interval}|${payload.amount}`;
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

function verifyOrderMetadataSig(
  secret: string,
  payload: {
    reference: string;
    userId: string;
    plan: string;
    interval: string;
    amount: number;
  },
  sig: string
): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const expected = signOrderMetadata(secret, payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export class WittyPayGatewayAdapter {
  calculateNgnAmount(
    planId: 'plus' | 'pro',
    interval: 'month' | 'year',
    usdToNgnRate: number = DEFAULT_USD_TO_NGN_RATE
  ): number {
    const regional = getRegionalPlanPrice(planId, 'nigeria', usdToNgnRate);
    const monthlyNgn = regional.price;
    const finalNgn =
      interval === 'year' ? Math.round(monthlyNgn * 12 * 0.9) : monthlyNgn;
    return Math.max(100, Math.round(finalNgn));
  }

  async createCheckoutSession(params: {
    plan: string;
    interval: 'month' | 'year';
    userId: string;
    origin: string;
    region?: string;
    user?: any;
    usdToNgnRate?: number;
  }): Promise<{ url: string; reference: string }> {
    const region = (params.region || 'international').toLowerCase();
    if (region !== 'nigeria') {
      throw new Error('WittyPay is only available for Nigerian users.');
    }

    const planId = params.plan.toLowerCase() as 'plus' | 'pro';
    if (planId !== 'plus' && planId !== 'pro') {
      throw new Error(`Unsupported WittyPay plan: ${params.plan}`);
    }

    const secretKey = getWittyPaySecretKey();
    const rate =
      params.usdToNgnRate && params.usdToNgnRate > 0
        ? params.usdToNgnRate
        : DEFAULT_USD_TO_NGN_RATE;
    const amountNgn = this.calculateNgnAmount(planId, params.interval, rate);

    const reference = `TRVX-${params.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}-${Date.now()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    let customerEmail = params.user?.email || '';
    let customerName = params.user?.name || '';
    const supabaseAdmin = getOptionalSupabaseAdmin();

    if (supabaseAdmin && (!customerEmail || !customerName)) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name, display_name, name')
          .eq('id', params.userId)
          .maybeSingle();

        if (profile) {
          customerEmail = customerEmail || profile.email || '';
          customerName =
            customerName ||
            profile.full_name ||
            profile.display_name ||
            profile.name ||
            '';
        }
      } catch (err) {
        console.warn('[WittyPay] Could not read profile details for checkout:', err);
      }
    }

    const sig = signOrderMetadata(secretKey, {
      reference,
      userId: params.userId,
      plan: planId,
      interval: params.interval,
      amount: amountNgn,
    });

    const metadata = {
      userId: params.userId,
      plan: planId,
      interval: params.interval,
      region: 'nigeria',
      expectedAmountNgn: amountNgn,
      usdToNgnRate: rate,
      sig,
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('payment_transactions').insert({
          reference,
          user_id: params.userId,
          provider: 'wittypay',
          plan: planId,
          interval: params.interval,
          region: 'nigeria',
          expected_amount: amountNgn,
          currency: 'NGN',
          status: 'pending',
          metadata,
        });
      } catch (txErr) {
        // Non-fatal if payment_transactions table has not been migrated yet
        console.warn('[WittyPay] Pending transaction log skipped:', txErr);
      }
    }

    const originClean = (params.origin || 'https://trelvixai.com').replace(/\/$/, '');
    const callbackUrl = `${originClean}/settings/billing?provider=wittypay&ref=${encodeURIComponent(reference)}`;
    const notifyUrl = `${originClean}/api/payment/webhook?provider=wittypay`;

    const bodyPayload: Record<string, any> = {
      amount: amountNgn,
      reference,
      callback_url: callbackUrl,
      notify_url: notifyUrl,
      title: `Trelvix AI ${planId.toUpperCase()} (${params.interval === 'year' ? 'Yearly' : 'Monthly'})`,
      description: `Trelvix AI ${planId.toUpperCase()} Nigerian NGN subscription`,
      metadata,
    };

    if (customerName) bodyPayload.customer_name = customerName;
    if (customerEmail) bodyPayload.customer_email = customerEmail;

    console.log(
      `[WittyPay] Initializing checkout: ref=${reference}, plan=${planId}, interval=${params.interval}, amount=NGN ${amountNgn} (rate=${rate})`
    );

    const response = await fetch(`${WITTYPAY_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok || data?.status !== 'success' || !data?.data?.checkout_url) {
      const msg =
        data?.message ||
        `WittyPay checkout initialization failed (HTTP ${response.status})`;
      console.error('[WittyPay] Init error:', data);
      throw new Error(msg);
    }

    return {
      url: data.data.checkout_url,
      reference: data.data.reference || reference,
    };
  }

  async verifyTransaction(
    reference: string,
    fallbackMetadata?: Record<string, any>
  ): Promise<WittyPayVerifyResult> {
    if (!reference || typeof reference !== 'string') {
      throw new Error('Transaction reference is required.');
    }

    const secretKey = getWittyPaySecretKey();
    const response = await fetch(
      `${WITTYPAY_BASE_URL}/payments?ref=${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const payload = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || payload?.status !== 'success' || !payload?.data) {
      throw new Error(
        payload?.message ||
          `Failed to verify WittyPay transaction (HTTP ${response.status})`
      );
    }

    const txData = payload.data;
    const txStatus = String(txData.status || '').toLowerCase();
    const txCurrency = String(txData.currency || 'NGN').toUpperCase();
    const paidAmount = Number(txData.amount || 0);

    if (txStatus !== 'success') {
      throw new Error(`Transaction ${reference} status is '${txStatus}', not 'success'.`);
    }
    if (txCurrency !== 'NGN') {
      throw new Error(`Unexpected WittyPay currency '${txCurrency}'. Expected NGN.`);
    }

    // Resolve authoritative order details from DB first, then signed metadata
    const supabaseAdmin = getOptionalSupabaseAdmin();
    let storedTx: any = null;
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('payment_transactions')
          .select('*')
          .eq('reference', reference)
          .maybeSingle();
        storedTx = data || null;
      } catch {}
    }

    const meta = txData.metadata || fallbackMetadata || storedTx?.metadata || {};
    const userId = String(storedTx?.user_id || meta.userId || '').trim();
    const planRaw = String(storedTx?.plan || meta.plan || '').toLowerCase();
    const intervalRaw = String(storedTx?.interval || meta.interval || 'month').toLowerCase();
    const plan: 'plus' | 'pro' = planRaw === 'pro' ? 'pro' : 'plus';
    const interval: 'month' | 'year' = intervalRaw === 'year' ? 'year' : 'month';

    if (!userId) {
      throw new Error(`Cannot determine userId for WittyPay transaction ${reference}.`);
    }

    let expectedAmount = Number(storedTx?.expected_amount || meta.expectedAmountNgn || 0);

    if (storedTx) {
      expectedAmount = Number(storedTx.expected_amount);
    } else if (meta.sig) {
      const validSig = verifyOrderMetadataSig(
        secretKey,
        {
          reference,
          userId,
          plan,
          interval,
          amount: expectedAmount,
        },
        meta.sig
      );
      if (!validSig) {
        throw new Error(`WittyPay transaction ${reference} failed order metadata signature verification.`);
      }
    } else {
      expectedAmount = this.calculateNgnAmount(plan, interval, DEFAULT_USD_TO_NGN_RATE);
    }

    if (paidAmount + 1 < expectedAmount) {
      throw new Error(
        `WittyPay amount mismatch for ${reference}: paid ₦${paidAmount}, expected ₦${expectedAmount}.`
      );
    }

    return {
      verified: true,
      status: txStatus,
      reference,
      orderNo: txData.order_no,
      amount: paidAmount,
      currency: txCurrency,
      payMethod: txData.pay_method,
      userId,
      plan,
      interval,
      region: 'nigeria',
    };
  }

  async verifyWebhook(
    headers: Record<string, any>,
    rawBody: any
  ): Promise<{
    userId: string;
    plan?: string;
    interval?: 'month' | 'year';
    provider: 'wittypay';
    region: Region;
    eventType: string;
    reference?: string;
    orderNo?: string;
    paidAmount?: number;
    payMethod?: string;
  } | null> {
    const secretKey = getWittyPaySecretKey();
    const webhookSecret = (process.env.WITTYPAY_WEBHOOK_SECRET || '').trim();

    const sigHeader = String(
      headers['x-wittypay-signature'] || headers['X-Wittypay-Signature'] || ''
    ).trim();

    if (!sigHeader) {
      throw new Error('Missing X-Wittypay-Signature header');
    }

    const receivedHex = sigHeader.startsWith('sha512=')
      ? sigHeader.slice(7).trim()
      : sigHeader;

    const rawBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(
          typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {})
        );

    const matchesSecret = (candidateSecret: string): boolean => {
      if (!candidateSecret) return false;
      const expectedHex = crypto
        .createHmac('sha512', candidateSecret)
        .update(rawBuffer)
        .digest('hex');
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expectedHex, 'utf8'),
          Buffer.from(receivedHex, 'utf8')
        );
      } catch {
        return false;
      }
    };

    if (!matchesSecret(secretKey) && !matchesSecret(webhookSecret)) {
      throw new Error('Invalid X-Wittypay-Signature');
    }

    const parsed = JSON.parse(rawBuffer.toString('utf8'));
    const event = String(parsed?.event || '');
    const data = parsed?.data || {};

    console.log(`[WittyPay Webhook] Verified signature for event: ${event}`);

    if (event !== 'payment.success') {
      return null;
    }

    const reference = String(data.reference || '').trim();
    if (!reference) {
      throw new Error('WittyPay payment.success webhook missing reference');
    }

    // Re-verify live against GET /payments?ref=... per WittyPay security best practices
    const verified = await this.verifyTransaction(reference, data.metadata);

    return {
      userId: verified.userId,
      plan: verified.plan,
      interval: verified.interval,
      provider: 'wittypay',
      region: 'nigeria',
      eventType: 'payment.success',
      reference: verified.reference,
      orderNo: verified.orderNo,
      paidAmount: verified.amount,
      payMethod: verified.payMethod,
    };
  }
}
