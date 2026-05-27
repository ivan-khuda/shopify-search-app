/**
 * Storefront conversation collection endpoints (D-03/D-05/D-06).
 *
 * All three handlers run behind withAppProxyHmac (STR-04 — HMAC validation,
 * shop derived only from validated signed query, IDN-02 cross-check at the
 * wrapper layer). Each handler additionally applies the 'read' rate-limit
 * bucket (D-08) and ensures every Prisma where clause filters by shop
 * (T-06-04 multi-tenancy lock).
 *
 * No console.* logging anywhere — PROJECT.md hard constraint.
 */
import { NextResponse } from 'next/server';
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { prisma } from '@/lib/db/client';

function ownerFilter(visitorId: string, signedCustomerId: string | null) {
  const orClauses: Array<{ visitorId: string } | { customerId: string }> = [
    { visitorId },
  ];
  if (signedCustomerId) {
    orClauses.push({ customerId: signedCustomerId });
  }
  return orClauses;
}

function rateLimitedResponse(retryAfterSeconds: number): Response {
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

export const GET = withAppProxyHmac(async ({ shop, query, req }) => {
  const url = new URL(req.url);
  const visitorId = url.searchParams.get('visitor_id');
  const cursor = url.searchParams.get('cursor');
  const signedCustomerId = query.get('logged_in_customer_id');

  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const items = await prisma.conversation.findMany({
    where: { shop, OR: ownerFilter(visitorId, signedCustomerId) },
    orderBy: { lastMessageAt: 'desc' },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const slice = items.slice(0, 20).map((c) => ({
    id: c.id,
    title: c.title,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
  }));
  const nextCursor = items.length > 20 ? items[20].id : null;

  return NextResponse.json({ items: slice, nextCursor });
});

export const POST = withAppProxyHmac(async ({ shop, query, req }) => {
  const url = new URL(req.url);
  const queryVisitorId = url.searchParams.get('visitor_id');
  const signedCustomerId = query.get('logged_in_customer_id');

  const body = (await req.json()) as {
    visitor_id?: string;
    customer_id?: string;
    firstMessage?: { text?: string };
  };

  const visitorId = body.visitor_id || queryVisitorId;
  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const rawText = body.firstMessage?.text ?? '';
  const trimmed = rawText.trim().slice(0, 60);
  const title = trimmed.length > 0 ? trimmed : '(no title)';

  const created = await prisma.conversation.create({
    data: {
      shop,
      visitorId,
      customerId: body.customer_id ?? signedCustomerId ?? null,
      title,
      messages: [],
    },
  });

  return NextResponse.json({ conversation_id: created.id, title });
});

export const DELETE = withAppProxyHmac(async ({ shop, query, req }) => {
  const url = new URL(req.url);
  const visitorId = url.searchParams.get('visitor_id');
  const signedCustomerId = query.get('logged_in_customer_id');

  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const result = await prisma.conversation.deleteMany({
    where: { shop, OR: ownerFilter(visitorId, signedCustomerId) },
  });

  return NextResponse.json({ deleted: result.count });
});
