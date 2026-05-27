/**
 * Storefront saved-products collection endpoints (D-20 — IDN-05).
 *
 * Idempotent POST relies on the partial unique indexes
 * saved_products_anon_unique_idx and saved_products_customer_unique_idx
 * (db/manual-indexes.sql, D-20) — both back the ON CONFLICT DO NOTHING
 * clause on the raw INSERT.
 *
 * IDN-02 cross-check happens at the wrapper layer (withAppProxyHmac
 * already enforces body.customer_id === signed query.logged_in_customer_id).
 *
 * No console.* logging.
 */
import { NextResponse } from 'next/server';
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { prisma } from '@/lib/db/client';

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

export const GET = withAppProxyHmac(async ({ shop, query, req }) => {
  const url = new URL(req.url);
  const visitorId = url.searchParams.get('visitor_id');
  const signedCustomerId = query.get('logged_in_customer_id');

  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const rows = await prisma.savedProduct.findMany({
    where: { shop, OR: ownerFilter(visitorId, signedCustomerId) },
    select: { productId: true, savedAt: true },
  });

  return NextResponse.json({ items: rows });
});

export const POST = withAppProxyHmac(async ({ shop, query, req }) => {
  const signedCustomerId = query.get('logged_in_customer_id');

  const body = (await req.json()) as {
    visitor_id?: string;
    customer_id?: string;
    product_id?: string;
  };

  const visitorId = body.visitor_id;
  const productId = body.product_id;
  if (!visitorId || !productId) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  // customerId for INSERT: prefer body, fall back to signed value. Wrapper
  // already enforced mismatch protection (IDN-02 at 06-04).
  const customerId = body.customer_id ?? signedCustomerId ?? null;

  const count = await prisma.$executeRaw`
    INSERT INTO "saved_products" (id, shop, "visitorId", "customerId", "productId", "savedAt")
    VALUES (gen_random_uuid()::text, ${shop}, ${visitorId}, ${customerId}, ${productId}, NOW())
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ ok: true, saved: count === 1 });
});
