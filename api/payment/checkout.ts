import { getPaymentAdapter } from '../../src/lib/paymentService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, interval, userId } = req.body;
    const origin = req.headers.origin || "https://trelvixai.com";

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!plan || !interval) {
      return res.status(400).json({ error: 'Plan and interval are required' });
    }

    // Determine requested provider, fallback to environment default
    const provider = req.body.provider || process.env.ACTIVE_PAYMENT_PROVIDER || 'stripe';
    const adapter = getPaymentAdapter(provider);

    console.log(`[Payment Checkout] Initiating checkout via adapter: ${provider} for user: ${userId}`);
    const result = await adapter.createCheckoutSession({
      plan,
      interval,
      userId,
      origin,
    });

    return res.status(200).json({ url: result.url });
  } catch (error: any) {
    console.error('[Payment Checkout Error]:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred during checkout creation',
      code: error.code || 'checkout_error'
    });
  }
}
