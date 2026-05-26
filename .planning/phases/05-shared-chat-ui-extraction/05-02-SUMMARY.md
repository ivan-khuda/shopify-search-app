---
phase: 05-shared-chat-ui-extraction
plan: 02
subsystem: chat-ui
tags: [refactor, adapters, stores, chat-ui, wave-1, green-phase]
requires: ["05-01"]
provides:
  - "shr-02-store-contracts"
  - "shr-03-adapter-implementations"
  - "chat-identity-adapter-interface"
  - "local-storage-default-stores"
  - "react-store-hooks"
affects:
  - "lib/chat-ui/adapters"
  - "lib/chat-ui/stores"
  - "types/shopify-global.d.ts"
  - "vitest.setup.ts"
tech-stack:
  added: []
  patterns:
    - "Runtime-global consumption (no @shopify/* imports) for App Bridge isolation (SHR-01)"
    - "Scope-or-throw constructor guard (Pattern G, T-5-01 mitigation)"
    - "useSyncExternalStore + .bind(store) + () => [] SSR snapshot (Pattern 4)"
    - "Brace-block unsubscriber to avoid leaking Set.delete boolean return"
    - "In-memory MemoryStorage polyfill on window to neutralize Node 25's partial native localStorage"
key-files:
  created:
    - "lib/chat-ui/adapters/types.ts"
    - "lib/chat-ui/adapters/embedded.ts"
    - "lib/chat-ui/adapters/storefront.ts"
    - "lib/chat-ui/stores/types.ts"
    - "lib/chat-ui/stores/local-storage.ts"
    - "lib/chat-ui/stores/hooks.ts"
  modified:
    - "types/shopify-global.d.ts"
    - "vitest.setup.ts"
decisions:
  - "Used the existing `types/shopify-global.d.ts` for the ambient `shopify` global declaration rather than adding a new file. The package `@shopify/app-bridge-types` declares `var shopify: ShopifyGlobal` globally but is not picked up automatically by the project's `tsc` because `compilerOptions.types` is unset; adding a minimal local ambient declaration keeps `lib/chat-ui/adapters/embedded.ts` free of any `@shopify/*` import (SHR-01) and also fixes a pre-existing TS error in `app/(embedded)/onboarding/page.tsx`."
  - "Polyfilled `window.localStorage`/`sessionStorage` with an in-memory `MemoryStorage` class in `vitest.setup.ts`. Node 25 introduced an experimental native `localStorage` global that lacks `setItem`/`clear` unless `--localstorage-file` is supplied; it shadows jsdom's full implementation. The polyfill is Rule 3 (blocking issue) — it lets the Wave 0 RED tests from Plan 01 transition to GREEN without modifying those tests."
  - "Built the stores with a private `cache: T[] | null` field re-read lazily from localStorage. List() returns the cached array (so React's `getSnapshot` returns a stable reference across renders) and mutators rebuild the cache. This matches `useSyncExternalStore`'s `Object.is`-comparison contract."
metrics:
  duration: "~12 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
  source_lines: 243
  tests_green: 17
---

# Phase 5 Plan 02: Adapters + Stores Summary

Implemented the Wave 1 production code that turns three of Plan 01's RED test files GREEN: the `ChatIdentityAdapter` interface plus both concrete adapters (Embedded uses runtime `shopify.idToken()`, Storefront uses `localStorage` + `crypto.randomUUID()`), and the `HistoryStore` + `SavedProductsStore` interfaces with their LocalStorage defaults and `useSyncExternalStore`-backed React hooks.

## Tasks Completed

| # | Task                                                      | Commit    | Files                                                                                                                |
| - | --------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| 1 | Adapter types + EmbeddedAdapter + StorefrontAdapter       | `f152539` | lib/chat-ui/adapters/{types,embedded,storefront}.ts, types/shopify-global.d.ts, vitest.setup.ts                       |
| 2 | Store types + LocalStorage implementations + React hooks  | `4a941ca` | lib/chat-ui/stores/{types,local-storage,hooks}.ts                                                                    |

## Files Created

| File                                       | Lines | Role                                                                |
| ------------------------------------------ | ----- | ------------------------------------------------------------------- |
| `lib/chat-ui/adapters/types.ts`            |   5   | `ChatIdentityAdapter` interface (D-03)                              |
| `lib/chat-ui/adapters/embedded.ts`         |  14   | Embedded surface — Bearer header via runtime `shopify.idToken()`    |
| `lib/chat-ui/adapters/storefront.ts`       |  21   | Storefront surface — visitor_id via localStorage + crypto.randomUUID |
| `lib/chat-ui/stores/types.ts`              |  16   | `HistoryStore` + `SavedProductsStore` interfaces (D-06)              |
| `lib/chat-ui/stores/local-storage.ts`      | 145   | LocalStorage default impls with scope-throw + HISTORY_CAP=10        |
| `lib/chat-ui/stores/hooks.ts`              |  42   | `useHistoryStore` + `useSavedProductsStore` via useSyncExternalStore |
| **Total**                                  | 243   |                                                                     |

## Files Modified (Rule 3 — blocking issues)

| File                              | Why                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/shopify-global.d.ts`       | Added an ambient `declare var shopify: ShopifyRuntimeGlobal` so the embedded adapter can consume the runtime global without importing from `@shopify/*` (SHR-01). Also resolves a pre-existing TS error in `onboarding/page.tsx`.   |
| `vitest.setup.ts`                 | Installed an in-memory `MemoryStorage` polyfill on `window.localStorage` / `window.sessionStorage` to neutralize Node 25's partial native localStorage that lacks `setItem`/`clear`. Without this, Plan 01 RED tests cannot run.    |

## RED → GREEN Transition

```
$ bunx vitest run lib/chat-ui/__tests__/embedded-adapter.test.ts \
                  lib/chat-ui/__tests__/storefront-adapter.test.ts \
                  lib/chat-ui/__tests__/local-storage-stores.test.ts

 Test Files  3 passed (3)
      Tests  17 passed (17)
```

| Test file                                                       | Before | After    |
| --------------------------------------------------------------- | ------ | -------- |
| `lib/chat-ui/__tests__/embedded-adapter.test.ts`                | RED    | 4 GREEN  |
| `lib/chat-ui/__tests__/storefront-adapter.test.ts`              | RED    | 5 GREEN  |
| `lib/chat-ui/__tests__/local-storage-stores.test.ts`            | RED    | 8 GREEN  |
| `lib/chat-ui/__tests__/barrel-isolation.test.ts` (test 2)       | RED    | RED      |

The remaining barrel-isolation RED is expected and out of scope — Plan 03 lands `lib/chat-ui/index.ts`.

## Contract Verification

| Contract                                            | Evidence                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SHR-01: zero `@shopify/*` imports in adapters       | `grep -E "from\s+['\"]@shopify\b" lib/chat-ui/adapters/{embedded,storefront}.ts` → 0 matches.                                       |
| SHR-03 (embedded): `endpoint='/api/chat'`, Bearer header from fresh `shopify.idToken()` | Test 1+2 GREEN; Test 4 GREEN — `idTokenMock` called twice across two `getAuthHeaders()` calls (no module-level cache). |
| SHR-03 (storefront): `endpoint='/api/proxy/chat'`, visitor_id round-trip, SSR-safe       | Test 3+4 GREEN — `crypto.randomUUID` called once across two `getRequestBody()` calls (persistent); Test 5 GREEN — `{}` when `window` is `undefined`.       |
| D-06: store interfaces in `lib/chat-ui/stores/types.ts` with subscribe contract          | `grep -c "subscribe(listener: () => void)" lib/chat-ui/stores/types.ts` → 2.                                                                              |
| D-07: HISTORY_CAP=10, newest-first; SavedProducts uncapped                                | Test "newest first, oldest dropped" GREEN (items[0].id==='h11', items[9].id==='h2'); 100-product saved test GREEN.                                       |
| T-5-01: scope-or-throw on both stores                | `grep -c "requires a non-empty scope" lib/chat-ui/stores/local-storage.ts` → 2.                                                                            |
| T-5-AC: no module-level token cache                  | EmbeddedAdapter has no module/static state; `getAuthHeaders` is `async` and awaits `shopify.idToken()` directly.                                                                |
| T-5-ER: no try/catch around `shopify.idToken()`      | `grep -c "try" lib/chat-ui/adapters/embedded.ts` → 0 (original error propagates without token concatenation).                                                                  |
| T-5-LO: no `console.*` in adapters or stores         | `grep -E "console\.(log\|warn\|error\|debug\|info)" lib/chat-ui/{adapters,stores}/*.ts` → 0 matches.                                                                              |
| TS strict (authoritative gate)                       | `bunx tsc --noEmit` returns ZERO errors for any file under `lib/chat-ui/` or `types/shopify-global.d.ts` (pre-existing project errors in unrelated files remain).                |
| Type-position `any` gate                             | `grep -cE ':\s*any\b\|<any[,>]\|as\s+any\b\|as\s+unknown\s+as' lib/chat-ui/{adapters,stores}/*.ts` → 0.                                                                            |

## Threat-Mitigation Application

| Threat ID | Mitigation Applied                                                                                                                                                                              | Verification                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| T-5-01    | Both `LocalStorageHistoryStore` and `LocalStorageSavedProductsStore` constructors throw `Error('LocalStorage*Store requires a non-empty scope')` when `scope` is falsy.                          | local-storage-stores.test.ts tests 1+2 GREEN.            |
| T-5-AC    | No module-level cache of resolved auth headers. `EmbeddedAdapter.getAuthHeaders()` awaits `shopify.idToken()` on every call; the JWT is ~1 minute TTL and must be refetched per request.        | embedded-adapter.test.ts test 4 GREEN — 2 calls, 2 invocations of `shopify.idToken`. |
| T-5-ER    | No `try`/`catch` wrapping in `EmbeddedAdapter` — if `shopify.idToken()` throws, the original error propagates without ever being concatenated with the token value.                              | grep: zero `try` occurrences in `embedded.ts`.           |
| T-5-LO    | Zero `console.log`/`warn`/`error`/`debug`/`info` calls in `lib/chat-ui/adapters/*.ts` and `lib/chat-ui/stores/*.ts`. Adapters never emit secrets to any sink.                                    | grep across both directories returns 0.                  |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Node 25 native localStorage shadows jsdom**

- **Found during:** Task 1, first verification run.
- **Issue:** `bunx vitest run lib/chat-ui/__tests__/storefront-adapter.test.ts` failed with `TypeError: window.localStorage.clear is not a function`. Probing showed `globalThis.localStorage === window.localStorage` and both resolve to Node 25's experimental native `localStorage` (which requires `--localstorage-file` to be functional and shadows jsdom's full implementation).
- **Fix:** Added an in-memory `MemoryStorage` class to `vitest.setup.ts` and installed it on `window.localStorage` / `window.sessionStorage` via `Object.defineProperty`. This restores the full Web Storage contract for all jsdom-based tests, not just chat-ui.
- **Files modified:** `vitest.setup.ts`.
- **Commit:** `f152539`.

**2. [Rule 3 — Blocking] Ambient `shopify` global missing from tsc**

- **Found during:** Task 1, after `bunx tsc --noEmit`.
- **Issue:** `lib/chat-ui/adapters/embedded.ts(7,25): error TS2304: Cannot find name 'shopify'`. The same error existed in `app/(embedded)/onboarding/page.tsx` — i.e., the project already relied on a runtime global that TS could not resolve. `@shopify/app-bridge-types` declares `var shopify: ShopifyGlobal` globally but is not auto-included.
- **Fix:** Extended `types/shopify-global.d.ts` with a minimal ambient `declare var shopify: ShopifyRuntimeGlobal` that exposes only `idToken()` and `toast.show()` (the runtime methods this app actually uses). The adapter keeps zero `@shopify/*` imports because the declaration is global.
- **Files modified:** `types/shopify-global.d.ts`.
- **Commit:** `f152539`.

Both deviations are Rule-3 unblockers — neither alters the adapter or store contracts the plan specified.

## TDD Gate Compliance

Plan 02 picks up Wave 0's three RED commits from Plan 01 and lands the GREEN commits here:

- `f152539` feat(05-02): add ChatIdentityAdapter + Embedded/Storefront adapters → turns embedded-adapter.test.ts + storefront-adapter.test.ts GREEN.
- `4a941ca` feat(05-02): add HistoryStore + SavedProductsStore + React hooks → turns local-storage-stores.test.ts GREEN.

REFACTOR is unnecessary; the implementations match the verbatim sketches in `05-PATTERNS.md` and have no duplication to consolidate.

## Threat Flags

None — Plan 02 introduces no security-relevant surface beyond what the threat register already enumerates. The two Rule-3 unblockers touch test-environment polyfill code (`vitest.setup.ts`) and a type-only `.d.ts` (`types/shopify-global.d.ts`); neither runs in production.

## Self-Check: PASSED

- All 6 source files exist (verified via Bash `wc -l` — 243 source lines total).
- Both commits exist on branch (`f152539`, `4a941ca`).
- Adapter tests + store tests all GREEN: 17 passing, 0 failing across the three Plan 01 RED files.
- `bunx tsc --noEmit` produces ZERO errors for files this plan touched.
- Zero `@shopify/*` imports anywhere in `lib/chat-ui/adapters/`.
- Zero `console.*` calls anywhere in `lib/chat-ui/adapters/` or `lib/chat-ui/stores/`.
- Zero type-position `any` casts in any of the 6 source files (tightened grep gate).
- Scope-or-throw guard present in both store constructors (`grep -c "requires a non-empty scope"` → 2).
