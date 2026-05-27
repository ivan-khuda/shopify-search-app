import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';
import { prisma } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';

export const POST = withShopifySession(async ({ shop, session }) => {
  void session; // wrapper validated; the Inngest function reloads its own session by shop

  // D-05: 5-minute idempotency bucket. sha256(shop|floor(now/5min)).
  const idempotencyKey = createHash('sha256')
    .update(`${shop}|${Math.floor(Date.now() / 300_000)}`)
    .digest('hex');

  // Return existing run for any state — D-05 explicitly: if a row exists
  // within the 5-min window (any state), return its id.
  const existing = await prisma.syncRun.findFirst({
    where: { shop, idempotencyKey },
  });
  if (existing) {
    return NextResponse.json({ syncRunId: existing.id });
  }

  const run = await prisma.syncRun.create({
    data: { shop, idempotencyKey, state: 'queued', processedCount: 0 },
  });

  // T-2-leak: event payload contains ONLY syncRunId and shop — no session/token.
  await inngest.send({
    name: 'shopify/product.sync',
    data: { syncRunId: run.id, shop },
  });

  return NextResponse.json({ syncRunId: run.id });
});
