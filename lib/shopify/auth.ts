import type { Session } from '@shopify/shopify-api';
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export type ShopifyAuthErrorCode =
  | 'missing_token'
  | 'invalid_token'
  | 'invalid_dest'
  | 'invalid_shop_domain'
  | 'no_offline_session';

export class ShopifyAuthError extends Error {
  public readonly status: 401 = 401;

  constructor(public readonly code: ShopifyAuthErrorCode) {
    super(`Shopify auth error: ${code}`);
    this.name = 'ShopifyAuthError';
  }
}

export async function verifyShopSessionToken(
  req: Request
): Promise<{ shop: string; session: Session }> {
  // Step 1: Check Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ShopifyAuthError('missing_token');
  }

  // Step 2: Decode the session token
  const token = authHeader.slice('Bearer '.length);
  let payload: { dest?: string };
  try {
    payload = await shopifyClient.session.decodeSessionToken(token);
  } catch {
    throw new ShopifyAuthError('invalid_token');
  }

  // Step 3: Validate dest is present (D-06: distinct from invalid_token)
  if (!payload.dest) {
    throw new ShopifyAuthError('invalid_dest');
  }

  // Step 4: Parse dest as URL to extract shop hostname (D-06: URL parse failure is invalid_dest)
  let shop: string;
  try {
    shop = new URL(payload.dest).hostname;
  } catch {
    throw new ShopifyAuthError('invalid_dest');
  }

  // Step 5: Validate shop domain
  if (!shop.endsWith('.myshopify.com')) {
    throw new ShopifyAuthError('invalid_shop_domain');
  }

  // Step 6: Load offline session
  const sessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(sessionId);

  if (session == null) {
    throw new ShopifyAuthError('no_offline_session');
  }

  // Step 7: Return verified context
  return { shop, session };
}

export function withShopifySession(
  handler: (ctx: { shop: string; session: Session; req: Request }) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const { shop, session } = await verifyShopSessionToken(req);
      return await handler({ shop, session, req });
    } catch (err) {
      if (err instanceof ShopifyAuthError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }
  };
}
