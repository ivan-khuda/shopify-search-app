# Plan 02-01 Summary

**Status:** complete
**Wave:** 0
**Requirements:** (foundation — sets contracts for SYN-01..11, ADM-01, ADM-02)

## What shipped

**Dependency install:**
- `inngest@4.4.0` → `dependencies`
- `@inngest/test@1.0.0` → `devDependencies`

**4 new RED test files (describe.skip or `it.runIf` until production code lands):**

| File | Plan unlocks it | RED markers |
|------|----------------|-------------|
| `inngest/functions/__tests__/sync-products.test.ts` | 02-06 | 5 behavior cases (SYN-03, SYN-06 — D-01/D-15) + 1 PRE-IMPLEMENTATION marker |
| `app/api/shopify/sync/status/__tests__/route.test.ts` | 02-08 | 5 behavior cases (SYN-07 — 400/404/403/200/401) + 1 PRE-IMPLEMENTATION marker |
| `app/api/shopify/webhook/__tests__/route.test.ts` | 02-09 | 6 behavior cases (SYN-10, SYN-11 — D-06/D-07/D-08/D-17) + 1 contract marker |
| `services/shopify/__tests__/ShopifyProductService.test.ts` | 02-05 | 7 behavior cases (SYN-01, SYN-02 — `toDecimal` for BOTH String and MoneyV2 per RESEARCH Q1 RESOLVED) |

**2 existing test files extended:**

- `app/api/shopify/sync/__tests__/route.test.ts` — appended `describe.skip('POST /api/shopify/sync — Phase 2 behavior (Plan 02-07)')` with 3 cases (existing idempotency dedup, inngest.send call, syncRunId latency contract). The existing 6 tests stay GREEN.
- `app/(embedded)/__tests__/onboarding.test.tsx` — appended `describe.skip('OnboardingPage — Phase 2 progress UI (Plan 02-10)')` with 7 cases (polling cadence with `vi.useFakeTimers`, `<s-progress-bar>`, state badge, terminal-state polling stop, completion banners for success/partial/failed). Existing 7 tests stay GREEN.

## Verification

- `bun run test` → 15 test files, **68 GREEN + 26 SKIPPED** (all 26 are intentional Phase 2 RED markers gated by `describe.skip` or `it.runIf(!!targetModule)`)
- Existing Phase 1 tests stay GREEN (no regressions)
- `bunx tsc --noEmit` clean for the new test files (`@vite-ignore` dynamic imports + `it.runIf` patterns)

## Notes

**Vite static-analysis workaround.** Two of the four new test files import modules that don't exist yet (`../sync-products`, `../route` for `/api/shopify/sync/status`). Vite's `vite:import-analysis` plugin would fail at *transform time* on these imports, breaking the whole test suite. The workaround is `await import(/* @vite-ignore */ TARGET)` with `TARGET` stored in a variable — this defers resolution to runtime, where a `try/catch` cleanly absorbs the missing module. Plans 02-06 and 02-08 land the production modules and the imports succeed naturally; the `it.runIf(!!syncProductsFunction)` guards flip to `true` and the suites turn GREEN.

**Why `describe.skip` for extension cases.** The onboarding component will be rewritten in Plan 02-10 (state machine + polling + banners). Adding the new tests as `describe.skip` documents the contract without breaking existing tests during Waves 1–5. Plan 02-10 removes the `.skip` and the new tests start asserting against the rewritten component.

## Handoff

- Plans 02-05, 06, 07, 08, 09, 10 each remove their `it.runIf` guards or `describe.skip` markers when they land their production code. Each plan's acceptance criteria already reference the relevant RED test file.
- Plan 02-11 verification gate runs `bun run test` and expects 0 skipped tests in the Phase 2 suite (skipped count returns to whatever pre-Phase-2 baseline is, currently 0).
