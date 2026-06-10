# Plan 02-07 Summary

**Status:** complete
**Wave:** 5
**Requirements:** SYN-05, SYN-08

## What shipped

`app/api/shopify/sync/route.ts` rewritten from the Phase 1 placeholder (`return NextResponse.json({success: true})`) to the real Phase 2 orchestrator:

1. Compute idempotency key per D-05: `createHash('sha256').update(`${shop}|${Math.floor(Date.now() / 300_000)}`).digest('hex')` — 5-minute bucket
2. `prisma.syncRun.findFirst({ where: { shop, idempotencyKey } })` — also filters by shop as defence-in-depth against the (theoretical) sha256 collision
3. If existing row, return `{ syncRunId: existing.id }` — no second Inngest job fired (D-05 idempotency)
4. Otherwise `prisma.syncRun.create({ data: { shop, idempotencyKey, state: 'queued', processedCount: 0 } })`
5. `inngest.send({ name: 'shopify/product.sync', data: { syncRunId: run.id, shop } })` — payload contains ONLY syncRunId + shop (T-2-leak: no access token)
6. Return `{ syncRunId: run.id }`

Total handler body: ~25 lines (well under the <30 cap).

## Verification

- `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` → 9/9 GREEN, including:
  - Phase 1's 5 auth-error cases (missing_token, invalid_token, invalid_dest, invalid_shop_domain, no_offline_session) preserved
  - Phase 1's happy-path test updated to expect `{ syncRunId }` shape (was `{ success: true }`)
  - Phase 2's 3 new cases: idempotency dedup; new-run path with correct `inngest.send` call; event-payload-no-leak (Object.keys === ['shop', 'syncRunId'])
- `bunx tsc --noEmit` clean for Phase 2 surface
- grep gates: 1× `createHash('sha256')`, 1× `Math.floor(Date.now() / 300_000)`, 1× `prisma.syncRun.findFirst`, 1× `prisma.syncRun.create`, 1× `inngest.send`, 1× `'shopify/product.sync'`, 0× `console.log` in non-comment lines

## Notes

- `findFirst` over `findUnique` because the where-clause filters by both `shop` and `idempotencyKey` (idempotencyKey is unique-indexed but Prisma 7's findUnique requires the exact-key arg without additional fields). `findFirst` with both columns is the safe shape.
- Latency contract (SYN-05 < 2s): the handler does at most 1 `withShopifySession` session reload + 1 Prisma `findFirst` + (optionally) 1 Prisma `create` + 1 Inngest `send`. All are < 200ms each on local Postgres + Inngest dev. The contract is structural, not asserted with timers (real-time latency is hard to test deterministically).
- Idempotency window edge case: if a sync STARTS in minute 4:59 and the user clicks again at 5:00, the new bucket fires a SECOND run. This is acceptable per D-05 — the merchant expects a fresh sync after the 5-min boundary; the previous run's terminal state is preserved separately in the older SyncRun row.

## Handoff

- Plan 02-10's onboarding component receives `{ syncRunId }` from this POST and uses it for the `/status?syncRunId=...` polling URL
- The actual sync work happens in the Inngest function (Plan 02-06) which this route fires the event for
- Monitoring: every successful POST writes a row to `sync_runs` table — production audit trail comes for free
