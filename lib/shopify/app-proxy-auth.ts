/**
 * App Proxy HMAC authentication for storefront-side routes (STR-04, IDN-02).
 *
 * Validates the signed query Shopify attaches to every App Proxy request,
 * then forwards { shop, query, req } to the inner handler. Mirrors
 * `lib/shopify/auth.ts` (admin session-token verification) — same shape,
 * different trust source.
 *
 * Intentional non-features:
 *   - Does NOT load a ShopifySession — App Proxy routes never have one.
 *     Storefront identity arrives as `visitor_id` in the request body /
 *     signed query, not as a session token.
 *   - Does NOT replay-protect. Shopify's timestamp field provides
 *     forensics; Phase 6 explicitly accepts this (threat T-06-08).
 *   - Does NOT log signature, shop, raw query, or error stack. CLAUDE.md
 *     hard constraint: no secrets in logs.
 *
 * The `shop` value is derived ONLY from the validated `query` object.
 * Raw `req.url.searchParams.get('shop')` and `body.shop` must NEVER be used
 * downstream (CR-01 mitigation).
 *
 * CR-03: resolveVerifiedVisitorId() is the single gate every proxy route
 * calls after HMAC to verify the signed visitor token before any rate-limit
 * or DB access. Invalid/unsigned/legacy tokens return 'invalid_visitor_signature'
 * → 401 so the client re-mints via /_meta/visitor.
 */
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { verifyVisitorId } from '@/lib/identity/visitor-signature';

export type AppProxyAuthErrorCode =
  | 'missing_signature'
  | 'invalid_signature'
  | 'missing_shop'
  | 'invalid_shop_domain'
  | 'customer_id_mismatch'
  | 'invalid_visitor_signature';

const STATUS_BY_CODE: Record<AppProxyAuthErrorCode, 401 | 403> = {
  missing_signature: 401,
  invalid_signature: 401,
  missing_shop: 401,
  invalid_shop_domain: 401,
  customer_id_mismatch: 403,
  invalid_visitor_signature: 401,
};

export class AppProxyAuthError extends Error {
  public readonly status: 401 | 403;

  constructor(public readonly code: AppProxyAuthErrorCode) {
    super(`App Proxy auth error: ${code}`);
    this.name = 'AppProxyAuthError';
    this.status = STATUS_BY_CODE[code];
  }
}

export async function verifyAppProxyHmac(
  req: Request
): Promise<{ shop: string; query: URLSearchParams }> {
  const url = new URL(req.url);
  const query = url.searchParams;

  if (!query.get('signature')) {
    throw new AppProxyAuthError('missing_signature');
  }

  // Shopify's validateHmac wants a Record<string, string>; materialize one
  // from URLSearchParams. The wrapper still hands URLSearchParams to the
  // inner handler (test contract).
  const authQuery: Record<string, string> = {};
  query.forEach((value, key) => {
    authQuery[key] = value;
  });

  const isValid = await shopifyClient.utils.validateHmac(authQuery, { signator: 'appProxy' });
  if (!isValid) {
    throw new AppProxyAuthError('invalid_signature');
  }

  const shop = query.get('shop');
  if (!shop) {
    throw new AppProxyAuthError('missing_shop');
  }

  if (!shop.endsWith('.myshopify.com')) {
    throw new AppProxyAuthError('invalid_shop_domain');
  }

  return { shop, query };
}

/**
 * CR-03: Verify the signed visitor token after HMAC auth.
 *
 * Every proxy route calls this AFTER verifyAppProxyHmac, BEFORE rateLimit/DB.
 * The client stores and sends the full signed token `${uuid}.${sig}` as
 * `visitor_id`. This helper verifies it and returns the extracted bare uuid
 * for use as the rate-limit key, conversation visitorId, saved-product
 * visitorId, and mergeVisitorIntoCustomer argument. The signature is a
 * transport-auth concern; only the uuid is persisted in the DB.
 *
 * Returns:
 *   { ok: true, visitorId: uuid } — token verified; visitorId is the bare uuid
 *   { ok: false, code: 'missing_visitor_id' } — no token supplied
 *   { ok: false, code: 'invalid_visitor_signature' } — tampered/unsigned/legacy
 */
export function resolveVerifiedVisitorId(
  rawVisitorId: string | null | undefined
):
  | { ok: true; visitorId: string }
  | { ok: false; code: 'missing_visitor_id' | 'invalid_visitor_signature' } {
  if (!rawVisitorId) {
    return { ok: false, code: 'missing_visitor_id' };
  }
  const result = verifyVisitorId(rawVisitorId);
  if (!result.valid) {
    return { ok: false, code: 'invalid_visitor_signature' };
  }
  return { ok: true, visitorId: result.visitorId };
}

export function withAppProxyHmac(
  handler: (ctx: { shop: string; query: URLSearchParams; req: Request }) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const { shop, query } = await verifyAppProxyHmac(req);

      // IDN-02: when Shopify's App Proxy signs `logged_in_customer_id` into
      // the query, any body-supplied `customer_id` MUST match. Mismatch =>
      // 403 customer_id_mismatch. The wrapper consumes the body once and
      // hands the inner handler a cloned request with an identical body so
      // the downstream stream can still be read.
      const signedCustomerId = query.get('logged_in_customer_id');
      let forwarded: Request = req;
      if (signedCustomerId && req.body != null) {
        const cloned = req.clone();
        const text = await req.text();
        if (text.length > 0) {
          try {
            const parsed: unknown = JSON.parse(text);
            if (
              parsed != null &&
              typeof parsed === 'object' &&
              'customer_id' in parsed
            ) {
              const bodyCustomerId = (parsed as { customer_id?: unknown }).customer_id;
              if (
                bodyCustomerId != null &&
                String(bodyCustomerId) !== signedCustomerId
              ) {
                throw new AppProxyAuthError('customer_id_mismatch');
              }
            }
          } catch (parseErr) {
            // Non-JSON or malformed body — fall through. Mismatch enforcement
            // only kicks in when the body actually parses and carries a
            // customer_id field. AppProxyAuthError must bubble up.
            if (parseErr instanceof AppProxyAuthError) throw parseErr;
          }
        }
        forwarded = cloned;
      }

      return await handler({ shop, query, req: forwarded });
    } catch (err) {
      if (err instanceof AppProxyAuthError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }
  };
}
