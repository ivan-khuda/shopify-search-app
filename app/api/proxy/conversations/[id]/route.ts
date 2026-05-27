/**
 * Storefront conversation single-row endpoints (D-04 — IDN-04 resume).
 *
 * GET fetches a Conversation by id with shop + owner defense in depth.
 * PATCH appends a turn to the messages JSONB via atomic raw SQL.
 *
 * withAppProxyHmac forwards only { shop, query, req } — it does not
 * forward Next.js dynamic-segment params. We therefore call
 * verifyAppProxyHmac directly so the exported handler can receive the
 * `{ params }` second argument from Next.js 16 routing.
 *
 * No console.* logging.
 */
import { NextResponse } from 'next/server';
import { verifyAppProxyHmac, AppProxyAuthError } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ id: string }> };

function rateLimitedResponse(retryAfterSeconds: number): Response {
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

function ownerOk(
  row: { visitorId: string; customerId: string | null },
  visitorId: string,
  signedCustomerId: string | null
): boolean {
  if (row.visitorId === visitorId) return true;
  if (signedCustomerId && row.customerId === signedCustomerId) return true;
  return false;
}

async function authGate(
  req: Request
): Promise<
  | { kind: 'ok'; shop: string; query: URLSearchParams }
  | { kind: 'err'; response: Response }
> {
  try {
    const { shop, query } = await verifyAppProxyHmac(req);
    return { kind: 'ok', shop, query };
  } catch (err) {
    if (err instanceof AppProxyAuthError) {
      return {
        kind: 'err',
        response: NextResponse.json({ error: err.code }, { status: err.status }),
      };
    }
    throw err;
  }
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const auth = await authGate(req);
  if (auth.kind === 'err') return auth.response;
  const { shop, query } = auth;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const visitorId = url.searchParams.get('visitor_id') ?? '';
  const signedCustomerId = query.get('logged_in_customer_id');

  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const row = await prisma.conversation.findUnique({ where: { id } });
  if (row == null) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });
  }
  if (row.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }
  if (!ownerOk(row, visitorId, signedCustomerId)) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  return NextResponse.json({
    id: row.id,
    title: row.title,
    messages: row.messages,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  });
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const auth = await authGate(req);
  if (auth.kind === 'err') return auth.response;
  const { shop, query } = auth;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const queryVisitorId = url.searchParams.get('visitor_id') ?? '';
  const signedCustomerId = query.get('logged_in_customer_id');

  const body = (await req.json()) as {
    visitor_id?: string;
    turn?: unknown;
    newMessages?: unknown[];
  };
  const visitorId = body.visitor_id || queryVisitorId;
  if (!visitorId) {
    return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(visitorId, 'read');
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSeconds);

  const existing = await prisma.conversation.findUnique({ where: { id } });
  if (existing == null) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });
  }
  if (existing.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }
  if (!ownerOk(existing, visitorId, signedCustomerId)) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  // Accept either a single turn or an array of new messages. Both append.
  const appended: unknown[] = body.turn !== undefined ? [body.turn] : (body.newMessages ?? []);

  await prisma.$executeRaw`
    UPDATE "conversations"
    SET messages = messages || ${JSON.stringify(appended)}::jsonb,
        "lastMessageAt" = NOW()
    WHERE id = ${id} AND shop = ${shop}
  `;

  return NextResponse.json({ ok: true });
}
