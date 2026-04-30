import Stripe from 'stripe';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, interval, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20' as any,
    });

    let priceId = '';
    if (plan === 'pro') {
      priceId = interval === 'year' 
        ? process.env.STRIPE_PRO_YEARLY_PRICE_ID! 
        : process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
    } else if (plan === 'plus') {
      priceId = interval === 'year' 
        ? process.env.STRIPE_PLUS_YEARLY_PRICE_ID! 
        : process.env.STRIPE_PLUS_MONTHLY_PRICE_ID!;
    }

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or interval' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `https://trelvixai.com/settings?success=true`,
      cancel_url: `https://trelvixai.com/settings`,
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
        interval,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout Error]:', error);
    return res.status(500).json({ error: error.message });
  }
}
