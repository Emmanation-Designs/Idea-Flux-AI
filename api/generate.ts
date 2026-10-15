import { handleGenerate } from '../server.js';

export const config = {
  maxDuration: 300, // Extend duration if possible on Vercel
};

/**
 * Authoritative entry point for /api/generate.
 * Delegates directly to the centralized handleGenerate implementation in server.ts.
 * This guarantees that:
 * 1. Authentication is strictly required via Bearer session tokens.
 * 2. The user ID is authoritatively derived from the verified token identity (preventing impersonation).
 * 3. Authoritative subscription and daily AI capacity limits are checked and reserved atomically.
 * 4. Failed requests are safely refunded without corrupting quotas.
 * 5. Bypassing server.ts security controls is impossible.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return handleGenerate(req, res);
}
