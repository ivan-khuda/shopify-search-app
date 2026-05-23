import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';

// TODO(Phase 2): wire real syncProducts(shop, session). The route currently
// returns success synchronously after auth — Phase 2 enqueues an Inngest job
// to a SyncRun row and returns { syncRunId } instead.
export const POST = withShopifySession(async ({ shop, session }) => {
  void shop;
  void session;
  return NextResponse.json({ success: true });
});
