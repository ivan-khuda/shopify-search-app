# Plan 01-08 Summary

**Status:** complete
**Wave:** 3
**Requirements:** FND-05

## What shipped

`app/api/shopify/sync/route.ts` collapsed from 45 lines to 11:

```ts
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';

// TODO(Phase 2): wire real syncProducts(shop, session)…
export const POST = withShopifySession(async ({ shop, session }) => {
  void shop;
  void session;
  return NextResponse.json({ success: true });
});
```

This is the reference implementation for the `withShopifySession` pattern — every Phase 2+ embedded admin route follows this shape.

`app/api/shopify/sync/__tests__/route.test.ts` updated for the D-06 error-code split (Option B — keep SDK-level mocks since they still flow through `verifyShopSessionToken` internally):
- "returns 401 when payload.dest is not a parseable URL" → asserts `'invalid_dest'` (was `'invalid_token'`)
- "returns 401 when payload.dest hostname is not a *.myshopify.com domain" → asserts `'invalid_shop_domain'` (was `'invalid_token'`)
- Test names updated to mention the new codes
- Other 4 assertions byte-identical

## Verification

- `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` → 6/6 GREEN
- `wc -l app/api/shopify/sync/route.ts` → 11 (≤ 15 acceptance)
- All grep gates pass: 1 `withShopifySession`, 0 `Authorization`, 0 `decodeSessionToken`, 0 `console.log`

## Notes

Option B mocking strategy works because `verifyShopSessionToken` calls `shopifyClient.session.decodeSessionToken` and `sessionStorage.loadSession` internally — the existing test mocks intercept at the SDK level and the wrapper sees the same return values. Mocking `verifyShopSessionToken` directly was the alternative (Option A) but would have required rewriting all 6 tests.

## Handoff

- Phase 2 replaces the route body with: create `SyncRun` row, enqueue Inngest job, return `{ syncRunId }`. The `withShopifySession` wrapper stays.
- Phase 2 status endpoint `/api/shopify/sync/status` uses the same wrapper pattern.
- Phase 4 admin chat `/api/chat` route adopts the wrapper when it switches from public to session-token auth.
