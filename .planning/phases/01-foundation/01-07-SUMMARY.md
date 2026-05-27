# Plan 01-07 Summary

**Status:** complete
**Wave:** 3
**Requirements:** FND-03

## What shipped

New `proxy.ts` (33 lines) at project root — Next.js 16's `middleware.ts` replacement:

- Imports `NextRequest`, `NextResponse`, `shopifyClient`, `sessionStorage`
- `export async function proxy(request)` — reads `?shop=` query, loads offline session via `sessionStorage.loadSession(shopifyClient.session.getOfflineId(shop))`, redirects to `/api/auth` (with shop param when known) if no session, else `NextResponse.next()`
- No Bearer fallback (D-09)
- No `runtime` export (Next.js 16 throws on it per research Pitfall 1)
- No `console.log` (D-10)
- `export const config = { matcher: ['/onboarding/:path*', '/chat/:path*'] }` — D-08 embedded-pages-only scope
- Comment documents the Claude's Discretion choice: trust loaded session (no extra `session.shop === shop` revalidation)

Deleted: `middleware.ts`
Renamed: `__tests__/middleware.test.ts` → `__tests__/proxy.test.ts` (via `git mv`, history preserved). Updated imports/calls/describe block to `proxy`. Removed the Plan 01 TODO comment.

## Verification

- `bunx vitest run __tests__/proxy.test.ts` → 4/4 GREEN (allows-session-200, no-session-307, no-shop-307, no-shop-redirect-without-shop-param)
- `test ! -f middleware.ts` passes (file gone)
- All grep gates pass: 0 Bearer, 0 console.log, 0 runtime, 1 each matcher pattern, 1 `sessionStorage.loadSession`, 1 `NextResponse.redirect`

## Notes

The original `middleware.ts` had `export const runtime = 'nodejs'`; that line is intentionally absent from `proxy.ts` because Next.js 16 throws if it's set on a proxy file (per Pitfall 1 — proxy.ts always runs Node.js).

## Handoff

- Embedded admin pages `/onboarding/*` and `/chat/*` are now structurally protected — unauthenticated navigation 307s to `/api/auth`.
- API routes (`/api/shopify/sync`, future `/api/chat`, `/api/settings`) are protected separately via `withShopifySession` (Plan 02 + Plan 08), not by this proxy.
- Phase 6's storefront `/api/proxy/*` routes use App Proxy HMAC, also independent from this file.
