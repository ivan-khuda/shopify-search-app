---
phase: 07-admin-settings-model-picker
plan: 05
subsystem: database
tags: [prisma, repository, multi-tenancy, shop-settings, postgres]

# Dependency graph
requires:
  - phase: 07-admin-settings-model-picker
    provides: "Plan 01 Wave-0 RED test (ShopSettingsRepository.test.ts); Plan 03 Prisma migration adding `shop_settings` table + generated `ShopSettings` type"
provides:
  - "ShopSettingsRepository class with get(shop) + upsert(shop, activeChatModelId)"
  - "shopSettingsRepository singleton — primary import surface for Plan 07 PATCH route"
  - "Mockable repository boundary for unit-testing the resolver (Plan 06) and route (Plan 07) without hitting Postgres"
affects: [07-06-resolver, 07-07-settings-route, phase-08-admin-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository pattern (class + singleton + named exports) — mirrors ProductRepository.ts"
    - "Multi-tenancy lock at repository layer: every method takes `shop` as first arg and binds it into the where clause"
    - "Prisma `@updatedAt`-managed timestamp: upsert's update branch only sets `activeChatModelId`; never writes `updatedAt` manually"

key-files:
  created:
    - "lib/db/repositories/ShopSettingsRepository.ts"
  modified: []

key-decisions:
  - "Public surface frozen at exactly two methods (get, upsert) — no delete, list, or bulk variants (YAGNI; deferred-ideas confirms no audit log)"
  - "ShopSettings type imported from '@/app/generated/prisma/client' to match ProductRepository's import path"
  - "JSDoc documents the trust boundary: caller (Plan 07 route) must derive `shop` from withShopifySession ctx — repository trusts the string"

patterns-established:
  - "Repository pattern for single-row, shop-keyed tables: class wrapping prisma.<model>, plus a `<model>Repository` singleton export"
  - "Upsert update branch is minimal-field: only mutable columns appear in the update payload (no PK, no @updatedAt)"

requirements-completed: [ADM-03]

# Metrics
duration: ~5min
completed: 2026-05-27
---

# Phase 7 Plan 05: ShopSettingsRepository Summary

**Thin Prisma wrapper exposing `get(shop)` + `upsert(shop, activeChatModelId)` against the `shop_settings` table, mirroring `ProductRepository` shape with a singleton export for downstream consumers.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-27T16:20:00Z
- **Completed:** 2026-05-27T16:25:35Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Drove `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` from RED to GREEN (5/5 tests passing)
- Established `shopSettingsRepository` singleton as the canonical write surface for Plan 07's PATCH route
- Mirrored `ProductRepository` structural conventions exactly: class declaration, async methods, singleton export at module scope, `ShopSettings` type imported from the generated Prisma client
- Documented trust boundary in JSDoc — caller must pre-derive `shop` from a verified session token

## Task Commits

1. **Task 1: Implement ShopSettingsRepository.get + upsert mirroring ProductRepository** — `d4c71b7` (feat)

   - All 5 it() blocks in `ShopSettingsRepository.test.ts` pass
   - `bunx tsc --noEmit` reports no errors mentioning `ShopSettingsRepository`
   - File is 40 lines (under the 50-line ceiling in `<verification>`)
   - Zero `console.*` calls; zero `any`; no extra public methods beyond the two contracted

## Files Created/Modified

- `lib/db/repositories/ShopSettingsRepository.ts` — class + singleton; thin wrapper around `prisma.shopSettings.findUnique` and `prisma.shopSettings.upsert` keyed on the `shop` PK

## Decisions Made

- **Type import path:** Used `@/app/generated/prisma/client` (matches ProductRepository.ts), not a re-exported alias.
- **JSDoc placement:** Single block-level JSDoc above the class describing the contract, the multi-tenancy lock, and the relationship to Plans 06/07. No per-method JSDoc — the signatures are self-documenting and the contract block covers semantics.
- **`upsert` update branch:** Only `{ activeChatModelId }` — does NOT include `shop` (PK, immutable) or `updatedAt` (`@updatedAt`-managed by Prisma). The Wave-0 test explicitly asserts `update` does not contain these keys.

## Deviations from Plan

None — plan executed exactly as written. The Wave-0 RED tests already pinned the exact `prisma.shopSettings.*` call shapes, so the implementation was contract-driven.

## Issues Encountered

None.

## User Setup Required

None — uses the existing `@prisma/client` 7.3.0 dependency. No new packages, no env vars, no migrations (Plan 03 already applied `shop_settings`).

## Next Phase Readiness

**Plan 07 (PATCH /api/settings/model):**
- Import `shopSettingsRepository` from `@/lib/db/repositories/ShopSettingsRepository`
- After catalog membership validation, call `await shopSettingsRepository.upsert(shop, activeChatModelId)`
- For route tests, mock `@/lib/db/repositories/ShopSettingsRepository` and stub `shopSettingsRepository.upsert` — the singleton is the documented mock surface

**Plan 06 (getActiveChatModel resolver):**
- May call either `prisma.shopSettings.findUnique({ where: { shop } })` directly OR `shopSettingsRepository.get(shop)` — both return the same `ShopSettings | null`. Planner choice.

**No blockers.**

## Self-Check: PASSED

- `lib/db/repositories/ShopSettingsRepository.ts` exists (verified)
- Commit `d4c71b7` exists in `git log` (verified)
- All Wave-0 RED tests pass (verified via `bunx vitest run`)

---
*Phase: 07-admin-settings-model-picker*
*Completed: 2026-05-27*
