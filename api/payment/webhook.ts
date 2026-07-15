import { createClient } from '@supabase/supabase-js';
import { getPaymentAdapter } from '../../src/lib/paymentService';

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

  // Determine which payment provider webhook this belongs to.
  // In a multi-provider setup, we can check headers or query params (e.g. /api/payment/webhook?provider=stripe)
  const provider = req.query.provider || process.env.ACTIVE_PAYMENT_PROVIDER || 'stripe';
  
  try {
    const rawBody = await getRawBody(req);
    const adapter = getPaymentAdapter(provider);
    
    const result = await adapter.verifyWebhook(req.headers, rawBody);
    
    if (result) {
      const { userId, plan, interval, provider: resolvedProvider } = result;
      console.log(`[Payment Webhook] Webhook validated successfully. User: ${userId}, Plan: ${plan}, Provider: ${resolvedProvider}`);
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const daysToAdd = interval === 'year' ? 366 : 31;
      const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

      let updateData: any = {
        subscription_expires_at: expiresAt.toISOString(),
        last_usage_reset: new Date().toISOString().split('T')[0],
        subscription_status: 'active',
        subscription_provider: resolvedProvider,
        subscription_start: new Date().toISOString(),
        subscription_end: expiresAt.toISOString(),
        currency: 'USD',
        updated_at: new Date().toISOString()
      };

      if (plan) {
        updateData.plan = plan;
        updateData.current_plan = plan;
      }

      console.log(`[Payment Webhook] Updating profile in Supabase for user: ${userId}`);
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('[Payment Webhook Supabase Update Error]:', error);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }
      
      console.log(`[Payment Webhook] Successfully updated profile for user: ${userId}`);
    } else {
      console.log('[Payment Webhook] Webhook event received but no user update required.');
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Payment Webhook Error]:', error.message || error);
    return res.status(400).send(`Webhook verification failed: ${error.message || error}`);
  }
}
