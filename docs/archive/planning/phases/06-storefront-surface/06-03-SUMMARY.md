---
phase: 06-storefront-surface
plan: 03
subsystem: infra
tags: [shopify-cli, app-proxy, toml-config]

requires:
  - phase: 01-foundation
    provides: existing shopify.app.toml with [auth] block + application_url
provides:
  - "[app_proxy] block routing /apps/smartdiscovery/* to /api/proxy/* via Shopify's signed-proxy infrastructure"
affects: [06-04, 06-07, 06-08, 06-09, 06-12, 06-14]

tech-stack:
  added: []
  patterns:
    - "App Proxy subpath = 'smartdiscovery' (D-01) is the contract every storefront fetch URL references"

key-files:
  created:
    - .planning/phases/06-storefront-surface/06-03-SUMMARY.md
  modified:
    - shopify.app.toml

key-decisions:
  - "url uses the same ngrok hostname currently in application_url (dynamic dev URL); production deploy in plan 14 will replace ngrok with vercel host"

patterns-established: []

requirements-completed:
  - STR-03

duration: ~3min
completed: 2026-05-27
---

# Phase 06, Plan 03: App Proxy Block Summary

**Added [app_proxy] block to shopify.app.toml — routes /apps/smartdiscovery/* to /api/proxy/* via Shopify's signed-proxy.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-05-27
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `[app_proxy]` block added with `url`, `subpath = "smartdiscovery"`, `prefix = "apps"` per STR-03 and D-01
- 6/6 tests in `__tests__/shopify-toml.test.ts` flipped from RED → GREEN
- No other config touched: `application_url`, `client_id`, `scopes`, `redirect_urls` unchanged

## Task Commits

1. **Task 1: Add [app_proxy] block** — `9071283` (feat)

## Files Created/Modified
- `shopify.app.toml` — 5 lines appended after `[auth]` block

## Decisions Made
- None — followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- ✓ Shopify will route storefront fetches once plan 14 deploys via `shopify app deploy`
- ✓ App Proxy HMAC verification utility (plan 04) can now be wired to handle these signed requests

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
