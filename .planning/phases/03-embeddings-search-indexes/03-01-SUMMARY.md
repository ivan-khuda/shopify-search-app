---
phase: 03-embeddings-search-indexes
plan: 01
subsystem: embeddings/search/env
tags: [embeddings, search, vitest, env, red-scaffold, phase-3-wave-0]
dependency_graph:
  requires: []
  provides:
    - "RED scaffold for services/search/searchableText.ts (consumed by plan 03-02)"
    - "RED scaffold for lib/db/hnsw.ts (consumed by plan 03-03)"
    - "RED scaffold for services/embeddings/EmbeddingService.ts (consumed by plan 03-04)"
    - "Extended RED stubs for sync-products embed-batch step (consumed by plan 03-05)"
    - "Extended RED stubs for webhook embed-after-upsert (consumed by plan 03-06)"
    - "AI_GATEWAY_API_KEY + DIRECT_URL documented in .env.example (consumed by plan 03-04, 03-08)"
  affects:
    - "inngest/functions/__tests__/sync-products.test.ts (extended additively)"
    - "app/api/shopify/webhook/__tests__/route.test.ts (extended additively)"
    - ".gitignore (added negation for .env.example)"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted destructure pattern with functional vi.mock factory (Phase 2 PATTERNS.md)"
    - "it.todo as not-yet-implemented marker (vitest treats as skipped, not failure)"
    - ".env.example as committed template with empty KEY= entries (T-3-EVN-01 mitigation)"
key_files:
  created:
    - services/search/__tests__/searchableText.test.ts
    - lib/db/__tests__/hnsw.test.ts
    - services/embeddings/__tests__/EmbeddingService.test.ts
    - .env.example
  modified:
    - inngest/functions/__tests__/sync-products.test.ts
    - app/api/shopify/webhook/__tests__/route.test.ts
    - .gitignore
decisions:
  - "Created .env.example from scratch (didn't previously exist); included all required env vars from CLAUDE.md to make the template complete, all values empty per T-3-EVN-01"
  - "Added '!.env.example' negation to .gitignore — the existing '.env*' pattern blocked the committed template (Rule 3 fix)"
  - "Task 7 (human-verify checkpoint) deferred to orchestrator post-merge — worktree mode requires SUMMARY.md commit before return; checkpoint targets a precondition for future plans (03-04/03-08), not validation of this plan's output"
metrics:
  duration: "~5 minutes"
  completed_date: 2026-05-25
  tasks_completed: 6
  tasks_deferred_to_orchestrator: 1
  files_created: 4
  files_modified: 3
  commits: 6
requirements: [EMB-01, EMB-02, EMB-03, EMB-06]
---

# Phase 03 Plan 01: Wave 0 RED Scaffolds Summary

**One-liner:** Created RED test scaffolds with `vi.hoisted` mock blocks for `EmbeddingService`, `buildSearchableText`, and `withHnswIterativeScan`; extended sync + webhook test files with additive embed-step todos; added `.env.example` documenting `AI_GATEWAY_API_KEY` + `DIRECT_URL` so Wave 1 plans (03-02..03-07) can fill in real assertions immediately.

## Objective

Wave 0 of Phase 3 establishes the test scaffolding required by the Nyquist rule — every new code surface in Wave 1 must have an existing test file (with at least `it.todo` markers) before implementation. This plan creates those scaffolds + the `vi.hoisted` mock blocks for the canonical Phase 2 mock pattern (`ai`, `prisma`, `EmbeddingService`, `searchableText`).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | RED scaffold for `buildSearchableText` (6 it.todo entries — 5 required + 1 extra documenting label-ordering separately) | `31c038e` | `services/search/__tests__/searchableText.test.ts` |
| 2 | RED scaffold for `withHnswIterativeScan` (4 it.todo entries, vi.hoisted with `executeRawMock`+`transactionMock`, vi.mock of `@/lib/db/client`) | `3909799` | `lib/db/__tests__/hnsw.test.ts` |
| 3 | RED scaffold for `EmbeddingService` (8 it.todo entries across 3 nested describes, vi.mock of `ai` + `@/lib/db/client`, named imports of `EMBEDDING_MODEL`+`EMBEDDING_DIMENSIONS`) | `a2b831c` | `services/embeddings/__tests__/EmbeddingService.test.ts` |
| 4 | Extended `sync-products.test.ts` with embed-batch step describe (5 it.todo entries), additive mocks for `EmbeddingService` + `searchableText`, extended hoisted destructure | `b7cf4ba` | `inngest/functions/__tests__/sync-products.test.ts` |
| 5 | Extended webhook `route.test.ts` with embed-after-upsert describe (5 it.todo entries), additive mocks for `EmbeddingService` + `searchableText` | `52511e0` | `app/api/shopify/webhook/__tests__/route.test.ts` |
| 6 | Created `.env.example` (complete template, all empty values) + added `!.env.example` to `.gitignore` so the template is committable | `22f6fab` | `.env.example`, `.gitignore` |

**Total it.todo entries:** 6 + 4 + 8 + 5 + 5 = **28** (plan required ≥27; exceeded by 1 in Task 1).

**Total scaffold mocks created (vi.hoisted spy refs):**
- `searchableText.test.ts`: 0 (pure function — no mocks by design)
- `hnsw.test.ts`: 2 (`executeRawMock`, `transactionMock`)
- `EmbeddingService.test.ts`: 3 (`embedMock`, `embedManyMock`, `executeRawMock`)
- `sync-products.test.ts`: 4 new (`embedBatchMock`, `executeRawMock`, `productFindUniqueMock`, `buildSearchableTextMock`) — additive to existing 8
- `route.test.ts`: 2 new (`embedAndStoreMock`, `buildSearchableTextMock`) — additive to existing 6

## Verification

Ran:
```bash
bunx vitest run services/embeddings/__tests__/EmbeddingService.test.ts \
  services/search/__tests__/searchableText.test.ts \
  lib/db/__tests__/hnsw.test.ts \
  inngest/functions/__tests__/sync-products.test.ts \
  app/api/shopify/webhook/__tests__/route.test.ts
```

Result: `Test Files 2 passed | 3 skipped (5) — Tests 12 passed | 27 todo (39)`.

- The 2 passing test files are `sync-products.test.ts` (5 existing tests) and `route.test.ts` (7 existing tests) — confirming Phase 2 regression is zero.
- The 3 "skipped" test files are the brand-new scaffolds containing only `it.todo` entries (vitest skips files that have no executable specs).
- 27 todos counted by vitest; 28 in source (one is inside a comment line, not counted).

**Phase 2 regression check:** ✅ All 5 existing `sync-products` tests pass; all 7 existing `webhook/route` tests pass; mock additions are purely additive (extended hoisted destructure, added new vi.mock factories, no behavioural changes to existing mocks).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `.gitignore` `.env*` pattern blocked the new `.env.example` template**
- **Found during:** Task 6 commit attempt (`git add .env.example` was silently filtered by gitignore).
- **Issue:** The repo had `.env*` in `.gitignore` (line 34) with no negation, so the new template file could not be added.
- **Fix:** Added `!.env.example` on the next line. `.env` is still ignored (verified via `git check-ignore .env` returning 0); `.env.example` is now committable.
- **Files modified:** `.gitignore`.
- **Commit:** `22f6fab` (bundled with Task 6).

**2. [Rule 2 - Missing critical functionality] `.env.example` didn't exist at all**
- **Found during:** Task 6 read step.
- **Issue:** Plan task said "Append two lines to `.env.example`" presuming the file existed, but it didn't.
- **Fix:** Created the file from scratch, populated with all required env vars from `CLAUDE.md` (`GOOGLE_GENERATIVE_AI_API_KEY`, `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST`, `SHOPIFY_APP_HANDLE`, `NEXT_PUBLIC_SHOPIFY_API_KEY`) plus the two new Phase 3 vars (`AI_GATEWAY_API_KEY`, `DIRECT_URL`). All values left empty per T-3-EVN-01.
- **Files modified:** `.env.example` (created).
- **Commit:** `22f6fab`.

**3. [Note] Acceptance criterion `grep -q '^\.env$' .gitignore` does not literally match**
- **Issue:** The plan's acceptance criterion for Task 6 expects `.env` as an exact-line pattern. The repo uses the broader `.env*` (which also catches `.env.local`, `.env.production`, etc. — and was already in place before this plan).
- **Resolution:** I did **not** change the existing `.env*` pattern; the T-3-03 intent ("`.env` is git-ignored") is satisfied as verified by `git check-ignore -q .env` returning 0. Changing `.env*` to bare `.env` would *reduce* security by unprotecting `.env.local` etc.
- **Outcome:** Acceptance intent satisfied; literal grep would fail but the security boundary is stronger than the plan required.

### Deferred to Orchestrator

**Task 7 — `checkpoint:human-verify` (`AI_GATEWAY_API_KEY` in local `.env`)**

In worktree-parallel-executor mode, the executor MUST commit SUMMARY.md before returning (per `<parallel_execution>` instructions). The checkpoint targets a precondition for plans 03-04 (EmbeddingService GREEN implementation) and 03-08 (verification gate) — neither runs in this wave. The orchestrator owns presenting this checkpoint to the operator after merging Wave 0.

**Checkpoint payload (for orchestrator to surface):**

> **What was built:** Wave 0 RED scaffolds + `.env.example` template documenting `AI_GATEWAY_API_KEY` and `DIRECT_URL`. Plans 03-04 (EmbeddingService) and 03-08 (verification gate) depend on the developer having a real `AI_GATEWAY_API_KEY` in local `.env` — otherwise embedding calls throw.
>
> **How to verify:**
> 1. Open `.env` (NOT `.env.example`) in project root.
> 2. Confirm `AI_GATEWAY_API_KEY=<non-empty Vercel-issued value>` exists.
> 3. If missing: Vercel Dashboard → AI Gateway → Project keys → create/copy a key → paste into `.env`.
> 4. (Optional) `DIRECT_URL=postgresql://...` — only required when deploying via Prisma Accelerate.
> 5. Confirm `.env` is not staged: `git status` should NOT show `.env`.
> 6. Smoke test (optional): `bun -e "console.log(!!process.env.AI_GATEWAY_API_KEY)"` should print `true` after sourcing `.env`.
>
> **Resume signal:** Operator types "approved" once verified, or "blocked" if no Vercel AI Gateway key is obtainable.

## Authentication Gates

None encountered during execution.

## Known Stubs

This plan **intentionally** creates stubs — that's the point of Wave 0 RED scaffolds. All listed below are documented contracts to be filled by downstream plans:

| Stub | File | Line(s) | Resolved by |
|------|------|---------|-------------|
| `import { buildSearchableText } from '../searchableText'` — unresolved | `services/search/__tests__/searchableText.test.ts` | 13 | Plan 03-02 (creates `services/search/searchableText.ts`) |
| `import { withHnswIterativeScan } from '../hnsw'` — unresolved | `lib/db/__tests__/hnsw.test.ts` | 25 | Plan 03-03 (creates `lib/db/hnsw.ts`) |
| `import { embed, embedBatch, embedAndStore, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '../EmbeddingService'` — unresolved | `services/embeddings/__tests__/EmbeddingService.test.ts` | 32-38 | Plan 03-04 (creates `services/embeddings/EmbeddingService.ts`) |
| 27 × `it.todo(...)` entries across 5 test files | (all 5 test files) | various | Plans 03-02..03-06 will convert each to `it(...)` with real assertions |
| `AI_GATEWAY_API_KEY` blank in `.env.example` | `.env.example` | 24 | Plan 03-04 GREEN tests require the developer's local `.env` to have a real value (Task 7 checkpoint) |
| `DIRECT_URL` blank in `.env.example` | `.env.example` | 27 | Plan 03-08 verification gate requires the developer to set this when using Prisma Accelerate |

Each stub is **intentional** and documented above. No stubs flow into the runtime/UI surface; all are confined to test files + the env-var template.

## Threat Flags

No new security surfaces introduced beyond what the threat model already covers. Test files and `.env.example` (empty values) do not cross any trust boundary not already documented in PLAN.md §threat_model.

## Self-Check: PASSED

Verified before returning:

- **Files exist:**
  - `services/search/__tests__/searchableText.test.ts` — FOUND
  - `lib/db/__tests__/hnsw.test.ts` — FOUND
  - `services/embeddings/__tests__/EmbeddingService.test.ts` — FOUND
  - `.env.example` — FOUND (and git-tracked thanks to negation)
  - `inngest/functions/__tests__/sync-products.test.ts` — FOUND (modified)
  - `app/api/shopify/webhook/__tests__/route.test.ts` — FOUND (modified)
  - `.gitignore` — FOUND (modified)
- **Commits exist (`git log --oneline -6`):**
  - `22f6fab` chore(03-01): add .env.example with Phase 3 env vars — FOUND
  - `52511e0` test(03-01): extend webhook tests with embed-after-upsert RED stubs — FOUND
  - `b7cf4ba` test(03-01): extend sync-products tests with embed-batch RED stubs — FOUND
  - `a2b831c` test(03-01): add RED scaffold for EmbeddingService — FOUND
  - `3909799` test(03-01): add RED scaffold for withHnswIterativeScan — FOUND
  - `31c038e` test(03-01): add RED scaffold for buildSearchableText — FOUND
- **Acceptance criteria:**
  - Verify script for Task 1 (≥5 it.todo) ✅
  - Verify script for Task 2 (vi.hoisted + ≥4 it.todo) ✅
  - Verify script for Task 3 (`vi.mock('ai'`, ≥8 it.todo) ✅
  - Verify script for Task 4 (`embedBatchMock`, `vi.mock('@/services/embeddings/EmbeddingService'`) ✅
  - Verify script for Task 5 (`embedAndStoreMock` present) ✅
  - Verify script for Task 6 (`AI_GATEWAY_API_KEY=`, `DIRECT_URL=`) ✅
  - Phase 2 regression (existing 5 sync + 7 webhook tests) ✅ all pass
  - Final vitest run: `Test Files 2 passed | 3 skipped (5) — Tests 12 passed | 27 todo (39)` ✅
