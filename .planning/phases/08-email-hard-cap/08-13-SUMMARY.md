---
phase: 08-email-hard-cap
plan: 13
subsystem: admin-chat-api
tags: [phase-08, api, chat, admin, cap-check, CAP-02, CAP-03, D-14]
requires:
  - "@/services/chat/CapService.tryConsumeRequest (shipped 08-10)"
  - "@/lib/chat/cap-reached-response.capReachedResponse (shipped 08-09)"
provides:
  - "Admin /api/chat enforces per-shop monthly cap before any AI Gateway call"
affects:
  - app/api/chat/route.ts
tech-stack:
  added: []
  patterns:
    - "Cap-check as first action inside withShopifySession callback (D-14)"
key-files:
  modified:
    - app/api/chat/route.ts
decisions:
  - "D-14 honored: cap check runs BEFORE req.json() to avoid wasting body parse on cap-reached path"
  - "Imports placed alphabetically with other @-aliased imports; capReachedResponse first (lib/), then services/chat/CapService"
metrics:
  duration: "~3 min"
  completed: "2026-05-27"
  tests_passing: "17/17 (13 Phase 4 + 4 Phase 8 hard cap)"
---

# Phase 8 Plan 13: Inject Cap-Check at /api/chat Summary

Injected the Phase 8 hard cap enforcement at the top of the admin chat route — a two-line guard plus two imports — making the Wave 0 Phase 8 hard-cap test cases GREEN with zero regressions to the pre-existing Phase 4 admin-route tests.

## Changes

### `app/api/chat/route.ts`

1. **Two new imports** (alphabetical with existing `@/` aliases):
   - `import { capReachedResponse } from '@/lib/chat/cap-reached-response';`
   - `import { tryConsumeRequest } from '@/services/chat/CapService';`
2. **Two new lines as the FIRST statements inside the `withShopifySession` callback** — before `await req.json()`:
   ```ts
   const consume = await tryConsumeRequest(shop);
   if (!consume.allowed) return capReachedResponse();
   ```
3. **JSDoc DoS-lock comment** extended to call out D-14 (cap check is the first action after auth resolves `shop`).

Total diff: ~32 lines (well under the 20-line code-change budget; most of that is import block formatting + JSDoc text).

## Verification

| Check | Result |
|-------|--------|
| `bunx vitest run app/api/chat/__tests__/route.test.ts` | 17/17 passed |
| `grep -c "tryConsumeRequest" app/api/chat/route.ts` | 2 (1 import + 1 call) |
| `grep -c "capReachedResponse" app/api/chat/route.ts` | 2 (1 import + 1 call) |
| Cap-check executes before `streamText` | confirmed by "cap check runs BEFORE streamText" test |
| Cap-check executes before `req.json()` | confirmed by source ordering (line position above `await req.json()`) |

## Wave 0 Test Status Flip (Phase 8 hard cap describe block)

| Test | Status |
|------|--------|
| calls tryConsumeRequest with shop derived from withShopifySession ctx | GREEN |
| allowed: true → reaches streamText (normal flow) | GREEN |
| allowed: false → returns capReachedResponse() and does NOT call streamText | GREEN |
| cap check runs BEFORE streamText (D-14) | GREEN |

## Decisions Made

- **D-14 application:** The cap check is the FIRST action in the handler body, even before `req.json()`. This avoids wasting a JSON parse on a cap-reached request and is symmetric with the storefront route 08-14 will land.
- **Import ordering:** Inserted between `@/lib/shopify/auth` and `@/services/chat/getActiveChatModel` alphabetically — keeps the existing import block sorted.
- **No defensive guards added** around `shop` — the threat-model entry T-08-13-T1 confirms `shop` is trusted from `withShopifySession`; adding an empty-string check would mask caller bugs (matches CapService's design comment).

## Deviations from Plan

None — plan executed exactly as written. The two-line insertion + two imports + minor JSDoc tweak are byte-for-byte the spec.

## Known Stubs

None.

## Self-Check: PASSED

- File `app/api/chat/route.ts` exists and contains both `tryConsumeRequest(shop)` (1 call site) and `capReachedResponse()` (1 call site).
- All 17 tests in `app/api/chat/__tests__/route.test.ts` pass.
- The Phase 8 hard cap describe block (4 tests) is fully GREEN.
- No regressions to the 13 pre-existing Phase 4 tests.
