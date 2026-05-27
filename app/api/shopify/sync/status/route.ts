import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';
import { prisma } from '@/lib/db/client';

export const GET = withShopifySession(async ({ shop, session, req }) => {
  void session;

  const syncRunId = new URL(req.url).searchParams.get('syncRunId');
  if (!syncRunId) {
    return NextResponse.json({ error: 'missing_sync_run_id' }, { status: 400 });
  }

  const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
  if (!run) {
    return NextResponse.json({ error: 'sync_run_not_found' }, { status: 404 });
  }
  if (run.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }

  return NextResponse.json({
    state: run.state,
    processedCount: run.processedCount,
    totalCount: run.totalCount,
    errors: run.errors,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });
});
