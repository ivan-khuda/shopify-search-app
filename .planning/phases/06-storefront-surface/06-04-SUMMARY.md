---
phase: 06-storefront-surface
plan: 04
subsystem: auth
tags: [hmac, app-proxy, rate-limit, idn-02, shopify-api]

requires:
  - phase: 01-foundation
    provides: shopifyClient.utils.validateHmac with appProxy signator
provides:
  - withAppProxyHmac HOC for /api/proxy/* route handlers
  - verifyAppProxyHmac standalone verifier
  - AppProxyAuthError class with 401/403 status codes
  - rateLimit + BUCKETS for chat/read sliding-window limits
  - __resetRateLimitForTests internal hook for test setup
affects: [06-07, 06-08, 06-09, 06-10]

tech-stack:
  added: []
  patterns:
    - "HOC pattern mirrors lib/shopify/auth.ts withShopifySession (admin) — same shape, different trust source"
    - "URLSearchParams as the `query` type forwarded to handlers (test contract)"
    - "Body cross-check for IDN-02 reads + clones request so downstream handler can still read the stream"

key-files:
  created:
    - lib/shopify/app-proxy-auth.ts
    - lib/rate-limit/memory.ts
    - .planning/phases/06-storefront-surface/06-04-SUMMARY.md
  modified:
    - lib/rate-limit/__tests__/memory.test.ts

key-decisions:
  - "withAppProxyHmac enforces IDN-02 at the wrapper layer: when signed query carries logged_in_customer_id, any body-supplied customer_id must match or the wrapper returns 403 customer_id_mismatch. Plan undershoots IDN-02; tests required it."
  - "query is forwarded as URLSearchParams (test contract), not Record<string,string> (plan contract). Tests are RED scaffolds and the source of truth for downstream handler interface."
  - "rateLimit bucket renamed 'rest' → 'read' per RED test contract"
  - "Added __resetRateLimitForTests internal export — RED tests use vi.useFakeTimers() which resets Date.now() per case, leaving the module-scope Map indistinguishable across tests"

patterns-established:
  - "Wrapper-layer enforcement of cross-signal invariants (signed-query × body): clone request, parse body once, forward cloned request to handler"
  - "Future-timestamp filter (t <= now) in rate limiters guards against fake-timer regressions"

requirements-completed:
  - STR-04
  - STR-08
  - IDN-02

duration: ~10min
completed: 2026-05-27
---

# Phase 06, Plan 04: App Proxy Auth + Rate Limit Summary

**withAppProxyHmac wraps storefront route handlers with HMAC + IDN-02 cross-check; rateLimit provides chat/read sliding windows per D-08.**

## Performance
- **Duration:** ~10 min
- **Completed:** 2026-05-27
- **Tasks:** 2 (auto, tdd:true)
- **Files modified:** 3

## Accomplishments
- `lib/shopify/app-proxy-auth.ts` ships with `withAppProxyHmac`, `verifyAppProxyHmac`, `AppProxyAuthError`, `AppProxyAuthErrorCode`
- `lib/rate-limit/memory.ts` ships with `rateLimit`, `BUCKETS` (chat/read), `__resetRateLimitForTests`
- 22 RED tests (14 app-proxy + 8 rate-limit) flipped GREEN
- Zero `console.*` calls and zero `crypto.createHmac` in either file (CLAUDE.md hard constraints honored)

## Task Commits
1. **Task 1: app-proxy-auth.ts** — `bb037a8` (feat)
2. **Task 2: memory.ts + test setup fix** — `4580510` (feat)

## Files Created/Modified
- `lib/shopify/app-proxy-auth.ts` — HOC + verifier + error class
- `lib/rate-limit/memory.ts` — sliding-window limiter
- `lib/rate-limit/__tests__/memory.test.ts` — added `__resetRateLimitForTests()` to `beforeEach`

## Decisions Made
- See key-decisions in frontmatter for the four substantive deviations from the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] IDN-02 enforcement moved into withAppProxyHmac**
- **Found during:** Task 1 test run (14 RED tests → 13 GREEN + 1 RED on `customer_id_mismatch`)
- **Issue:** Plan describes only HMAC validation in the wrapper, but the RED scaffold's IDN-02 test expects the wrapper to also cross-check signed `logged_in_customer_id` against body `customer_id` and return 403 on mismatch. Without this, a malicious/buggy client could mismatch identity at the route boundary.
- **Fix:** Added `customer_id_mismatch` to `AppProxyAuthErrorCode` (status 403), introduced a per-code status map, and read/parse/clone the request body inside the wrapper when `query.logged_in_customer_id` is present. Body parsing is best-effort — malformed/non-JSON bodies fall through silently; only an explicit mismatch returns 403.
- **Verification:** All 14 tests pass; handler receives the cloned request so it can still read the body downstream.
- **Committed in:** `bb037a8`

**2. [Rule 4 - Interface Mismatch] query: URLSearchParams (not Record<string,string>)**
- **Found during:** Task 1 verifyAppProxyHmac test (line 93: `result.query.get('shop')`)
- **Issue:** Plan declared `query: Record<string, string>` but the RED scaffolds call `query.get(...)` — that's URLSearchParams. Following the RED test contract per "tests are the source of truth".
- **Fix:** Changed types throughout. validateHmac in @shopify/shopify-api accepts URLSearchParams directly.
- **Impact:** Downstream Wave 2 plans (06-07, 06-08, 06-09) will destructure `query.get(...)` rather than `query.foo`. PATTERNS.md does not contradict.
- **Committed in:** `bb037a8`

**3. [Rule 4 - Bucket Name] 'rest' → 'read'**
- **Found during:** Task 2 test run (TypeError: cfg undefined for 'read')
- **Issue:** Plan and CONTEXT both say bucket 'rest', but RED scaffold uses `rateLimit(visitor, 'read')`. Following test contract.
- **Fix:** Renamed key.
- **Committed in:** `4580510`

**4. [Rule 3 - Blocking] Added __resetRateLimitForTests internal export**
- **Found during:** Task 2 (8th test "prunes timestamps older than window" failed even when 7 others passed)
- **Issue:** Module-scope Map persists across tests; `vi.useFakeTimers()` resets `Date.now()` to 0 per case; old entries from prior tests look like new entries in the fresh test. The test file did not include a reset hook.
- **Fix:** Added a `/* @internal */` `__resetRateLimitForTests()` export and amended the test's `beforeEach` to call it. Plan explicitly licensed this small API surface: "Add an inline @internal clear function for tests if Plan 01's RED tests need to reset state between cases".
- **Verification:** 8/8 rate-limit tests pass.
- **Committed in:** `4580510`

---

**Total deviations:** 4 (1 missing critical, 1 interface mismatch, 1 name mismatch, 1 blocking test fix)
**Impact on plan:** No scope creep. All four deviations are mandated by the RED test contracts and improve security posture (IDN-02 at the wrapper layer) or test ergonomics.

## Issues Encountered
- None outside the deviations above.

## Next Phase Readiness
- ✓ Wave 2 route plans can `import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth'` and `import { rateLimit } from '@/lib/rate-limit/memory'`
- ✓ The body-cross-check pattern in the wrapper means downstream handlers do NOT need to redo IDN-02 — they just receive the cloned request
- ✓ Threat T-06-04 (shop spoofing), T-06-06 (log leakage), and IDN-02 enforcement all close at this layer

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
