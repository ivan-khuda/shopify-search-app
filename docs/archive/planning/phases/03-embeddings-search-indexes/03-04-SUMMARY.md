---
phase: 03-embeddings-search-indexes
plan: 04
subsystem: embeddings
tags: [embeddings, ai-gateway, vercel, pgvector, tdd]
requires: ["03-01", "03-02"]
provides: ["EmbeddingService (embed, embedBatch, embedAndStore, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS)"]
affects:
  - services/embeddings/EmbeddingService.ts
  - services/embeddings/__tests__/EmbeddingService.test.ts
tech_stack:
  added: []
  patterns:
    - "AI Gateway sole-entry-point pattern (no direct OpenAI/provider SDKs)"
    - "Discriminated batch result { ok, failed } — caller distinguishes total vs partial failure without try/catch"
    - "Raw-SQL ON CONFLICT upsert with ::vector cast (idempotent re-embedding)"
    - "vi.hoisted + functional vi.mock factory (mirrors ShopifyProductService.test.ts)"
key_files:
  created:
    - services/embeddings/EmbeddingService.ts
  modified:
    - services/embeddings/__tests__/EmbeddingService.test.ts
decisions:
  - "EMBEDDING_MODEL pinned as 'openai/text-embedding-3-small' as const — never substituted by gateway routing telemetry (EMB-03)"
  - "Vector cast uses ::vector only — inner-product distance operator deliberately avoided because text-embedding-3-small output is not pre-normalised; cosine distance is Phase 4's concern"
  - "embedBatch catch block stores err.message string only — never the full err object (T-3-02 mitigation against AI_GATEWAY_API_KEY/Authorization leakage into SyncRun.errors[])"
  - "Empty-array short-circuit added to embedBatch — zero-cost guard avoids accidental empty-batch round-trips to the gateway"
  - "Local function `embed` shadows imported `embed` from `ai`; import aliased as `embedSdk` per plan D-09"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  tests_added: 9
  tests_passing: 9
  module_lines: 120
  completed_date: 2026-05-25
---

# Phase 03 Plan 04: EmbeddingService Summary

**One-liner:** Vercel AI Gateway adapter (`openai/text-embedding-3-small`) exposing `embed`, `embedBatch`, and `embedAndStore` with a pinned `modelVersion`, an ON CONFLICT idempotent upsert, and a discriminated partial-failure shape — proven by 9 mocked unit tests.

## What Was Built

A single service module (`services/embeddings/EmbeddingService.ts`, 120 lines) plus a converted test file (9 passing tests; zero `it.todo` remaining).

### Exports

| Export                  | Kind                  | Purpose                                                                                     |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `EMBEDDING_MODEL`       | `as const` string     | Pinned gateway routing literal `'openai/text-embedding-3-small'` — EMB-03 modelVersion source |
| `EMBEDDING_DIMENSIONS`  | `as const` number     | `1536` — guard value for `embed()` post-call assertion                                       |
| `EmbedBatchResult`      | interface             | Discriminated `{ ok: [{index, vector}], failed: [{index, message}] }`                       |
| `embed(text)`           | async fn              | Single-text vector via `ai.embed` with dimension-mismatch guard                              |
| `embedBatch(texts)`     | async fn              | Bulk vectorisation via `ai.embedMany` with `{ok, failed}` partial-failure shape              |
| `embedAndStore(...)`    | async fn              | `embed()` then raw-SQL ON CONFLICT upsert into `product_embeddings`                          |

### EMB-03 Proof (modelVersion pinning)

The exact assertion in `EmbeddingService.test.ts` that proves the pinned constant lands in the `modelVersion` column verbatim:

```typescript
const call = executeRawMock.mock.calls[0];
const values = call.slice(1);
expect(values).toContain('openai/text-embedding-3-small');
```

This works because `prisma.$executeRaw` is a tagged template — its mock receives `(strings, ...values)`, so `call.slice(1)` is precisely the values array that PostgreSQL will parameter-substitute into the SQL. The presence of the literal string `'openai/text-embedding-3-small'` inside that array is direct evidence that the value bound to the `"modelVersion"` placeholder originates from `EMBEDDING_MODEL` — no aliasing, no gateway routing telemetry.

### EMB-02 Proof (partial-failure discriminated result)

`embedBatch` on full-batch failure returns one `failed` entry per input:

```typescript
const result = await embedBatch(['a', 'b']);
expect(result.ok).toEqual([]);
expect(result.failed).toHaveLength(2);
expect(result.failed[0]).toEqual({ index: 0, message: 'rate limit hit' });
```

Callers (plan 03-06 sync, plan 03-07 webhook) can distinguish total vs partial failure by inspecting `ok.length` and `failed.length` separately.

### T-3-02 Proof (no error-object leakage)

A `LeakyError` subclass carrying `config.headers.Authorization` and a fake bearer token is rejected from `embedMany`. The test then asserts:

```typescript
expect(JSON.stringify(entry)).not.toContain('SECRET-AI-GATEWAY-KEY');
expect(JSON.stringify(entry)).not.toContain('Authorization');
expect(Object.keys(entry).sort()).toEqual(['index', 'message']);
```

The `failed[i]` object has exactly two keys; the Authorization header never escapes the catch block.

## Tasks Completed

| # | Task                                                            | Commit    |
| - | --------------------------------------------------------------- | --------- |
| 1 | Implement EmbeddingService.ts (embed/embedBatch/embedAndStore + constants) | `b2ec26c` |
| 2 | Convert EmbeddingService.test.ts `it.todo` to real assertions   | `b14526b` |

## Verification Results

- `bunx vitest run services/embeddings/__tests__/EmbeddingService.test.ts` → **9 passed, 0 failed, 0 todos** (plan required ≥8)
- `grep "providerMetadata" services/embeddings/EmbeddingService.ts` → empty (exit 1) — no gateway routing string used as modelVersion
- `grep "<#>" services/embeddings/EmbeddingService.ts` → empty (exit 1) — inner-product distance operator absent
- `grep -E "(api_key|API_KEY|Bearer|token)" services/embeddings/EmbeddingService.ts | grep -v "AI_GATEWAY_API_KEY"` → empty (exit 1) — no secrets in source
- `bunx tsc --noEmit` → no new errors introduced by this plan (pre-existing errors in `app/(embedded)/onboarding/page.tsx`, `lib/db/*`, `prisma/seed.ts`, etc. are out of scope per Phase 3 boundary)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] JSDoc wording adjusted to satisfy verification greps**

- **Found during:** post-Task-2 verification step
- **Issue:** The plan's verification commands `grep "providerMetadata"` and `grep "<#>"` are unconditional — they don't distinguish "use" from "warning comment". My initial JSDoc cited both tokens by name in anti-pattern warnings (e.g., "Never use the gateway routing string (providerMetadata.gateway.routing)") which tripped the literal grep.
- **Fix:** Rewrote the two affected JSDoc blocks to describe the anti-patterns without naming the literal tokens — meaning preserved, grep now clean. The behavioural contract is unchanged; only documentation phrasing shifted.
- **Files modified:** `services/embeddings/EmbeddingService.ts` (JSDoc only)
- **Commit:** `b14526b` (folded into Task 2 commit since it's a doc-only adjacent edit)

No other deviations. Plan executed as written.

## Authentication Gates

None. AI Gateway authentication is purely environment-driven (`AI_GATEWAY_API_KEY`), and no live network call was made — all tests use vi.mock.

## Known Stubs

None.

## Threat Flags

None — no new trust-boundary surface beyond what the plan's `<threat_model>` already enumerates. All mitigations (T-3-01 shop scoping, T-3-02 err.message extraction, T-3-03 env-only auth, T-3-V13-AI const-pinned modelVersion) are implemented and proven by tests.

## TDD Gate Compliance

This plan's tasks carry `tdd="true"` but operate on a *pre-existing* RED scaffold (created by plan 03-01) rather than producing fresh RED commits. The gate sequence here is:

1. RED commit: `7e0fd... docs(03-01): ...` (plan 03-01 wrote the `it.todo` scaffold with `vi.mock` setup — file was `1 skipped`, `8 todo` in vitest before this plan)
2. GREEN commit: `b2ec26c feat(03-04): implement EmbeddingService with AI Gateway adapter` (service implementation makes the scaffold importable; todos still pass as todos)
3. GREEN commit: `b14526b test(03-04): convert EmbeddingService it.todo entries into real assertions` (converts 8 todos to 9 real assertions, all passing)

No REFACTOR commit because the implementation was correct on first write and no cleanup was warranted. The plan-level type is `execute` (not `tdd`), so plan-level RED/GREEN/REFACTOR sequencing does not apply.

## Self-Check: PASSED

- `services/embeddings/EmbeddingService.ts` → FOUND (120 lines)
- `services/embeddings/__tests__/EmbeddingService.test.ts` → FOUND (modified, 9 tests passing)
- Commit `b2ec26c` → FOUND in `git log`
- Commit `b14526b` → FOUND in `git log`
- All 5 named exports present in module (`embed`, `embedBatch`, `embedAndStore`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`)
- All 4 plan verification grep checks return empty (exit 1)
- All 9 vitest assertions pass with 0 todos remaining
