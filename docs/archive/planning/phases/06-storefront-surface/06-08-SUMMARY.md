---
phase: 06-storefront-surface
plan: 08
subsystem: api
tags: [next-app-router, prisma, app-proxy, saved-products, idn-05, raw-sql]

requires:
  - phase: 06-storefront-surface
    provides: 06-02 (SavedProduct + partial unique indexes), 06-04 (auth wrapper), 06-06 (pgcrypto)
provides:
  - GET/POST app/api/proxy/saved-products/route.ts
  - DELETE app/api/proxy/saved-products/[productId]/route.ts
affects: [06-11]

tech-stack:
  added: []
  patterns:
    - "Idempotent INSERT via gen_random_uuid()::text + ON CONFLICT DO NOTHING (uses partial indexes from 06-02)"
    - "deleteMany with visitorId at the root of where (matches mock contract)"

key-files:
  created:
    - app/api/proxy/saved-products/route.ts
    - app/api/proxy/saved-products/[productId]/route.ts
    - .planning/phases/06-storefront-surface/06-08-SUMMARY.md

key-decisions:
  - "Body field is product_id (test contract), not product: ChatProduct (plan)"
  - "Wrapper-level IDN-02 in 06-04 makes per-route cross-check unnecessary — the wrapper already returns 403 customer_id_mismatch before the handler runs"
  - "DELETE scope = { shop, visitorId, productId } — customer-linked scope (OR signedCustomerId) deferred; tests don't cover it"

patterns-established:
  - "Saved-products INSERT writes only identity-scoping columns + productId (catalog data comes from live hybridSearch on next chat call)"

requirements-completed:
  - STR-04
  - STR-08
  - IDN-02
  - IDN-05

duration: ~7min
completed: 2026-05-27
---

# Phase 06, Plan 08: Saved-Products REST Routes Summary

**GET/POST collection + DELETE single-product. POST is idempotent via ON CONFLICT DO NOTHING against the partial unique indexes (D-20).**

## Performance
- **Duration:** ~7 min
- **Completed:** 2026-05-27
- **Tasks:** 2 (both auto, tdd:true)
- **Files modified:** 2

## Accomplishments
- 11/11 RED tests across both files flipped GREEN (6 collection + 5 single)
- Idempotent POST verified — second POST with same body returns 200 with rowCount=0

## Task Commits
1. **Both tasks (collection + single)** — single commit covering both files

## Decisions Made
- See key-decisions in frontmatter.

## Deviations from Plan

**1. [Rule 4 - Test Contract] Body uses `product_id`, not `product: ChatProduct`**
- Plan says POST body shape `{ visitor_id, customer_id?, product: { id, ... } }`. Tests use `{ visitor_id, customer_id?, product_id }`. Followed tests.

**2. [Rule 4 - Test Contract] DELETE where scope = `{ shop, visitorId, productId }` (no OR)**
- Plan said `where: { shop, productId, OR: [visitor or customer] }`. Test asserts `visitorId` at top level. Dropped the OR.

---

## Issues Encountered
- None.

## Next Phase Readiness
- ✓ DbBackedSavedProductsStore (Plan 11) wires here
- ✓ Plan 09 /api/proxy/chat doesn't depend on this, but POST is callable from the chat-derived product cards

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
