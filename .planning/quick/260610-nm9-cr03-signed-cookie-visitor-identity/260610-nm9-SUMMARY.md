---
phase: quick-260610-nm9
plan: "01"
subsystem: identity
tags: [security, auth, visitor-identity, hmac, app-proxy, cr-03]
dependency_graph:
  requires: []
  provides:
    - lib/identity/visitor-signature.ts
    - app/api/proxy/_meta/visitor/route.ts
    - lib/chat-ui/identity/visitor-bootstrap.ts
  affects:
    - lib/shopify/app-proxy-auth.ts
    - app/api/proxy/chat/route.ts
    - app/api/proxy/conversations/route.ts
    - app/api/proxy/conversations/[id]/route.ts
    - app/api/proxy/saved-products/route.ts
    - app/api/proxy/saved-products/[productId]/route.ts
    - lib/chat-ui/adapters/storefront.ts
    - extensions-src/chat-drawer/entry.tsx
tech_stack:
  added:
    - node:crypto HMAC-SHA256 for visitor-id signing (server-only)
  patterns:
    - namespace-isolated key derivation (HMAC(namespace, apiSecret) → signingKey)
    - signed-body-token transport (App Proxy strips Set-Cookie; body token delivers same security property)
    - constant-time comparison with timingSafeEqual + length pre-guard
key_files:
  created:
    - lib/identity/visitor-signature.ts
    - lib/identity/__tests__/visitor-signature.test.ts
    - app/api/proxy/_meta/visitor/route.ts
    - app/api/proxy/_meta/visitor/__tests__/route.test.ts
    - lib/chat-ui/identity/visitor-bootstrap.ts
    - lib/chat-ui/identity/__tests__/visitor-bootstrap.test.ts
  modified:
    - lib/shopify/app-proxy-auth.ts
    - lib/shopify/__tests__/app-proxy-auth.test.ts
    - app/api/proxy/chat/route.ts
    - app/api/proxy/chat/__tests__/route.test.ts
    - app/api/proxy/conversations/route.ts
    - app/api/proxy/conversations/__tests__/route.test.ts
    - app/api/proxy/conversations/[id]/route.ts
    - app/api/proxy/conversations/[id]/__tests__/route.test.ts
    - app/api/proxy/saved-products/route.ts
    - app/api/proxy/saved-products/__tests__/route.test.ts
    - app/api/proxy/saved-products/[productId]/route.ts
    - app/api/proxy/saved-products/[productId]/__tests__/route.test.ts
    - lib/chat-ui/adapters/storefront.ts
    - lib/chat-ui/__tests__/storefront-adapter.test.ts
    - lib/chat-ui/stores/__tests__/db-backed.test.ts
    - extensions-src/chat-drawer/entry.tsx
decisions:
  - "Signed-body-token transport: App Proxy strips Set-Cookie headers, so the signed visitor token travels in the JSON body rather than as an HTTP cookie. The HMAC-SHA256 signature (keyed on a SHOPIFY_API_SECRET-derived namespace key) delivers the same security property — the id is unforgeable and server-attested."
  - "Client stores and sends the full signed token uuid.hexSig as visitor_id; server verifies and uses only the extracted bare uuid for DB keying — signature is a transport-auth concern, not a stored value."
  - "Namespace key derivation: derivedKey = HMAC-SHA256('smartdiscovery:visitor-id:v1', SHOPIFY_API_SECRET) — isolates visitor signing from direct API secret use for a clean future secret-reuse audit."
  - "Bootstrap order (client): in-memory → localStorage → fetch /_meta/visitor — legacy bare UUIDs in localStorage pass through to server which returns 401 invalid_visitor_signature, forcing a re-mint on next request."
metrics:
  duration: "24 minutes"
  completed: "2026-06-10T15:31:05Z"
  tasks: 3
  files: 22
---

# Quick Task 260610-nm9: CR-03 Signed Visitor Identity Summary

**One-liner:** Server-minted HMAC-SHA256 visitor tokens (uuid.hexSig) verified on every App Proxy route before rate-limiting or DB access, with a shared client bootstrap replacing duplicate localStorage/randomUUID identity logic.

## Tasks Completed

### Task 1 — Server-side visitor signing + verification helper

Created `lib/identity/visitor-signature.ts` with three exports:
- `mintSignedVisitorId()`: mints a new server-signed token using `crypto.randomUUID()` + HMAC
- `signVisitorId(uuid)`: deterministically signs a given uuid (for test helpers)
- `verifyVisitorId(token)`: verifies a signed token with constant-time comparison; rejects bare UUIDs (legacy format), tampered tokens, empty strings, and tokens when the secret is unset

Key design choices:
- Namespace key derivation isolates visitor-id signing: `derivedKey = HMAC-SHA256('smartdiscovery:visitor-id:v1', SHOPIFY_API_SECRET)`
- `timingSafeEqual` with length pre-check (throws on unequal lengths)
- No dots in UUID → splitting on last dot separates uuid from sig cleanly
- Bare UUID (no dot) → returns `{valid: false}` — forces legacy localStorage values to be re-minted

15 tests green.

### Task 2 — Verification wired into App Proxy auth layer + all 5 routes + mint endpoint

Added to `lib/shopify/app-proxy-auth.ts`:
- `resolveVerifiedVisitorId(rawVisitorId)` — shared gate called by every proxy route after HMAC
- `invalid_visitor_signature` error code → 401

Created `app/api/proxy/_meta/visitor/route.ts`:
- GET endpoint behind `withAppProxyHmac`, per-shop rate-limit (`shop:${shop}` 'read' bucket), no DB writes
- Returns `{ visitor_id: mintSignedVisitorId() }` with `Cache-Control: no-store`

All 5 proxy routes updated:
- `app/api/proxy/chat/route.ts`
- `app/api/proxy/conversations/route.ts`
- `app/api/proxy/conversations/[id]/route.ts`
- `app/api/proxy/saved-products/route.ts`
- `app/api/proxy/saved-products/[productId]/route.ts`

Each route: after HMAC, before rateLimit/Prisma, calls `resolveVerifiedVisitorId` → 400 on missing, 401 on invalid signature. Extracts bare uuid and uses it for rate-limit key, conversation/saved-product DB writes, and `mergeVisitorIntoCustomer`.

All 7 affected test files updated with signed tokens (`signVisitorId(VISITOR_UUID)` in `beforeEach`) and a per-route CR-03 negative test. 65 tests pass.

### Task 3 — Client bootstrap; rewrite adapter, stores, entry

Created `lib/chat-ui/identity/visitor-bootstrap.ts`:
- `resolveSignedVisitorId()`: async, memoized per page load — in-memory → localStorage → `fetch('/apps/smartdiscovery/_meta/visitor')`
- WR-10 preserved: `safeGet`/`safeSet` guard localStorage throws; in-memory fallback keeps token stable
- Never calls `crypto.randomUUID()` — server is the sole minter (IN-08)

Rewrote `lib/chat-ui/adapters/storefront.ts`:
- `getRequestBody()` awaits `resolveSignedVisitorId()` instead of calling `crypto.randomUUID()`
- All other logic (customer_id injection, SSR guard) unchanged

Updated `extensions-src/chat-drawer/entry.tsx`:
- `mount()` is now async; awaits `resolveSignedVisitorId()` before first render
- Removed `resolveVisitorId`, `STORAGE_KEY`, `safeStorageGet`, `safeStorageSet` — IN-03 collapsed
- On bootstrap failure: degrades to empty string, drawer still mounts (WR-10)

Updated test files: storefront-adapter mocks `resolveSignedVisitorId`; db-backed uses signed-token-shaped VISITOR_ID. 29 tests pass.

## Deviations from Plan

### Intentional Transport Deviation (D-CR03)

**Found during:** Plan design (documented in plan objective)
**Issue:** The project constraint says "Anonymous visitor (signed cookie)" — but Shopify App Proxy strips both `Set-Cookie` and `Cookie` headers on every proxied response/request. A literal HTTP cookie is impossible through the App Proxy boundary.
**Fix:** Implemented the security INTENT of the "signed cookie" constraint using a signed JSON body token. HMAC-SHA256 over the visitor uuid keyed on a SHOPIFY_API_SECRET-derived namespace key delivers the same unforgeable, server-attested identity property. Token travels in the JSON body; client persists in localStorage with in-memory WR-10 fallback.
**Files modified:** `lib/identity/visitor-signature.ts` (deviation comment at top), `lib/chat-ui/identity/visitor-bootstrap.ts` (cross-reference comment)
**Commits:** 4236d1c, 60755b5, 1184d92

### Auto-fixed Issues

None beyond the planned scope.

## Known Stubs

None. All endpoints and client paths are fully wired.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-unauthenticated-endpoint | app/api/proxy/_meta/visitor/route.ts | New GET endpoint reachable by any storefront visitor via App Proxy. Mitigated by HMAC verification + per-shop rate-limit (T-nm9-06 in plan: accepted). |

## Test Results

```
bunx vitest run lib/identity app/api/proxy lib/shopify/__tests__/app-proxy-auth.test.ts lib/chat-ui
Test Files  20 passed (20)
Tests  146 passed (146)
```

Full suite (vitest):
```
Test Files  61 passed | 1 failed (pre-existing: app/api/auth Prisma client not generated) | 1 skipped
Tests  463 passed | 5 skipped
```

Zero regressions. The 1 failed test file (`app/api/auth/__tests__/route.test.ts`) was already failing before this task — it fails due to missing Prisma generated client (`.prisma/client/default` not found), unrelated to visitor identity.

TypeScript: `bunx tsc --noEmit` — no new errors in any file created or modified by this task. Pre-existing errors in unrelated files (Prisma generated client missing, `@jenius/ui` external package, `reasoning.tsx`) are out of scope.

## Self-Check: PASSED

Files exist:
- lib/identity/visitor-signature.ts: FOUND
- lib/identity/__tests__/visitor-signature.test.ts: FOUND
- app/api/proxy/_meta/visitor/route.ts: FOUND
- lib/chat-ui/identity/visitor-bootstrap.ts: FOUND

Commits exist:
- 4236d1c: feat(quick-260610-nm9-01): add HMAC-signed visitor identity helper
- 60755b5: feat(quick-260610-nm9-01): wire HMAC visitor verification into all proxy routes + mint endpoint
- 1184d92: feat(quick-260610-nm9-01): client bootstrap for server-signed visitor token
