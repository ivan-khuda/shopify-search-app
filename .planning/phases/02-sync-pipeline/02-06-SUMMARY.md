# Plan 02-06 Summary

**Status:** complete
**Wave:** 4
**Requirements:** SYN-03, SYN-06

## What shipped

`inngest/functions/sync-products.ts` (~130 lines):

- `inngest.createFunction({ id: 'sync-products', triggers: [{event: 'shopify/product.sync'}], retries: 3, onFailure }, handler)` — Inngest 4.x 2-arg signature (triggers nested in options, not a separate positional arg)
- Loads offline session from Phase 1 sessionStorage; throws on missing → Inngest retries (transient OAuth gap)
- 3 steps per batch with deterministic IDs (D-01): `mark-running`, `fetch-total-count` (D-04), then loop of `fetch-batch-${cursor||'start'}`, `upsert-batch-${cursor||'start'}`, `persist-cursor-${cursor||'start'}`
- Per-product try/catch (D-15) — collects `UpsertError[]`; throws only on 100%-batch failure
- `finalize` step computes terminal state: `partial` if `errors.length > 0`, otherwise `succeeded`; writes `finishedAt`
- `onFailure` writes `state='failed'` + appends error to `errors[]` after Inngest retry exhaustion

`app/api/inngest/route.ts` — `functions: [syncProductsFunction]` (replaced the `TODO(02-06)` placeholder)

## Verification

- `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` → 5/5 GREEN via `InngestTestEngine.execute`:
  - single-batch processes + finalizes `succeeded`
  - 2-batch cursor pagination uses correct cursors `null` → `'cursor-after-1'`
  - state=`partial` when 1/2 products fail (D-15)
  - full-batch failure surfaces via `result.error` (Inngest's documented step-throw behavior — retries, not promise rejection)
  - state transitions queued→running→succeeded (D-03) and finishedAt is a Date
- `bunx tsc --noEmit` clean for Phase 2 surface

## Notes

- Inngest 4.x `createFunction` is a 2-arg function: `(options, handler)`. Trigger goes inside `options.triggers` as an array. The plan referenced the older 3-arg signature; the implementation uses the 4.4 shape.
- `InngestTestEngine` reports step throws via `result.error` (not promise rejection) — Inngest's documented behavior since step errors signal retries rather than terminal failures.
- `cursorKey` and `batch` required explicit type annotations (`string` and `FetchBatchResult`) — Inngest 4.x's step.run return-type inference produces inference cycles otherwise.
- BigInt literals (`123n`) require ES2020+ — tsconfig target is ES2017 — tests use `BigInt(123)` instead.

## Handoff

- Plan 02-07 fires the event via `inngest.send({ name: 'shopify/product.sync', data: { syncRunId, shop } })`
- Plan 02-10 polls /status; the state transitions and processedCount written by this function are what the UI renders
- Local dev: `bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest` discovers `sync-products` via serve handler
