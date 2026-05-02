import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Vercel webhook config to disable body parsing for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('[Stripe Webhook] Missing configuration (secret key or webhook secret)');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16' as any,
  });

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('[Stripe Webhook] Missing stripe-signature header');
    return res.status(400).send('Webhook Error: Missing signature');
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook Signature Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  // Handle the event
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
    const session = event.data.object as any;
    
    // For checkout.session.completed, we use client_reference_id
    // For invoice.paid, we look up metadata
    const userId = session.client_reference_id || session.metadata?.userId;
    const plan = session.metadata?.plan;
    const interval = session.metadata?.interval;

    if (userId && (plan || event.type === 'invoice.paid')) {
      console.log(`[Stripe Webhook] Processing ${event.type} for user: ${userId}, plan: ${plan}`);
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const daysToAdd = interval === 'year' ? 366 : 31;
      const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

      let updateData: any = {
        subscription_expires_at: expiresAt.toISOString(),
        last_usage_reset: new Date().toISOString().split('T')[0]
      };

      if (plan) {
        updateData.plan = plan;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('[Stripe Webhook Supabase Update Error]:', error);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }
      
      console.log(`[Stripe Webhook] Success: Updated profile for ${userId}`);
    }
  }

  res.json({ received: true });
}
