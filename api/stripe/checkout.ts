import checkoutHandler from '../payment/checkout';

export default async function handler(req: any, res: any) {
  // Delegate directly to the agnostic payment checkout handler
  req.body = { ...req.body, provider: 'stripe' };
  return checkoutHandler(req, res);
}
