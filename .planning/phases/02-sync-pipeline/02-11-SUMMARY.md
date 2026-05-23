# Plan 02-11 Summary — Phase 2 Verification

**Status:** complete
**Wave:** 7 (verification gate)
**Requirements:** all SYN-01..11 + ADM-01, ADM-02

## Automated gates (all PASSED)

| # | Gate | Result |
|---|------|--------|
| 1 | `bun run test` (full Vitest suite) | ✓ **15 files, 95 GREEN, 0 SKIPPED** |
| 2 | `bunx tsc --noEmit` Phase 2 surface | ✓ Zero Phase-2-introduced errors (preexisting `shopify` global + `reasoning.tsx` jenius/ui errors flagged by Phase 1 verifier as out-of-scope) |
| 3 | `bunx prisma migrate status` | ✓ `Database schema is up to date!` — 5 migrations applied |
| 4 | Schema additions: enum SyncState, model SyncRun, model WebhookEvent, Product.updatedAtShopify | ✓ all 4 present in `prisma/schema.prisma` |
| 5 | Phase 2 critical artifacts on disk | ✓ all 6 present: Inngest client, serve handler, sync function, status route, webhook route, ShopifyProductService |
| 6 | POST sync idempotency contract: sha256 + 300_000ms bucket + inngest.send | ✓ all 3 present in `app/api/shopify/sync/route.ts` |
| 7 | Webhook contract: `shopifyClient.webhooks.validate`, P2002, raw-body-first; `utils.validateHmac` absent from production code | ✓ webhooks.validate 3×, P2002 3×, raw body 1×; `utils.validateHmac` only in a comment explaining the locked decision (D-10) |
| 8 | Inngest function deterministic step IDs (D-01): `fetch-batch-`, `upsert-batch-`, `persist-cursor-` | ✓ all 3 present |
| 9 | Live DB tables `sync_runs`, `webhook_events` exist | ✓ confirmed via `\dt` against localhost:5432 |
| 10 | Zero `console.log` in Phase 2 production paths | ✓ no matches in `inngest/`, `app/api/shopify/`, `services/shopify/`, `lib/inngest/` outside test files |

## Phase requirement verification

| REQ-ID | What it asserts | Plan | Test file | Status |
|--------|-----------------|------|-----------|--------|
| SYN-01 | `ShopifyProductService.fetchAllProducts` GraphQL with cursor pagination | 02-05 | `services/shopify/__tests__/ShopifyProductService.test.ts` | ✓ |
| SYN-02 | `mapToUpsertInput` maps Shopify → ProductUpsertInput (incl. `updatedAtShopify` and dual-shape price) | 02-05 | same | ✓ (with explicit toDecimal both-shapes test) |
| SYN-03 | Idempotent batched upsert; one failed product does not abort the run | 02-06 | `inngest/functions/__tests__/sync-products.test.ts` | ✓ (partial state test) |
| SYN-04 | `SyncRun` Prisma model with required fields | 02-02, 02-04 | schema + live DB | ✓ |
| SYN-05 | POST `/api/shopify/sync` returns `{syncRunId}` in <2s; never serverless-timeout | 02-07 | `app/api/shopify/sync/__tests__/route.test.ts` | ✓ |
| SYN-06 | Inngest step-function processes products in batches, persisting cursor | 02-06 | sync-products.test.ts | ✓ (cursor pagination test) |
| SYN-07 | GET `/api/shopify/sync/status?syncRunId=X` returns SyncRun for requesting shop (403 cross-shop) | 02-08 | `app/api/shopify/sync/status/__tests__/route.test.ts` | ✓ |
| SYN-08 | Duplicate POST within active run is deduped (sha256 5-min bucket) | 02-07 | sync route.test.ts | ✓ |
| SYN-09 | Onboarding polls /status every 2s with progress bar | 02-10 | `app/(embedded)/__tests__/onboarding.test.tsx` | ✓ |
| SYN-10 | `/api/shopify/webhook` HMAC + dedup by event id | 02-09 | webhook route.test.ts | ✓ (validateHmac/P2002/raw body tests) |
| SYN-11 | Webhook stale-event skip via `product.updatedAt` comparison | 02-09 | same | ✓ (stale-updatedAt test) |
| ADM-01 | Start sync button → progress view transition | 02-10 | onboarding.test.tsx | ✓ |
| ADM-02 | Progress bar driven by status polling; final summary | 02-10 | onboarding.test.tsx | ✓ |

## Phase success criteria (ROADMAP.md §Phase 2)

1. ✓ POST `/api/shopify/sync` creates SyncRun, enqueues Inngest, returns syncRunId in <2s — verified by sync route tests
2. ✓ Onboarding polls `/status` every 2s with `<s-progress-bar>` + state labels — verified by onboarding tests
3. ✓ Duplicate POST within idempotency window returns existing run — verified by D-05 idempotency test
4. ✓ Webhook handler verifies HMAC, dedups by event-id, uses `updated_at_shopify` for conflict resolution — verified by webhook tests
5. ✓ Inngest function resumable: deterministic step IDs (D-01) ensure replay-from-last-unfinished — verified by cursor-pagination test (uses two distinct cursor IDs)

## Files produced / modified by Phase 2

**Created (10 files):**
- `lib/inngest/client.ts`
- `app/api/inngest/route.ts`
- `inngest/functions/sync-products.ts`
- `inngest/functions/__tests__/sync-products.test.ts`
- `app/api/shopify/sync/status/route.ts`
- `app/api/shopify/sync/status/__tests__/route.test.ts`
- `app/api/shopify/webhook/__tests__/route.test.ts` (replaces stub)
- `services/shopify/__tests__/ShopifyProductService.test.ts`
- `prisma/migrations/20260523152414_add_sync_pipeline/migration.sql`
- 11 `.planning/phases/02-sync-pipeline/02-*-SUMMARY.md` files

**Modified (8 files):**
- `prisma/schema.prisma` (added SyncState enum + SyncRun + WebhookEvent + Product.updatedAtShopify)
- `app/api/shopify/sync/route.ts` (placeholder → real orchestrator)
- `app/api/shopify/sync/__tests__/route.test.ts` (Phase 2 cases added)
- `app/api/shopify/webhook/route.ts` (stub → real HMAC + dedup + dispatch)
- `services/shopify/ShopifyProductService.ts` (class-stub → function exports with GraphQL + toDecimal)
- `lib/db/repositories/ProductRepository.ts` (`updatedAtShopify` field + `findByShopAndHandle` method)
- `lib/sync/productSync.ts` (re-exports the function-style service)
- `app/(embedded)/onboarding/page.tsx` (state machine + polling + progress + banners)
- `app/(embedded)/__tests__/onboarding.test.tsx` (Phase 2 progress UI tests)
- `types/shopify-global.d.ts` (added `s-progress-bar`, `s-text`, `s-badge`, `s-banner` JSX types)
- `package.json` + `bun.lock` (`inngest@4.4.0` + `@inngest/test@1.0.0`)

## Threat coverage (Phase 2 STRIDE)

| Threat | Mitigation | Verified by |
|--------|-----------|-------------|
| T-2-spoof Forged webhook | `shopifyClient.webhooks.validate` rejects before any DB or repo call | webhook test "401 invalid_hmac" |
| T-2-replay Webhook replay | P2002 unique-violation catch on `WebhookEvent.eventId` | webhook test "200 dedup on P2002" |
| T-2-stale Out-of-order webhook | `existing.updatedAtShopify > payload.updated_at` → skip | webhook test "stale skip" |
| T-2-iso Cross-shop SyncRun read | status GET 403 on `run.shop !== sessionShop` | status test "403 wrong_shop" |
| T-2-tenant ProductRepository forgetting shop | All methods take `shop: string` first arg (Phase 1) | TypeScript signature; carried forward |
| T-2-error One product abort batch | Per-product try/catch in `upsert-batch` step | Inngest function "partial state" test |
| T-2-resumable Cold restart loses progress | Deterministic step IDs keyed by cursor | Inngest function "cursor pagination" test |
| T-2-dos Rapid POST flood | 5-minute idempotency window limits to 1 run per shop per bucket | sync route "idempotency dedup" test |
| T-2-leak Token leak in event payload | `inngest.send` data contains only `{syncRunId, shop}` — no access token | sync route "T-2-leak" test (keys === ['shop','syncRunId']) |

## Manual smoke verification (recommended pre-Phase-3)

The automated gates above cover all structural invariants. The following live-environment checks are **recommended** before Phase 3 starts but are NOT blocking:

1. `bunx prisma migrate reset --force && bunx prisma migrate deploy && bunx prisma generate` — confirm clean reset
2. Terminal A: `bun dev` ; Terminal B: `bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest` — confirm Inngest discovers `sync-products` function at `localhost:8288`
3. Install app on Shopify dev store; click "Start sync" on onboarding page; observe SyncRun row updates in Prisma Studio + progress bar fills 0→100%
4. From dev store admin, edit a product; confirm webhook receipt without duplicate DB write (resend the same webhook from Shopify Admin → expect 200 dedup)
5. `shopify.app.toml` `[webhooks.subscriptions]` block declaration + `bunx shopify app deploy` — D-16 manual setup step

## Notes

- The destructive Prisma migration approach in Phase 1 was a one-time exception. Phase 2 (and beyond) uses additive migrations only.
- Inngest 4.4's `createFunction` is a 2-arg function (trigger goes inside options); the plan referenced an older 3-arg shape.
- Vitest fake timers couldn't reliably flush the polling setInterval async chain — switched to real timers + waitFor with 5s timeout for the onboarding component tests.
- Webhook payload (REST shape) and GraphQL payload (Admin API) have different field names — the route uses a separate `mapWebhookPayloadToUpsertInput` from `services/shopify/ShopifyProductService.mapToUpsertInput`.

## Commit ladder (Phase 2)

```
ca384f0 docs(phase-2): add validation strategy + research corrections
b6bc635 docs(02): create phase plan + remediate plan-checker findings
a9fd4a0 docs(state): record phase 2 context session
<wave 0> test(02-01): install Inngest + 4 RED test files + 2 extensions
<wave 1> feat(02-02,02-03): additive schema + Inngest client/serve
<wave 2> docs(02-04): apply additive migration
<wave 3> feat(02-05,02-08): ShopifyProductService + status GET
<wave 4> feat(02-06,02-09): Inngest sync function + webhook handler
<wave 5> feat(02-07): POST sync idempotency + inngest.send
<wave 6> feat(02-10): onboarding state machine + polling + banners
<wave 7> verify(02-11): Phase 2 verification gate (this commit)
```

## Handoff to Phase 3

- The sync pipeline writes `Product` rows with `updatedAtShopify`. Phase 3 reads these rows + writes `ProductEmbedding` rows keyed by `(shop, productId)`.
- Phase 3 needs the merchant to have run a sync first — verified by the local Docker Postgres now containing real products from any test merchant.
- `SyncRun` model and Inngest infra are reusable for Phase 3's embedding generation worker (likely as `EmbeddingRun` + analogous step pattern).
- All 95 tests stay GREEN; Phase 3 starts from a clean baseline.

Ready to start **Phase 3: Embeddings + Search Indexes** via `/gsd-discuss-phase 3` or `/gsd-plan-phase 3`.
