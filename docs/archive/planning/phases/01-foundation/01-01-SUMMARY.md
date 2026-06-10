---
phase: 01-foundation
plan: "01"
subsystem: testing
tags: [tdd, red-tests, auth, repository, middleware, wave-0]
dependency_graph:
  requires: []
  provides:
    - lib/shopify/__tests__/auth.test.ts
    - lib/db/repositories/__tests__/ProductRepository.test.ts
    - __tests__/middleware.test.ts (updated)
  affects:
    - lib/shopify/auth.ts (Plan 02 turns auth.test.ts GREEN)
    - lib/db/repositories/ProductRepository.ts (Plan 06 turns ProductRepository.test.ts GREEN)
    - middleware.ts / proxy.ts (Plan 07 turns middleware.test.ts GREEN)
tech_stack:
  added: []
  patterns:
    - Vitest vi.mock hoisting before imports
    - $transaction mock wired to pass prisma mock as tx
    - it.each for parametric error-code coverage
key_files:
  created:
    - lib/shopify/__tests__/auth.test.ts
    - lib/db/repositories/__tests__/ProductRepository.test.ts
  modified:
    - __tests__/middleware.test.ts
decisions:
  - "Used vi.mock hoisting pattern from sync/route.test.ts for both new test files"
  - "Kept import from '../middleware' (Plan 07 will rename to '../proxy' per D-08)"
  - "decodeSessionToken removed from middleware mock — proxy reads ?shop= only (D-09)"
  - "it.each used for withShopifySession 5-error-code coverage — avoids 5 near-duplicate its"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-22T19:28:38Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 01 Plan 01: Wave 0 RED Test Scaffolds Summary

Wave 0 RED test scaffolds — three test files establishing the behavioral contracts for `lib/shopify/auth.ts`, `ProductRepository`, and updated middleware `?shop=`-only behavior. Tests fail intentionally until Plans 02, 06, and 07 land implementations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RED test file for lib/shopify/auth.ts | 2d7f496 | lib/shopify/__tests__/auth.test.ts (created, 220 lines) |
| 2 | Create RED test file for ProductRepository | 2366f87 | lib/db/repositories/__tests__/ProductRepository.test.ts (created, 211 lines) |
| 3 | Update __tests__/middleware.test.ts for ?shop= only | 630fa5c | __tests__/middleware.test.ts (modified, -23/+9 lines) |

## Files Created / Modified

### lib/shopify/__tests__/auth.test.ts (NEW — RED)

- **it() count:** 10
- **Error codes tested:** `missing_token` (2 cases: absent header + wrong prefix), `invalid_token`, `invalid_dest` (2 cases: missing dest + unparseable URL), `invalid_shop_domain`, `no_offline_session` (2 cases: undefined + null), plus happy path
- **D-06 compliance:** `invalid_dest` is a distinct code from `invalid_token` — tests assert the new split
- **withShopifySession coverage:** 1 handler-invoked test + `it.each` covering all 5 codes returning 401 + `{ error: code }` body
- **RED state:** Fails at collection with `Cannot find module '../auth'` — expected until Plan 02 creates `lib/shopify/auth.ts`

### lib/db/repositories/__tests__/ProductRepository.test.ts (NEW — RED)

- **it() count:** 11
- **Methods covered:** `findByShopAndId`, `listByShop` (3 variants: basic, status filter, limit/offset), `deleteProduct` (2: with/without shop assertion), `upsertProduct` (4: $transaction wrap, shop in upsert, productShop in child deleteMany, shop on every createMany row)
- **Cross-shop isolation test:** Calls `findByShopAndId('shop-a.myshopify.com', 1)` and `findByShopAndId('shop-b.myshopify.com', 1)` and asserts `where.shop` differs
- **$transaction mock:** Wired to `async (fn) => fn(prisma)` so transaction callback executes synchronously in tests
- **RED state:** Fails with `productRepository.findByShopAndId is not a function` (stub only has `upsert`) — expected until Plan 06 rewrites the repository

### __tests__/middleware.test.ts (MODIFIED — partial RED)

- **Bearer fallback tests deleted:** `'extracts shop from valid App Bridge Bearer token'` and `'redirects when Bearer token is invalid'` removed
- **decodeSessionToken removed:** Mock no longer includes `decodeSessionToken: vi.fn()` (D-09 — proxy reads `?shop=` only)
- **New test added:** `'redirects to /api/auth without shop param when shop query is missing'` — asserts `status === 307`, Location contains `/api/auth`, Location does NOT include `shop=`
- **TODO comment added:** `// TODO(Plan 07): update to import { proxy } from '../proxy' after Next.js 16 migration (D-08).`
- **Current state:** 4 tests PASS against current middleware (which still has Bearer fallback) — tests will partially go RED when Plan 07 removes Bearer fallback and renames to proxy.ts

## Test Count Summary

| File | it() blocks | RED until |
|------|------------|-----------|
| lib/shopify/__tests__/auth.test.ts | 10 | Plan 02 |
| lib/db/repositories/__tests__/ProductRepository.test.ts | 11 | Plan 06 |
| __tests__/middleware.test.ts | 4 | Plan 07 (import flip) |

## Next-Plan Handoffs

- **Plan 02** (Create `lib/shopify/auth.ts`): Must export `verifyShopSessionToken`, `withShopifySession`, `ShopifyAuthError`, `ShopifyAuthErrorCode` — imports in `auth.test.ts` will resolve and all 10 tests must turn GREEN
- **Plan 06** (Rewrite `ProductRepository`): Must implement `upsertProduct(shop, input)`, `findByShopAndId(shop, id)`, `listByShop(shop, opts?)`, `deleteProduct(shop, id)` — all 11 `ProductRepository.test.ts` tests must turn GREEN
- **Plan 07** (middleware → proxy migration): Must rename export and update test import from `'../middleware'` to `'../proxy'`; the `'redirects to /api/auth without shop param'` test will then GREEN with the rewritten proxy that removes Bearer fallback

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

- **T-1-03 (Information Disclosure — test fixtures):** Test fixtures use only placeholder strings (`'broken'`, `'good'`, `'valid.jwt.token'`, `'shpat_xxx'`) — no real tokens. No assertion logs token contents.
- **T-1-06 (Spoofing — shop param in middleware tests):** Tests assert middleware MUST require `?shop=` and MUST verify by loading offline session. New test explicitly asserts Location does NOT include `shop=` when no shop param provided.

## Known Stubs

None in this plan — this plan creates test files only, no source implementations.

## Self-Check

Files exist:
- `lib/shopify/__tests__/auth.test.ts` FOUND
- `lib/db/repositories/__tests__/ProductRepository.test.ts` FOUND
- `__tests__/middleware.test.ts` FOUND (modified)

Commits exist:
- `2d7f496` FOUND (auth.test.ts)
- `2366f87` FOUND (ProductRepository.test.ts)
- `630fa5c` FOUND (middleware.test.ts update)
