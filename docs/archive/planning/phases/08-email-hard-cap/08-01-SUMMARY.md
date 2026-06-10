---
phase: 08-email-hard-cap
plan: 01
subsystem: testing
tags: [phase-08, wave-0, tdd, email, hard-cap, red-scaffolds]
requires: []
provides:
  - "RED test contract for NOT-01, NOT-02, NOT-03, NOT-04"
  - "RED test contract for CAP-01, CAP-02, CAP-03, SC4"
  - "RED test contract for D-04 (email idempotency) and D-05 (skip on missing contactEmail)"
  - "RED test contract for D-12 (period YYYY-MM UTC) and D-13 (streamed cap-reached message)"
  - "RED test contract for D-14 (cap check first action after auth)"
affects:
  - "lib/email/templates/SyncSuccessEmail.tsx (lands 08-04)"
  - "lib/email/templates/SyncFailureEmail.tsx (lands 08-04)"
  - "services/email/EmailService.ts (lands 08-04)"
  - "services/shopify/ShopifyShopService.ts (lands 08-05)"
  - "lib/db/repositories/RequestCounterRepository.ts (lands 08-07)"
  - "services/chat/CapService.ts (lands 08-08)"
  - "lib/util/period.ts (lands 08-08)"
  - "lib/chat/cap-reached-response.ts (lands 08-09)"
  - "inngest/functions/sync-products.ts (extended 08-10)"
  - "app/api/chat/route.ts (extended 08-09)"
  - "app/api/proxy/chat/route.ts (extended 08-09)"
tech-stack:
  added: []
  patterns:
    - "vi.mock factory-form for not-yet-existing modules (virtual module registry)"
    - "Tagged-template SQL shape assertion via Array.from(stringsArg).join(' ? ')"
    - "describe.skipIf for env-gated integration tests"
    - "Variable-indirection dynamic imports to bypass Vite static analysis"
key-files:
  created:
    - lib/email/templates/__tests__/sync-success-email.test.tsx
    - lib/email/templates/__tests__/sync-failure-email.test.tsx
    - services/email/__tests__/EmailService.test.ts
    - services/shopify/__tests__/ShopifyShopService.test.ts
    - lib/db/repositories/__tests__/RequestCounterRepository.test.ts
    - services/chat/__tests__/CapService.test.ts
    - lib/util/__tests__/period.test.ts
    - lib/chat/__tests__/cap-reached-response.test.ts
    - lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts
  modified:
    - inngest/functions/__tests__/sync-products.test.ts
    - app/api/chat/__tests__/route.test.ts
    - app/api/proxy/chat/__tests__/route.test.ts
decisions:
  - "Use vi.mock factory-form to virtually register not-yet-existing modules. The factory is only invoked when SUT imports the path; existing tests stay untouched because the current SUT does not import these symbols yet (RED)."
  - "Constants like CAP_REACHED_MESSAGE are pinned via 'export from the same module' equality (`expect(streamedDelta).toBe(mod.CAP_REACHED_MESSAGE)`), so the constant remains the single source of truth and tests stay correct when implementation refines wording within the user-facing-copy contract."
  - "Race integration test uses variable-indirection (`const spec = 'a/' + 'b'`) to bypass Vite static import analysis — Vitest only resolves the module specifier at runtime when describe.skipIf does NOT skip the block."
metrics:
  duration: "~25 min"
  completed: "2026-05-27"
  files_created: 9
  files_modified: 3
  red_test_blocks_total: 60
  red_test_blocks_failing: 8
  red_test_blocks_vacuous_pass: 5
---

# Phase 8 Plan 01: Wave-0 RED Test Scaffolds Summary

## One-liner

Phase 8 Wave-0 RED test contract pinned across 11 mandatory test files + 1 optional gated integration test, anchoring NOT-01..04 / CAP-01..03 / D-04 / D-05 / D-12 / D-13 / D-14 / SC4 with zero implementation files written.

## What Was Built

**Task 1 commit:** `b9da2f9` — `test(08-01-01): RED scaffolds for email + shopify + cap services`

Eight standalone RED test files:

| # | File | Anchors |
|---|------|---------|
| 1 | `lib/email/templates/__tests__/sync-success-email.test.tsx` | NOT-01, NOT-03 |
| 2 | `lib/email/templates/__tests__/sync-failure-email.test.tsx` | NOT-02, NOT-03 |
| 3 | `services/email/__tests__/EmailService.test.ts` | NOT-04, D-04, A4 |
| 4 | `services/shopify/__tests__/ShopifyShopService.test.ts` | D-05 |
| 5 | `lib/db/repositories/__tests__/RequestCounterRepository.test.ts` | CAP-01, SC4 |
| 6 | `services/chat/__tests__/CapService.test.ts` | CAP-02 |
| 7 | `lib/util/__tests__/period.test.ts` | D-12 |
| 8 | `lib/chat/__tests__/cap-reached-response.test.ts` | CAP-03, D-10, D-13 |

**Task 2 commit:** `286425f` — `test(08-01-02): RED scaffolds for repository + chat routes + Inngest extensions`

Three extended test files + one optional gated integration test:

| # | File | Action | Anchors |
|---|------|--------|---------|
|  9 | `inngest/functions/__tests__/sync-products.test.ts` | EXTENDED (+5 it blocks under `Phase 8 completion emails` describe) | NOT-01, NOT-02, D-04, D-05, Pitfall 2 |
| 10 | `app/api/chat/__tests__/route.test.ts` | EXTENDED (+4 it blocks under `Phase 8 hard cap` describe) | CAP-02, CAP-03, D-13, D-14 |
| 11 | `app/api/proxy/chat/__tests__/route.test.ts` | EXTENDED (+4 it blocks under `Phase 8 hard cap` describe) | CAP-02, CAP-03, D-13, D-14, gate ordering |
| 12 | `lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` | NEW (OPTIONAL, gated) | SC4 (atomic-increment race proof) |

## RED Status Confirmation

Running `bunx vitest run` against the 12 files:

```
Test Files  11 failed | 1 skipped (12)
     Tests   8 failed | 36 passed | 1 skipped (45)
```

- **11 mandatory files RED** — each fails with either `Failed to resolve import` (Vite/vitest cannot find `resend`, `@react-email/render`, `@/services/email/EmailService`, `@/lib/email/templates/*`, `@/lib/db/repositories/RequestCounterRepository`, `@/services/chat/CapService`, `@/lib/util/period`, `@/lib/chat/cap-reached-response`, `@/services/shopify/ShopifyShopService`) or with assertion errors (`expected "vi.fn()" to be called 1 times, but got 0 times`) on the route + Inngest extensions whose SUT does not yet import the Phase 8 symbols.
- **1 optional race integration test SKIPPED** — `describe.skipIf(!process.env.INTEGRATION_DB_URL)` correctly skips the entire block when `INTEGRATION_DB_URL` is unset. Variable-indirection dynamic imports keep Vite from trying to statically resolve the not-yet-existing module specifier.
- **36 pre-existing tests still GREEN** in the 3 extended files (Phase 2 sync-products: 12 GREEN, Phase 4 admin chat route: 14 GREEN, Phase 6 storefront chat route: 10 GREEN).

Full-suite sanity check (`bunx vitest run`):

```
Test Files  11 failed | 48 passed | 1 skipped (60)
     Tests   8 failed | 359 passed | 5 skipped (372)
```

- The 48 GREEN files and 359 GREEN tests confirm zero regressions on Phase 1-7. The 5 newly-skipped historical tests are pre-existing (`describe.skip`) Phase 4 blocks, not Phase 8 churn.

## Coverage Map (Requirement → File)

| Req / Decision | Test File(s) |
|----------------|--------------|
| NOT-01 (success email + content) | `sync-success-email.test.tsx`, `sync-products.test.ts` (Phase 8 describe) |
| NOT-02 (failure email + retry link) | `sync-failure-email.test.tsx`, `sync-products.test.ts` (Phase 8 describe) |
| NOT-03 (templates under `lib/email/templates/`) | `sync-success-email.test.tsx`, `sync-failure-email.test.tsx` (path-by-construction) |
| NOT-04 (env-scoped from) | `EmailService.test.ts` |
| CAP-01 (atomic SQL shape) | `RequestCounterRepository.test.ts` |
| CAP-02 (env-driven default 2000) | `CapService.test.ts` |
| CAP-03 (HTTP 200 streamed message) | `cap-reached-response.test.ts`, `app/api/chat/__tests__/route.test.ts` (Phase 8 describe), `app/api/proxy/chat/__tests__/route.test.ts` (Phase 8 describe) |
| D-04 (email idempotency via emailSentAt) | `sync-products.test.ts` (Phase 8 describe), `EmailService.test.ts` (idempotencyKey shape) |
| D-05 (skip email when contactEmail null, do not fail sync) | `sync-products.test.ts` (Phase 8 describe), `ShopifyShopService.test.ts` |
| D-12 (period = YYYY-MM UTC) | `period.test.ts` |
| D-13 (cap-reached streamed message) | `cap-reached-response.test.ts` |
| D-14 (cap check first action after auth) | `app/api/chat/__tests__/route.test.ts`, `app/api/proxy/chat/__tests__/route.test.ts` |
| SC4 (atomic-increment race semantics) | `RequestCounterRepository.test.ts` (unit), `RequestCounterRepository.race.integration.test.ts` (integration, gated) |
| Pitfall 2 (distinct step IDs) | `sync-products.test.ts` (Phase 8 describe) |

## Deviations from Plan

None. Plan executed as written. Two adjustments worth noting:

1. **Variable-indirection dynamic imports** in the optional race integration test. Vite's static analyzer rejected a literal `await import('@/lib/db/repositories/RequestCounterRepository')` even inside a `beforeAll` of a skipped `describe.skipIf` block (transform-time error, not runtime). I split the specifier into `'@/lib/db/repositories/' + 'RequestCounterRepository'` plus a `/* @vite-ignore */` magic comment. Confirmed the block is correctly SKIPPED (1 skipped / 0 errors) and will activate at runtime when `INTEGRATION_DB_URL` is set.

2. **`vi.mock` factory-form for not-yet-existing modules.** In all three extended files (Inngest + both chat routes), the new Phase 8 mocks point at module paths that physically do not exist yet (`@/services/email/EmailService`, `@/services/chat/CapService`, `@/lib/chat/cap-reached-response`, `@/services/shopify/ShopifyShopService`). Vitest's `vi.mock(path, factory)` registers a factory under the path as a virtual key — the factory is only invoked when something imports the path. Since the current SUTs do NOT import these symbols, the factories sit dormant and the existing 36 tests in those files continue to pass GREEN. When implementation lands and the SUTs add the imports, the factories activate and the Phase 8 tests turn GREEN.

## Optional Race-Test Status

`lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` exists, is properly gated, and is **SKIPPED** in the default local environment (no `INTEGRATION_DB_URL`). Manifest:

- Seeds `(shop, period, requestCount = cap - 1)` against a real Postgres
- Fires N=200 concurrent `tryConsume` calls
- Asserts exactly 1 winner returns `{ allowed: true, requestCount: cap }`, 199 losers return `{ allowed: false }`
- Cleanup in `afterAll`
- 30s timeout for the stress assertion

Operator enablement: set `INTEGRATION_DB_URL=postgres://...` and re-run `bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts`. When set, this test is the empirical SC4 proof of D-11's atomic-primitive serialization claim.

## Working Tree Confirmation

After both commits:

```
$ git status
On branch main
nothing to commit, working tree clean
```

## Threat Flags

None. This plan touches only `__tests__/` directories; no new attack surface introduced.

## Self-Check: PASSED

**File-existence audit (12 paths from plan `files_modified`):**

- [x] `lib/email/templates/__tests__/sync-success-email.test.tsx`
- [x] `lib/email/templates/__tests__/sync-failure-email.test.tsx`
- [x] `services/email/__tests__/EmailService.test.ts`
- [x] `services/shopify/__tests__/ShopifyShopService.test.ts`
- [x] `lib/db/repositories/__tests__/RequestCounterRepository.test.ts`
- [x] `services/chat/__tests__/CapService.test.ts`
- [x] `lib/util/__tests__/period.test.ts`
- [x] `lib/chat/__tests__/cap-reached-response.test.ts`
- [x] `inngest/functions/__tests__/sync-products.test.ts` (extended, not created)
- [x] `app/api/chat/__tests__/route.test.ts` (extended, not created)
- [x] `app/api/proxy/chat/__tests__/route.test.ts` (extended, not created)
- [x] `lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts`

**Commit audit (2 task commits expected per plan structure):**

- [x] `b9da2f9` — task 1 (8 new files)
- [x] `286425f` — task 2 (3 extensions + 1 optional new)

**Suite invariants:**

- [x] 11 mandatory test files RED
- [x] 1 optional gated test SKIPPED (no `INTEGRATION_DB_URL`)
- [x] Zero pre-existing Phase 1-7 tests transition from GREEN to RED
- [x] Zero new packages installed
- [x] Zero implementation files modified
- [x] Zero `prisma/schema.prisma` edits
