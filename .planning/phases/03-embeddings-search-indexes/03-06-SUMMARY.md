---
phase: 03-embeddings-search-indexes
plan: 06
subsystem: sync-embeddings
tags: [embeddings, inngest, sync, batch, EMB-01, EMB-02, EMB-03]
requires:
  - 03-01  # scaffolded the it.todo entries + hoisted mocks (embedBatchMock, executeRawMock, productFindUniqueMock, buildSearchableTextMock)
  - 03-04  # EmbeddingService.embedBatch + EMBEDDING_MODEL constant
  - 03-05  # composite (shop, productShop, productId) unique on product_embeddings (ON CONFLICT target)
provides:
  - "4-step Inngest sync batch loop (fetch → upsert → embed → persist-cursor) with embed-batch step calling EmbeddingService.embedBatch"
  - "Workflow-level proof that EMB-01/EMB-02/EMB-03 hold at runtime (5 new tests in sync-products.test.ts)"
affects:
  - "Phase 4 SearchService: every successfully-upserted product now has a pgvector row with modelVersion pinned to EMBEDDING_MODEL"
  - "Phase 2 sync function: extended additively — onFailure handler, retries config, and finalize semantics unchanged"
tech_stack:
  added: []
  patterns:
    - "Inngest step.run with cursor-deterministic id (`embed-batch-${cursorKey}`) for memoization across Vercel cold starts"
    - "Discriminated `{ ok, failed }` batch result + index→source mapping for partial-failure recording"
    - "Raw SQL ON CONFLICT upsert with `::vector` cast inlined inside step (avoids extra repository round-trip)"
    - "Test mock defaults in beforeEach so existing tests pass when new dependencies are injected into shared code paths"
key_files:
  modified:
    - inngest/functions/sync-products.ts
    - inngest/functions/__tests__/sync-products.test.ts
decisions:
  - "Inline raw SQL upsert in the embed step body (not delegated to EmbeddingService.embedAndStore) — saves an extra prisma.product.findUnique that embedAndStore would have to do anyway; one lookup per product instead of two"
  - "Filter failed-upsert products by shopifyId set (not by reconstructing successful-product list) — O(1) lookup, matches the upsertErrors shape"
  - "Throw only when productsToEmbed.length > 0 && batchErrors.length === productsToEmbed.length — empty batch is a no-op, not a failure"
  - "Tag embed errors with `stage: 'embed'` at the persist-cursor push site (single source of error formatting in the function) rather than inside the embed step body"
metrics:
  duration: ~12 minutes
  completed: 2026-05-25
  tasks_completed: 2
  files_changed: 2
requirements_completed: [EMB-01, EMB-02, EMB-03]
---

# Phase 03 Plan 06: Embed step inside Inngest sync function Summary

One-liner: Injects an `embed-batch-${cursorKey}` step between Phase 2's `upsert-batch` and `persist-cursor` steps so every successfully-upserted product gets a pgvector embedding in the same Inngest workflow, with partial AI Gateway failures recorded but never aborting the sync.

## What Changed

### `inngest/functions/sync-products.ts` (modified — 68 insertions, 1 deletion)

Two import lines added at the top of the file:

```ts
import { embedBatch, EMBEDDING_MODEL } from '@/services/embeddings/EmbeddingService';
import { buildSearchableText } from '@/services/search/searchableText';
```

One new `step.run` call inserted between the existing `upsert-batch-${cursorKey}` step (now at file line 77) and the `persist-cursor-${cursorKey}` step (now at file line 163). The new step lives at lines **104–161**.

`step.run` call counts before vs after this plan:

| Step | Before | After | Position |
|------|--------|-------|----------|
| `mark-running` | line 49 | line 51 | unchanged |
| `fetch-total-count` | line 56 | line 58 | unchanged |
| `fetch-batch-${cursorKey}` | line 71 | line 73 | unchanged |
| `upsert-batch-${cursorKey}` | line 75 | line 77 | unchanged |
| **`embed-batch-${cursorKey}`** | — | **line 104** | **NEW** |
| `persist-cursor-${cursorKey}` | line 101 | line 163 | shifted (+62) |
| `finalize` | line 119 | line 186 | shifted (+67) |

Total `step.run` calls: **6 → 7** (one new step, as expected per the plan's verification check).

The persist-cursor step's `errors.push` payload was extended to merge upsert errors and embed errors:

```ts
errors: {
  push: [
    ...upsertErrors.map((e) => JSON.stringify(e)),
    ...embedErrors.map((e) => JSON.stringify({ ...e, stage: 'embed' })),
  ],
},
```

`processedCount` semantics are unchanged — products are counted as "processed" the moment their upsert succeeds, regardless of embed outcome. This matches D-08: a partial embed failure does NOT block sync progress or reduce the processed count.

The function's `retries: 3` config, `onFailure` handler, function `id`, and `finalize` step are unchanged. Phase 3 is strictly additive.

### `inngest/functions/__tests__/sync-products.test.ts` (modified — 207 insertions, 18 deletions)

The 5 `it.todo` entries from plan 03-01 are replaced with full assertions:

| # | Test name | Validates |
|---|-----------|-----------|
| 1 | calls EmbeddingService.embedBatch with searchableText for each upserted product | EMB-01 (every upserted product reaches embedBatch) |
| 2 | does NOT embed products whose upsert failed in the previous step | Failed-upsert filter is correct |
| 3 | partial embed failure pushes errors[] tagged stage:'embed' and run does not become 'failed' | EMB-02 (partial failure does not abort) |
| 4 | full-batch embed failure throws so Inngest retries | EMB-02 (full-batch failure triggers retry) |
| 5 | writes EMBEDDING_MODEL constant value into each raw SQL upsert | EMB-03 (modelVersion pinned) |

`beforeEach` was extended with sensible defaults for the new mocks (`embedBatchMock`, `buildSearchableTextMock`, `productFindUniqueMock`, `executeRawMock`) so existing Phase 2 tests pass without per-test mock setup. This is documented in the deviations section below.

Test result summary:

```
Test Files  1 passed (1)
     Tests  10 passed (10)
```

5 Phase 2 baseline tests + 5 new Phase 3 tests, zero regression.

## Verification

Plan-level verification commands (from PLAN §verification):

| Check | Result |
|-------|--------|
| `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | 10/10 green |
| `bunx tsc --noEmit` (new errors in sync-products.ts or its test) | none |
| `grep -c "step.run" inngest/functions/sync-products.ts` | 7 (was 6) |
| `grep "embed-batch-" inngest/functions/sync-products.ts` | matches |
| `grep "stage: 'embed'" inngest/functions/sync-products.ts` | matches |
| Phase 2 happy-path test still passes unchanged | yes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added embed-batch mock defaults to `beforeEach`**

- **Found during:** Task 2 (initial test run)
- **Issue:** Once the embed-batch step was added to `sync-products.ts`, every existing Phase 2 test broke because `embedBatchMock` returns `undefined` by default, and the new step does `const result = await embedBatch(texts)` followed by `result.ok` — which threw `TypeError: Cannot read properties of undefined (reading 'ok')` in every Phase 2 test.
- **Fix:** Added four safe default mocks to the existing `beforeEach`:
  - `embedBatchMock.mockImplementation(async (texts) => ({ ok: texts.map((_, index) => ({ index, vector: new Array(1536).fill(0) })), failed: [] }))`
  - `buildSearchableTextMock.mockImplementation((p) => `text-${p.handle}`)`
  - `productFindUniqueMock.mockResolvedValue({ id: 1 })`
  - `executeRawMock.mockResolvedValue(1)`
  This keeps the embed-batch step a no-op for Phase 2 tests unless a specific test overrides the mocks.
- **Files modified:** `inngest/functions/__tests__/sync-products.test.ts`
- **Commit:** `bd06f26`
- **Why Rule 3:** This was a blocking integration issue — the plan said "All existing Phase 2 tests still pass (zero regression)" but the embed-batch step's introduction directly broke them. Adding sensible test-side defaults is the smallest, safest fix that satisfies both the plan's regression guarantee and the new test contract.

### Authentication gates

None.

## Known Stubs

None. The embed step calls real Prisma helpers (`product.findUnique`, `$executeRaw`) and the real `embedBatch` / `buildSearchableText` exports from Phase 3 plans 03-04 and 03-02 respectively. Tests mock those collaborators but production code does not.

## Self-Check: PASSED

- `inngest/functions/sync-products.ts` — FOUND (modified, 7 step.run calls including new embed-batch)
- `inngest/functions/__tests__/sync-products.test.ts` — FOUND (modified, 10 it() blocks, zero it.todo())
- Task 1 commit `1e8488d` — FOUND in `git log`
- Task 2 commit `bd06f26` — FOUND in `git log`
- All 10 tests pass via `bunx vitest run inngest/functions/__tests__/sync-products.test.ts`
- No new `tsc --noEmit` errors in either file
