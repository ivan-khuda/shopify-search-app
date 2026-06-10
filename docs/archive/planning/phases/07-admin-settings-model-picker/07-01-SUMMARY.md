---
phase: 07-admin-settings-model-picker
plan: 01
subsystem: testing
tags: [tdd, red, wave-0, vitest, scaffolding]
requires:
  - phase-04 (services/chat/getActiveChatModel.ts signature anchor)
  - phase-07 CONTEXT D-01..D-10
provides:
  - failing test contract for Phase 7 catalog client (D-01, D-02, D-03, Pitfall 4 + 5)
  - failing test contract for Phase 7 resolver body swap (D-06, D-09)
  - failing test contract for ShopSettings repository (D-10)
  - failing test contract for PATCH /api/settings/model (D-07 + multi-tenancy lock)
  - failing test contract for /settings server page (D-04 columns + D-06 banner + D-03 banners)
  - failing test contract for /settings client form (D-04 sort, D-07 save bar, D-06 banner)
affects:
  - services/chat/__tests__/model-catalog.test.ts (new)
  - services/chat/__tests__/getActiveChatModel.test.ts (updated)
  - lib/db/repositories/__tests__/ShopSettingsRepository.test.ts (new)
  - app/api/settings/model/__tests__/route.test.ts (new)
  - app/(embedded)/settings/__tests__/page.test.tsx (new)
  - app/(embedded)/settings/__tests__/settings-form.test.tsx (new)
tech-stack:
  added: []
  patterns:
    - vi.mock module-level mocking with @/ alias
    - vi.stubGlobal('fetch', ...) for catalog client outbound HTTP
    - vi.useFakeTimers + setSystemTime for 15-minute cache window
    - async Server Component test pattern (await Page({...}) then render(tree))
    - jsdom + RTL fireEvent / userEvent for client component interaction
    - Polaris s-* / ui-* web components rendered as unknown HTML elements; assertions via getAttribute + textContent
key-files:
  created:
    - services/chat/__tests__/model-catalog.test.ts
    - lib/db/repositories/__tests__/ShopSettingsRepository.test.ts
    - app/api/settings/model/__tests__/route.test.ts
    - app/(embedded)/settings/__tests__/page.test.tsx
    - app/(embedded)/settings/__tests__/settings-form.test.tsx
  modified:
    - services/chat/__tests__/getActiveChatModel.test.ts
decisions:
  - Existing Phase 4 assertions preserved via describe.skip (not deleted) to retain history
  - SettingsForm test stubs window.shopify in a per-test beforeEach (not vitest.setup.ts) — keeps Phase 7 setup local
  - Server Component test uses an inline mock stub for <SettingsForm /> so SSR assertions read structured data attributes rather than re-rendering the client tree
  - Pricing fixture uses live AI Gateway string format ('0.0000003') verified against RESEARCH §Pitfall 5
metrics:
  duration: ~25 minutes
  date: 2026-05-27
---

# Phase 7 Plan 01: RED Test Scaffolds Summary

Wave 0 RED test scaffold for Phase 7 (Admin Settings + Model Picker). Authors 6 failing Vitest suites that pin every Phase 7 behavior (SC1..SC4 + locked decisions D-01..D-10) before any implementation exists.

## Files

### Created (5)

| File | Tests | Pins |
|------|-------|------|
| `services/chat/__tests__/model-catalog.test.ts` | 6 it() | D-01 fetch+filter, D-02 BEST_FOR, D-03 cache+stale+cold-start, Pitfall 4 (`cache:'no-store'`), Pitfall 5 (×1e6 conversion) |
| `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` | 5 it() | D-10 `get(shop)` + `upsert(shop, id)` create/update branches |
| `app/api/settings/model/__tests__/route.test.ts` | 7 it() | D-07 PATCH happy path + Zod validation + catalog membership + multi-tenancy lock + no-secret-logging |
| `app/(embedded)/settings/__tests__/page.test.tsx` | 6 it() | SC1 D-04 7-column SSR + D-06 pre-selection + warning banner + D-03 stale/cold-start banners + searchParams.shop=undefined parity |
| `app/(embedded)/settings/__tests__/settings-form.test.tsx` | 9 it() | D-04 sort toggle, D-07 dirty-state save bar + toast + error banner, D-06 warning banner, Bearer-token PATCH |

### Modified (1)

| File | Change |
|------|--------|
| `services/chat/__tests__/getActiveChatModel.test.ts` | Wrapped 3 existing Phase 4 it() blocks in `describe.skip(...)`; added 5 new Phase 7 it() blocks covering DB-miss (D-09), DB-hit hydration (D-06), id-segment displayName synthesis on catalog miss and catalog outage (Open Q3) |

**Total new failing it() blocks: 33** across 6 test files.

## Wave 0 Verification

```text
$ bunx vitest run services/chat lib/db/repositories app/api/settings 'app/(embedded)/settings' --reporter=default
 Test Files  6 failed | 1 passed (7)
      Tests  11 passed (11)
```

The single passing file is the pre-existing `lib/db/repositories/__tests__/ProductRepository.test.ts` (Phase 4 work). All 6 Phase 7 suites fail at module-resolution boundary because the target implementation modules do not yet exist — this is the intended RED state:

| Missing module | Drives RED in | Land at |
|----------------|---------------|---------|
| `services/chat/model-catalog.ts` | model-catalog.test.ts | Plan 04 |
| `lib/db/repositories/ShopSettingsRepository.ts` | ShopSettingsRepository.test.ts + route.test.ts | Plan 03 |
| `app/api/settings/model/route.ts` | route.test.ts | Plan 07 |
| `app/(embedded)/settings/page.tsx` | page.test.tsx | Plan 08 |
| `app/(embedded)/settings/settings-form.tsx` | settings-form.test.tsx | Plan 08 |
| Phase 7 body of `services/chat/getActiveChatModel.ts` | getActiveChatModel.test.ts (new it() blocks) | Plan 06 |

The 11 passing tests are all from `ProductRepository.test.ts` (pre-existing — out of Phase 7 scope).

## Commits

| Commit | Message |
|--------|---------|
| `cfcec88` | `test(07-01-01): RED scaffolds for catalog client, resolver, settings repo` |
| `63654a2` | `test(07-01-02): RED scaffolds for settings route, page, and form` |

## Decisions Made During Execution

1. **Polaris s-\* / ui-\* tags treated as unknown HTML elements in jsdom.** All assertions use `getAttribute()` + `textContent` rather than expecting Polaris-rendered behavior. This matches plan guidance and the existing `app/(embedded)/__tests__/onboarding.test.tsx` reference patterns.
2. **Server Component test renders a stub `<SettingsForm />`.** The SSR test asserts the shape of data passed to the client component via `data-*` attributes, isolating SSR concerns from client-interaction concerns (which live in the sibling `settings-form.test.tsx`).
3. **`__resetModelCatalogCacheForTests` is part of the Plan 04 contract.** The catalog client must export this test-only escape hatch so cache state does not leak across suites. Plan 04 should add it alongside `fetchModelCatalog`.
4. **`shopSettingsRepository` (singleton) is the target export.** Mirrors the existing `productRepository` pattern — Plan 03 must export an instance, not just a class.
5. **PATCH route test bypasses real Bearer auth via `vi.mock('@/lib/shopify/auth')`.** Real auth contract is covered by `lib/shopify/__tests__/auth.test.ts`; the route test focuses on the post-auth behavior (Zod, catalog membership, upsert, no-secret-logging).

## Deviations from Plan

- **None.** All 5 files created and 1 file updated per `<files_modified>` contract. No implementation files touched, no new packages installed, no `.skip` on the new Phase 7 cases.

## Wave 0 Status

**33 RED tests ready for Wave 1+.** Plans 02–08 will drive each one to GREEN:

- Plan 02: prisma schema (`ShopSettings` model) + migration
- Plan 03: `ShopSettingsRepository` → drives 5 tests GREEN
- Plan 04: `model-catalog.ts` → drives 6 tests GREEN
- Plan 06: resolver body swap → drives 5 Phase 7 tests GREEN
- Plan 07: PATCH route → drives 7 tests GREEN
- Plan 08: page + form → drives 15 tests GREEN

## Self-Check: PASSED

- All 6 test files exist on disk and import cleanly until they reach the missing target module (verified via `bunx vitest run`)
- Both commits (`cfcec88`, `63654a2`) present in `git log`
- Working tree contains no production-code changes (only `.planning/STATE.md` from upstream session-recording — not modified by this plan)
- No new packages added (verified — `bun.lock` untouched)
- `describe.skip` wrapper preserves Phase 4 history in `getActiveChatModel.test.ts`
