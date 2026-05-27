---
phase: 03-embeddings-search-indexes
plan: 03
subsystem: embeddings
tags: [embeddings, pgvector, prisma, hnsw, EMB-06]
requires:
  - 03-01  # provided the it.todo scaffold + vi.hoisted mock pattern
provides:
  - "withHnswIterativeScan helper — EMB-06 contract surface for Phase 4 SearchService"
affects:
  - "Phase 4 SearchService (Plan 04-xx) will wrap every shop-scoped pgvector query in this helper"
tech_stack:
  added: []
  patterns:
    - "Prisma $transaction callback form (NEVER array form) for transaction-scoped SET LOCAL"
    - "vi.hoisted + vi.mock pattern for prisma module mocking"
key_files:
  created:
    - lib/db/hnsw.ts
  modified:
    - lib/db/__tests__/hnsw.test.ts
decisions:
  - "Helper is shop-AGNOSTIC: multi-tenant filtering is the caller's responsibility (T-3-01)"
  - "Reused vi.hoisted mock pattern from ProductRepository.test.ts — established pattern"
metrics:
  duration: ~10 minutes
  completed: 2026-05-25
  tasks_completed: 2
  files_changed: 2
requirements_completed: [EMB-06]
---

# Phase 03 Plan 03: HNSW Iterative-Scan Helper Summary

`withHnswIterativeScan(callback)` helper landed at `lib/db/hnsw.ts` — wraps `prisma.$transaction` in the CALLBACK form and issues `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` as the first statement, structurally preventing Pitfall 1 (array-form drift).

## What Was Built

### Helper (`lib/db/hnsw.ts`) — 27 lines

```typescript
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
```

Imports:
- `import type { Prisma } from '@/app/generated/prisma/client'`
- `import { prisma } from '@/lib/db/client'`

JSDoc block (lines 4–19) documents:
1. Why the helper exists (Pitfall 1 — array-form `$transaction([...])` breaks `SET LOCAL` because it doesn't guarantee a single connection envelope).
2. Accelerate-pooler semantics (`SET LOCAL` lives only until COMMIT — exactly what we want).
3. The CALLBACK form is enforced by the helper's API; the array form cannot be expressed through it.
4. Multi-tenant note (T-3-01): helper is shop-agnostic — callers must enforce `WHERE shop = $1` themselves.

The phrase **"CALLBACK form ... NEVER the array form"** appears verbatim in the JSDoc.

### Test file (`lib/db/__tests__/hnsw.test.ts`) — 5 passing assertions

All 4 `it.todo` scaffolds converted to real `it()` assertions + 1 defensive test added (5 total):

| # | Assertion | Mechanism |
|---|-----------|-----------|
| 1 | `prisma.$transaction` invoked once, first arg is `Function` (callback form, not array) | `expect(transactionMock.mock.calls[0][0]).toBeInstanceOf(Function)` |
| 2 | First statement inside tx is `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` | `expect(executeRawMock.mock.calls[0][0].join('')).toBe(...)` on the TemplateStringsArray |
| 3 | User callback runs AFTER `$executeRaw` | `expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(userCb.mock.invocationCallOrder[0])` |
| 4 | User callback return value flows through | `expect(await withHnswIterativeScan(() => 'hello')).toBe('hello')` |
| 5 (defensive) | Callback receives `tx` with the same `$executeRaw` (proves tx propagation) | `expect(txArg.$executeRaw).toBe(executeRawMock)` |

**Ordering-assertion mechanism:** vitest's `vi.fn().mock.invocationCallOrder` — a strictly monotonic counter that increments globally across all spies. The strict-`<` comparison proves `$executeRaw` was invoked before the user callback, not merely "in the same async tick".

## Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 | `1893ddc` | feat | add withHnswIterativeScan helper |
| 2 | `681bd2b` | test | convert hnsw.test.ts it.todo to real assertions |

## Verification

| Check | Result |
|-------|--------|
| `bunx vitest run lib/db/__tests__/hnsw.test.ts` | 5 passed, 0 failed, 0 todo |
| `bunx tsc --noEmit` (errors specific to `lib/db/hnsw.ts`) | None |
| `grep -n '\$transaction(\[' lib/db/hnsw.ts` (code, not JSDoc) | None — only documentation reference in JSDoc |
| JSDoc mentions "callback form" | Present at line 8 ("CALLBACK form ... NEVER the array form") |
| `it.todo` count remaining | 0 |
| `it(...)` count | 5 (≥ 4 required) |

## Acceptance Criteria

### Task 1 (helper) — all satisfied

- [x] `lib/db/hnsw.ts` exists, 27 lines (≤30)
- [x] Imports `prisma` from `@/lib/db/client` and `type { Prisma }` from `@/app/generated/prisma/client`
- [x] Exports `withHnswIterativeScan` as a named function with generic `<T>` and `Prisma.TransactionClient` callback param
- [x] JSDoc references "callback form" and warns against the array form
- [x] Contains literal `SET LOCAL hnsw.iterative_scan = 'relaxed_order'`
- [x] `bunx tsc --noEmit` reports no NEW errors in `lib/db/hnsw.ts`

### Task 2 (tests) — all satisfied

- [x] Zero `it.todo` remaining
- [x] 5 `it(...)` calls, all passing (≥4 required)
- [x] Test 1 asserts first `$transaction` arg is `Function` (proves callback form)
- [x] Test 2 asserts SET LOCAL via template-strings join
- [x] Test 3 asserts ordering via `mock.invocationCallOrder`
- [x] Test 4 asserts return-value flow-through
- [x] `bunx vitest run lib/db/__tests__/hnsw.test.ts` exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Prisma client not generated in worktree**
- **Found during:** Task 1 type-check
- **Issue:** `bunx tsc --noEmit` reported `Cannot find module '@/app/generated/prisma/client'` — the generated client directory `app/generated/prisma/` did not exist in the worktree (pre-existing condition shared by `lib/db/client.ts` and `lib/db/repositories/ProductRepository.ts`).
- **Fix:** Ran `bunx prisma generate` to materialize the client. No schema changes; this is the standard regeneration step documented in CLAUDE.md.
- **Files modified:** None tracked (generated client is gitignored via `app/generated/`).
- **Commit:** N/A — generated artifacts only.

**2. [Plan-defined enhancement] Added a 5th defensive test**
- **Found during:** Task 2 acceptance review.
- **Issue/Reason:** The plan's `<action>` mentioned a 5th defensive test (`expect(transactionMock.mock.calls[0][0]).toBeInstanceOf(Function)`). I rolled that defensive assertion into Test 1 (where it logically belongs) and added a different 5th test asserting the user callback receives the tx-scoped `$executeRaw` (proves tx propagation, which the plan's behaviour list implies but doesn't explicitly assert).
- **Files modified:** `lib/db/__tests__/hnsw.test.ts`
- **Commit:** `681bd2b`

No bugs introduced and no architectural changes. No authentication gates encountered.

## Threat-Model Coverage

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-3-01 (cross-tenant via callback) | accept (defer to caller) | JSDoc documents the contract — caller responsibility |
| T-3-V13-HNSW (silent index bypass via array form) | mitigate | Helper API structurally prevents array form; JSDoc warns future maintainers |

No new threat surface introduced — helper is a thin transactional wrapper with no I/O of its own.

## Known Stubs

None. The helper is feature-complete; the real-Postgres GUC verification (asserting Postgres actually honours the SET LOCAL when an HNSW query runs) is deferred to plan 03-08 (verification gate) as the plan explicitly notes.

## Self-Check: PASSED

- `lib/db/hnsw.ts` — FOUND
- `lib/db/__tests__/hnsw.test.ts` — FOUND (modified)
- Commit `1893ddc` — FOUND in `git log`
- Commit `681bd2b` — FOUND in `git log`
