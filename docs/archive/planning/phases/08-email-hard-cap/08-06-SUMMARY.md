---
phase: 08-email-hard-cap
plan: 06
subsystem: shopify-service-layer
tags: [phase-08, shopify, graphql, notifications]
requires: [08-01, 08-03]
provides: [fetchShopContactEmail, SHOP_CONTACT_EMAIL_QUERY]
affects: [services/shopify, inngest/sync-step-onError]
tech-stack:
  added: []
  patterns: ["GraphQL client invocation (mirrors ShopifyProductService.ts)", "defensive null-coalesce", "swallow-and-return-null error handling (D-05)"]
key-files:
  created: ["services/shopify/ShopifyShopService.ts"]
  modified: ["services/shopify/__tests__/ShopifyShopService.test.ts"]
decisions:
  - "D-05 honored: every failure mode returns null — non-failing skip for the auxiliary email step"
  - "Pitfall 6 honored: bare `catch {}` (no error binding), zero console.* in file — contactEmail is PII"
  - "Open Question 2 (scope): existing `read_products` scope is sufficient; `read_shop_data` deferred to verification gate 08-15 if runtime scope error surfaces"
metrics:
  duration: ~3 min
  completed: 2026-05-27
---

# Phase 8 Plan 06: Implement ShopifyShopService.fetchShopContactEmail Summary

GraphQL helper that fetches `shop.contactEmail` from the Shopify Admin API, drives Wave 0 RED tests in `services/shopify/__tests__/ShopifyShopService.test.ts` to GREEN, and decouples the query from the Inngest sync function so it can be unit-tested in isolation.

## File Shape

**`services/shopify/ShopifyShopService.ts`** (58 lines):
- `export const SHOP_CONTACT_EMAIL_QUERY` — `query ShopContactEmail { shop { contactEmail } }`
- `export async function fetchShopContactEmail(session: Session): Promise<string | null>`
  - Imports `shopifyClient` from `@/lib/shopify/client` and `Session` type from `@shopify/shopify-api`
  - Instantiates `new shopifyClient.clients.Graphql({ session })` (mirrors `ShopifyProductService.fetchProductBatch`)
  - Calls `client.request<{ shop?: { contactEmail?: string | null } }>(SHOP_CONTACT_EMAIL_QUERY)`
  - Returns `email && email.length > 0 ? email : null` — non-empty string only
  - Bare `catch {}` block — swallows all errors and returns null (D-05; no error binding to prevent PII logging)
  - Zero `console.*` calls

## Wave 0 Status Flip

| Test | Before | After |
|------|--------|-------|
| returns the contactEmail on happy path | RED (module missing) | GREEN |
| returns null when shop.contactEmail is null | RED | GREEN |
| returns null when shop.contactEmail is an empty string | RED | GREEN |
| returns null when the GraphQL client throws | RED | GREEN |
| returns null when the response shape is malformed | RED | GREEN |
| issues a GraphQL query mentioning shop { contactEmail } | RED | GREEN |

**Test Files: 1 passed | Tests: 6 passed | Duration: 982ms**

## Verification

- `bunx vitest run services/shopify/__tests__/ShopifyShopService.test.ts` — 6/6 GREEN
- `bunx tsc --noEmit | grep ShopifyShopService` — empty (no type errors)
- `grep -nE '(^|[^.\`*])console\.' services/shopify/ShopifyShopService.ts` — empty (the only "console" string in the file is a JSDoc reference to the forbidden pattern)

## Threat Model Coverage

| Threat ID | Mitigation Applied |
|-----------|---------------------|
| T-08-06-I1 (PII leak via error logging) | Bare `catch {}` (no error binding); zero `console.*` in file |
| T-08-06-T1 (GraphQL response shape skew) | Defensive `response.data?.shop?.contactEmail` + empty-string coalesce |
| T-08-06-D1 (Sync hangs on GraphQL outage) | Exception → returns null → caller skips email step; sync result unaffected |

## Decisions Made

- **D-05 (non-failing skip):** Every failure mode — missing field, null value, empty string, malformed response, thrown error — coalesces to `null`. The Inngest sync function will treat `null` as "no recipient available, skip email" rather than propagating the failure.
- **Plan-vs-prompt conflict (resolved in favor of plan + tests):** The spawn prompt's `<execution_contract>` instructed throwing a structured Error on malformed responses / GraphQL errors. The plan's `<behavior>` block, the threat model (T-08-06-D1), Decision D-05, and the test contract ("returns null when the GraphQL client throws (D-05 — does NOT bubble)") all require the opposite — return null, never throw. The plan and tests took precedence; the prompt's throw-on-error instruction was overridden by the contract anchored in the test file.
- **Pitfall 6 (PII in logs):** `catch {}` is intentionally bare. Binding `catch (err)` would tempt future code to log it, and Shopify GraphQL error responses can echo back the queried shop email. Zero console.* anywhere in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed stale `@ts-expect-error` directives from Wave 0 test scaffold**
- **Found during:** Task 1 verification (`bunx tsc --noEmit`)
- **Issue:** Six `@ts-expect-error — RED scaffold` directives in `services/shopify/__tests__/ShopifyShopService.test.ts` raised `TS2578: Unused '@ts-expect-error' directive` once the implementation module existed. These directives were placed exactly to be removed at this point per the test file's own header comment.
- **Fix:** Removed all 6 directives (and accompanying `eslint-disable-next-line @typescript-eslint/ban-ts-comment` comments) from the test file. The dynamic `await import()` calls now type-resolve cleanly.
- **Files modified:** `services/shopify/__tests__/ShopifyShopService.test.ts`
- **Commit:** a1c1d56

## Authentication Gates

None — implementation used existing offline session contract; no live Shopify calls made during this plan.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `services/shopify/ShopifyShopService.ts` exists (FOUND)
- [x] Commit `a1c1d56` exists in git log (FOUND)
- [x] All 6 tests in `ShopifyShopService.test.ts` GREEN
- [x] Zero `console.*` invocations in implementation file
- [x] Zero `tsc --noEmit` errors mentioning `ShopifyShopService`

## TDD Gate Compliance

This plan was authored as a Wave 4 implementation against Wave 0 RED tests already committed in plan 08-01. The RED → GREEN gate sequence is therefore split across plans:

- **RED commit:** plan 08-01 (`test(...)` adding `ShopifyShopService.test.ts` scaffold) — present in git history
- **GREEN commit:** `a1c1d56` `feat(08-06-01): add ShopifyShopService.fetchShopContactEmail (D-05)` — this plan
- **REFACTOR:** not required; implementation is minimal and consistent with ShopifyProductService.ts patterns
