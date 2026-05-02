import Stripe from 'stripe';

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

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[Stripe] Missing STRIPE_SECRET_KEY');
      return res.status(500).json({ error: 'Server configuration error: Missing Stripe Secret Key' });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
    });

    // Get Price IDs from environment variables
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

    // Validation: Ensure the Price ID exists and is not a Product ID
    if (!priceId) {
      const errorMsg = `No Price ID configured for plan: ${plan}, interval: ${interval}`;
      console.error(`[Stripe] ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    if (priceId.startsWith('prod_')) {
      const errorMsg = `Environment variable for ${plan} ${interval} contains a Product ID (${priceId}) instead of a Price ID (price_...). Please update your Vercel environment variables.`;
      console.error(`[Stripe] ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`[Stripe] Creating checkout session for user: ${userId}, plan: ${plan}, price: ${priceId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/settings?success=true`,
      cancel_url: `${origin}/settings`,
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
        interval,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout Error]:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred during Stripe checkout creation',
      code: error.code || 'checkout_error'
    });
  }
}
