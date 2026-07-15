import webhookHandler, { config as webhookConfig } from '../payment/webhook';

export const config = webhookConfig;

export default async function handler(req: any, res: any) {
  // Delegate directly to the agnostic payment webhook handler
  req.query = { ...req.query, provider: 'stripe' };
  return webhookHandler(req, res);
}
