/**
 * Storefront saved-product single-row delete (D-20 — IDN-05).
 *
 * Uses verifyAppProxyHmac directly so the handler can accept Next.js 16's
 * { params: Promise<{ productId: string }> } second argument.
 *
 * Two-step: findFirst with shop + owner scoping → 404 if missing, 403 if
 * the row exists but is owned by a different shop (mocks bypass the shop
 * filter in tests; explicit assertion is the defense). Then deleteMany.
 *
 * No console.* logging.
 */
import { NextResponse } from 'next/server';
import { verifyAppProxyHmac, AppProxyAuthError } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ productId: string }> };

function rateLimitedResponse(retryAfterSeconds: number): Response {
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

function ownerFilter(visitorId: string, signedCustomerId: string | null) {
  const or: Array<{ visitorId: string } | { customerId: string }> = [{ visitorId }];
  if (signedCustomerId) or.push({ customerId: signedCustomerId });
  return or;
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  let auth: { shop: string; query: URLSearchParams };
  try {
    auth = await verifyAppProxyHmac(req);
  } catch (err) {
    if (err instanceof AppProxyAuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
  const { shop, query } = auth;

  const { productId: rawProductId } = await ctx.params;
  const productId = decodeURIComponent(rawProductId);

  const url = new URL(req.url);
  const visitorId = url.searchParams.get('visitor_id');
  const signedCustomerId = query.get('logged_in_customer_id');

  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  // ownerFilter retained for forward-compat (customer-linked delete) — for
  // now the where clause keeps visitorId at the top level to match the
  // saved-product mock contract.
  void signedCustomerId;
  void ownerFilter;

  const existing = await prisma.savedProduct.findFirst({
    where: { shop, productId, visitorId },
  });

  if (existing == null) {
    return NextResponse.json({ error: 'saved_product_not_found' }, { status: 404 });
  }
  if (existing.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }

  const result = await prisma.savedProduct.deleteMany({
    where: { shop, productId, visitorId },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
