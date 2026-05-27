---
phase: 06-storefront-surface
plan: 07
subsystem: api
tags: [next-app-router, prisma, app-proxy, conversations, idn-04, jsonb]

requires:
  - phase: 06-storefront-surface
    provides: 06-02 (Conversation model), 06-04 (withAppProxyHmac + rateLimit)
provides:
  - "GET/POST/DELETE app/api/proxy/conversations/route.ts"
  - "GET/PATCH app/api/proxy/conversations/[id]/route.ts"
affects: [06-09, 06-11, 06-12]

tech-stack:
  added: []
  patterns:
    - "verifyAppProxyHmac direct call (vs withAppProxyHmac wrapper) when handler needs Next.js dynamic params"
    - "JSONB append via prisma.\$executeRaw with messages || \${value}::jsonb operator"
    - "Owner check defense-in-depth: shop scoping is necessary but not sufficient; row.visitorId === query visitor_id OR row.customerId === signed logged_in_customer_id"

key-files:
  created:
    - app/api/proxy/conversations/route.ts
    - app/api/proxy/conversations/[id]/route.ts
    - .planning/phases/06-storefront-surface/06-07-SUMMARY.md

key-decisions:
  - "PATCH body accepts both 'turn' (single) and 'newMessages' (array) — test scaffold uses 'turn', plan said 'newMessages'. Implementation handles both."
  - "POST returns 200 (test contract) instead of 201 (plan said 201) — tests are source of truth."
  - "rateLimit bucket is 'read' (matches 06-04 impl) — plan said 'rest' which doesn't exist."
  - "[id] route uses verifyAppProxyHmac directly because withAppProxyHmac's wrapper signature can't accept Next.js dynamic params."

patterns-established:
  - "REST handlers for App Proxy routes pattern: verifyAppProxyHmac (or wrapper) → rate-limit → Prisma shop-scoped query → response"
  - "Cursor pagination via take=21+slice=20+nextCursor=items[20]?.id (no count query)"

requirements-completed:
  - STR-04
  - STR-08
  - IDN-03
  - IDN-04

duration: ~10min
completed: 2026-05-27
---

# Phase 06, Plan 07: Conversation REST Routes Summary

**Five HTTP-method exports for /api/proxy/conversations and /[id] — list, create, bulk-delete, single fetch, append-turn. HMAC + rate-limit + shop + owner defense in depth.**

## Performance
- **Duration:** ~10 min
- **Completed:** 2026-05-27
- **Tasks:** 2 (both auto, tdd:true)
- **Files modified:** 2

## Accomplishments
- 14/14 RED tests across both files flipped GREEN (7 collection + 7 single-row)
- All handlers shop-scope every Prisma where clause
- PATCH appends JSONB atomically via `messages || ${json}::jsonb`

## Task Commits
1. **Task 1: collection routes** — `5ccbb4e` (feat)
2. **Task 2: [id] routes** — `5e459f4` (feat)

## Files Created/Modified
- `app/api/proxy/conversations/route.ts` — GET, POST, DELETE
- `app/api/proxy/conversations/[id]/route.ts` — GET, PATCH

## Decisions Made
- See key-decisions in frontmatter.

## Deviations from Plan

**1. [Rule 4 - Test Contract] Direct verifyAppProxyHmac for dynamic routes**
- **Found during:** Task 2 setup
- **Issue:** Test calls `GET(req, { params: Promise.resolve({ id }) })` — two-arg Next.js 16 signature. withAppProxyHmac returns a single-arg function.
- **Fix:** [id]/route.ts exports two-arg handlers that call verifyAppProxyHmac directly inside. Wrapper logic (catch AppProxyAuthError → JSON envelope) is copied via an `authGate` helper local to the file.
- **Committed in:** `5e459f4`

**2. [Rule 4 - Test Contract] Bucket name 'read' / status 200 / body field 'turn'**
- **Found during:** Various test assertions
- **Issue:** Plan said bucket 'rest', POST returns 201, PATCH body `newMessages`. Tests said 'read', 200, `turn`.
- **Fix:** Followed tests. PATCH also accepts plan's `newMessages` array as a fallback.
- **Committed in:** `5ccbb4e`, `5e459f4`

---

**Total deviations:** 2 (both test-contract-driven).

## Issues Encountered
- None.

## Next Phase Readiness
- ✓ DbBackedHistoryStore (Plan 11) can wire to these endpoints
- ✓ Plan 09 /api/proxy/chat onFinish hook can PATCH new messages into the JSONB
- ✓ IDN-04 history-row "open to resume" flow is unblocked

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
