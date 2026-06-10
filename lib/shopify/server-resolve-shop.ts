import { headers } from 'next/headers';
import { shopifyClient } from '@/lib/shopify/client';

/**
 * Server Component shop resolver — decodes the embedded session-token from the
 * incoming request's Authorization header and returns the verified shop hostname.
 *
 * Returns null when the header is absent or the token fails to decode/validate,
 * letting callers fall back to searchParams.shop (preserves direct-navigation refresh).
 *
 * Mirrors the decode portion of `lib/shopify/auth.ts:verifyShopSessionToken` but
 * sources the header via Next.js 16's `await headers()` (Server Component idiom,
 * not the route-handler `Request` object).
 */
export async function resolveShopFromRequest(): Promise<string | null> {
  const h = await headers();
  const authHeader = h.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length);
  let payload: { dest?: string };
  try {
    payload = await shopifyClient.session.decodeSessionToken(token);
  } catch {
    return null;
  }

  if (!payload.dest) return null;
  let shop: string;
  try {
    shop = new URL(payload.dest).hostname;
  } catch {
    return null;
  }
  return shop.endsWith('.myshopify.com') ? shop : null;
}
