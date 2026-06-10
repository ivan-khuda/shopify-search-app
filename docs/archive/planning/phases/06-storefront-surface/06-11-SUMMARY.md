---
phase: 06-storefront-surface
plan: 11
subsystem: ui
tags: [chat-ui, adapter, store, react, useSyncExternalStore, db-backed]

requires:
  - phase: 05-shared-chat-ui-extraction
    provides: HistoryStore + SavedProductsStore interfaces, useSyncExternalStore-friendly store contract, runtime-neutral barrel
  - phase: 06-storefront-surface
    provides: 06-07 conversations API, 06-08 saved-products API
provides:
  - StorefrontAdapter with customer_id reading (BigInt-safe via String coercion)
  - DbBackedHistoryStore + DbBackedSavedProductsStore
  - useDbBackedHistoryStore + useDbBackedSavedProductsStore hooks
  - Barrel re-exports
affects: [06-13]

tech-stack:
  added: []
  patterns:
    - "Optimistic cache mutation + fire-and-forget fetch (refresh() reconciles)"
    - "Optional chaining on fetch().catch(): fetch?.catch?.(…) tolerates test mocks that return undefined"
    - "useSyncExternalStore + identity-keyed useMemo for hooks; useEffect seeds cache on mount/identity change"

key-files:
  created:
    - lib/chat-ui/stores/db-backed.ts
    - .planning/phases/06-storefront-surface/06-11-SUMMARY.md
  modified:
    - lib/chat-ui/adapters/storefront.ts (customer_id branch added)
    - lib/chat-ui/stores/hooks.ts (two new parallel hooks)
    - lib/chat-ui/index.ts (4 new re-exports)

key-decisions:
  - "customer_id is read from window.Shopify.customer.id and string-coerced; omitted entirely (not undefined) when absent"
  - "DbBackedSavedProductsStore.refresh() filters cache to server-known productIds — full ChatProduct hydration is deferred"
  - "DbBackedSavedProductsStore.clear() is client-side only (no bulk-DELETE endpoint exists); @deprecated for interface parity"
  - "Optional chaining on .catch() — RED test mocks fetch via vi.stubGlobal without a default return, so fetch() can return undefined"

patterns-established:
  - "DB-backed stores mirror LocalStorage analog structurally — same interface, same useSyncExternalStore pattern, just different persistence layer"

requirements-completed:
  - IDN-01
  - IDN-02
  - IDN-04
  - IDN-05

duration: ~10min
completed: 2026-05-27
---

# Phase 06, Plan 11: Storefront Adapters + Stores Summary

**StorefrontAdapter reads logged-in customer_id; DbBackedHistoryStore / DbBackedSavedProductsStore mirror the LocalStorage analog over App Proxy endpoints; parallel hooks ready for the drawer.**

## Performance
- **Duration:** ~10 min
- **Tasks:** 4 (2 tdd:true, 2 auto)

## Accomplishments
- 23/23 tests across storefront-adapter + db-backed flipped GREEN
- All 54 lib/chat-ui tests pass (regression check — Phase 5 barrel-isolation included)

## Task Commits
1. All four tasks — single commit (`ab23d53`)

## Deviations from Plan
- See key-decisions for the four substantive ones (BigInt String coercion, refresh() merge strategy, clear() deprecation, optional-chaining on fetch).

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
