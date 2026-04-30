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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20' as any,
  });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig!, webhookSecret!);
  } catch (err: any) {
    console.error(`[Webhook Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id || session.metadata?.userId;
    const plan = session.metadata?.plan;
    const interval = session.metadata?.interval;

    if (userId && plan) {
      console.log(`[Webhook] Activating ${plan} plan for user ${userId}`);
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const expiresAt = new Date();
      if (interval === 'year') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          plan: plan,
          subscription_expires_at: expiresAt.toISOString(),
          last_usage_reset: new Date().toISOString().split('T')[0] // also reset usage date to today
        })
        .eq('id', userId);

      if (error) {
        console.error('[Webhook Supabase Update Error]:', error);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }
      
      console.log(`[Webhook] Success: ${userId} is now ${plan}`);
    }
  }

  res.json({ received: true });
}
