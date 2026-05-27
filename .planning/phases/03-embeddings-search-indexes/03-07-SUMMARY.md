---
phase: 03-embeddings-search-indexes
plan: 07
subsystem: webhook-embedding-integration
tags: [embeddings, webhook, shopify, docs]
requirements: [EMB-01, EMB-03]
dependency_graph:
  requires:
    - 03-04 (EmbeddingService.embedAndStore)
    - 03-05 (searchableText.buildSearchableText)
  provides:
    - Real-time embedding refresh on products/create|update webhooks
    - Two-step migration workflow documentation in CLAUDE.md
  affects:
    - app/api/shopify/webhook/route.ts (products/create|update branch)
tech-stack:
  added: []
  patterns:
    - "Inline synchronous embedding inside webhook handler (D-02)"
    - "try/catch + console.error + 200 response on embed-only failure (Pitfall 3 mitigation)"
key-files:
  created:
    - .planning/phases/03-embeddings-search-indexes/03-07-SUMMARY.md
  modified:
    - app/api/shopify/webhook/route.ts (imports + inline embed call lines 145-153)
    - app/api/shopify/webhook/__tests__/route.test.ts (5 new Phase 3 tests replacing it.todo entries)
    - CLAUDE.md (1 Command line + 2 env-var entries + 1 Key Decision)
decisions:
  - "Inline synchronous embedAndStore inside the webhook handler — accepts ~300ms latency budget (well under Shopify 5s) for simpler architecture vs queue indirection"
  - "Embed failure does NOT propagate to Shopify (return 200) — prevents retry storm and unbounded embedding cost (Pitfall 3)"
  - "Mapped payload extracted to local before upsert + buildSearchableText to avoid recomputing mapping"
metrics:
  duration: "~10 min"
  completed: 2026-05-25
---

# Phase 03 Plan 07: Webhook Re-Embedding + Docs Summary

Wires `EmbeddingService.embedAndStore` into the existing Shopify webhook handler for `products/create | products/update`, converts the it.todo scaffolds from plan 03-01 into real assertions, and documents the new env vars + two-step migration workflow in CLAUDE.md.

## What Changed

### 1. `app/api/shopify/webhook/route.ts`

- **Added named imports** for `embedAndStore` (from `@/services/embeddings/EmbeddingService`) and `buildSearchableText` (from `@/services/search/searchableText`).
- **Inside the `products/create | products/update` branch** (after the stale-event guard, lines 145-153):
  - Extracted `const mapped = mapWebhookPayloadToUpsertInput(payload);` to a local.
  - Captured `const upserted = await productRepository.upsertProduct(shop, mapped);` so we can read the local `Product.id`.
  - Inserted comment `// Phase 3 / D-02 / EMB-01: synchronous re-embedding; log+200 on failure (Pitfall 3)`.
  - Wrapped `await embedAndStore(shop, upserted.id, buildSearchableText(mapped));` in `try/catch`. The catch logs `[webhook] embed failed for ${id} ${err}` via `console.error` and does NOT rethrow.
- **Unchanged:** HMAC validation, P2002 dedup, stale-event guard, topic dispatch, `products/delete` branch, the unknown-topic branch.

Exact insertion site: **lines 145-153** of the updated `route.ts`.

### 2. `app/api/shopify/webhook/__tests__/route.test.ts`

- The new `describe('embedding integration (Phase 3)')` block now contains **5 real `it(...)` tests** (zero `it.todo` remaining):
  1. `products/create webhook calls embedAndStore(shop, upserted.id, buildSearchableText(mapped)) after upsertProduct` — asserts the (shop, 42, 'mocked-text') tuple.
  2. `products/update webhook calls embedAndStore once, with the local Product.id (not Shopify GID)` — payload.id is 999999 but `upsertProductMock` returns `{ id: 42 }`; asserts the second arg is the integer 42, not 999999, and does not contain `gid://`.
  3. `products/delete webhook does NOT call embedAndStore` — assertion `embedAndStoreMock` not called.
  4. `webhook returns 200 even when embedAndStore throws` — `embedAndStoreMock.mockRejectedValueOnce(new Error('rate limit'))`; asserts status 200, `upsertProductMock` still called, `console.error` spy fired.
  5. `stale event (older updated_at than existing) returns 200 without calling embedAndStore` — stale guard path; asserts neither `upsertProductMock` nor `embedAndStoreMock` was called.
- A `beforeEach` in the new describe seeds `buildSearchableTextMock.mockReturnValue('mocked-text')` so assertions can match exactly on the third positional argument.

Test result: **12 / 12 passing** (7 Phase 2 baseline + 5 Phase 3 additions). Vitest run completes in ~1.2s.

### 3. `CLAUDE.md`

Three additions (total +4 lines, no unrelated sections altered):

- **Commands section** (Prisma block):
  ```
  bun db:indexes               # Apply manual pgvector + GIN indexes (REQUIRED after every `prisma migrate reset` — these indexes live outside Prisma's migration history)
  ```
- **Environment Variables section** (two new bullets):
  - `AI_GATEWAY_API_KEY` — Vercel AI Gateway key for embedding calls.
  - `DIRECT_URL` — Direct Postgres URL for `scripts/apply-manual-indexes.ts` when `DATABASE_URL` is Accelerate.
- **Key Design Decisions section** (one new bullet):
  - `ProductEmbedding.modelVersion` is a frozen pinned ID; future model upgrades require a code-level constant bump AND a backfill migration.

## Commits

| Task | Commit  | Description                                                   |
| ---- | ------- | ------------------------------------------------------------- |
| 1    | b4fb473 | feat(03-07): wire embedAndStore into webhook                  |
| 2    | a9b7665 | test(03-07): convert webhook it.todo entries to real tests    |
| 3    | b25e14a | docs(03-07): document AI_GATEWAY_API_KEY, DIRECT_URL, indexes |

## Verification

- `grep -q "from '@/services/embeddings/EmbeddingService'" app/api/shopify/webhook/route.ts` — PASS
- `grep -q "embedAndStore(shop, upserted.id" app/api/shopify/webhook/route.ts` — PASS
- `grep -q "console.error.*\[webhook\].*embed failed" app/api/shopify/webhook/route.ts` — PASS
- `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` — **12 passed, 0 failed**
- `grep -q "bun db:indexes" CLAUDE.md` — PASS
- `grep -q "AI_GATEWAY_API_KEY" CLAUDE.md` — PASS
- `grep -q "DIRECT_URL" CLAUDE.md` — PASS
- `grep -q "modelVersion" CLAUDE.md` — PASS
- All Phase 2 webhook tests still pass (7 baseline tests untouched).
- `bunx tsc --noEmit` shows only pre-existing project-wide errors (missing generated Prisma client, JSX-only module references in `components/ai-elements/reasoning.tsx`, onboarding `shopify` global) — no new errors in the webhook route or its test file.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed in plan order; verify commands matched plan expectations on first run.

## Threat Mitigations Applied

- **T-3-04 (Tampering / V13 API contract preservation):** Phase 3 inserted code only inside the upserted-success branch; HMAC validation, dedup table check, topic dispatch, and stale-event guard are untouched. Test #4 explicitly asserts response.status === 200 on embed failure.
- **T-3-V13-WEBHOOK (Shopify retry storm):** try/catch returns 200 even on embed failure, preventing Shopify from retrying an already-saved product. Test #4 proves this contract.
- **T-3-01 (Multi-tenancy):** `embedAndStore(shop, upserted.id, ...)` reuses the HMAC-verified `shop` variable from the same closure; cross-shop write is structurally impossible.
- **T-3-02 (Information disclosure):** `console.error` argument is the raw `err` object only — not persisted to DB, not returned in the HTTP response, never re-emitted to Shopify.

## Self-Check: PASSED

- `[ -f app/api/shopify/webhook/route.ts ]` — FOUND
- `[ -f app/api/shopify/webhook/__tests__/route.test.ts ]` — FOUND
- `[ -f CLAUDE.md ]` — FOUND
- Commit b4fb473 — FOUND in git log
- Commit a9b7665 — FOUND in git log
- Commit b25e14a — FOUND in git log
