# Plan 02-08 Summary

**Status:** complete
**Wave:** 3
**Requirements:** SYN-07

## What shipped

`app/api/shopify/sync/status/route.ts` (28 lines):

- `export const GET = withShopifySession(async ({ shop, session, req }) => { ... })` — single-line wrapper invocation reusing Phase 1's auth pattern (D-09)
- Parses `syncRunId` from `?syncRunId=` query
- Returns 400 `missing_sync_run_id` if absent, 404 `sync_run_not_found` if row missing, 403 `wrong_shop` if row's shop ≠ session shop (T-2-iso cross-shop guard)
- 200 response projects only `{state, processedCount, totalCount, errors, startedAt, finishedAt}` — never includes `cursor`, `idempotencyKey`, or `id` (id is already known to the client from POST response)

`app/api/shopify/sync/status/__tests__/route.test.ts` rewritten from the Wave 0 RED stubs into 5 real assertions:
- 400 missing_sync_run_id ✓
- 404 sync_run_not_found ✓
- **403 wrong_shop** — explicitly verifies T-2-iso isolation (session for shop A cannot read sync_runs row owned by shop B)
- 200 with correct projection (asserts cursor/idempotencyKey ARE NOT in the response body)
- 401 invalid_token via withShopifySession decode failure

## Verification

- `bunx vitest run app/api/shopify/sync/status/__tests__/route.test.ts` → 5/5 GREEN
- File length 28 lines (< 40 cap)
- grep gates pass: 1× `withShopifySession`, 1× each of `missing_sync_run_id`/`sync_run_not_found`/`wrong_shop`, 1× `findUnique`, 0× `console.log`

## Notes

`findUnique` over `findFirst` because `id` is the primary key — O(1) indexed lookup. The 403-vs-404 split (load first, then check shop) is informative for V1; if a security review later demands cross-shop existence hiding, a single `findFirst({ where: { id: syncRunId, shop } })` returns 404 for both cases.

Polling perf cost (per D-09 + D-13): every 2s active polls trigger 2 DB queries (session reload + SyncRun lookup). Both are primary-key indexed. Acceptable at V1 scale; deferred fast-path `verifyToken` (Phase 1 deferred idea) lands if profiling demands.

## Handoff

- Plan 02-10's onboarding component polls this endpoint and consumes the projection shape exactly
- Plan 02-07 issues the syncRunId that this endpoint reads — both routes share the `prisma.syncRun` accessor
