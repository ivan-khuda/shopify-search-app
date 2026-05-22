# Plan 01-02 Summary

**Status:** complete
**Wave:** 1
**Requirements:** FND-05
**Commit:** `7f65a05` — `feat(01-02): implement lib/shopify/auth.ts with verifyShopSessionToken + withShopifySession`

## What shipped

`lib/shopify/auth.ts` — the shared Shopify session-token verifier and route wrapper that every embedded admin API route will use:

- `ShopifyAuthErrorCode` string union with the 5 enumerated codes (D-06)
- `ShopifyAuthError` class extending `Error` with `code` + `status` (401)
- `verifyShopSessionToken(req)` — decodes Bearer token, validates dest URL, derives shop hostname, validates `.myshopify.com` suffix, loads offline session
- `withShopifySession(handler)` — HOF that catches `ShopifyAuthError` and converts to `NextResponse.json({error: code}, {status: 401})`

The D-06 split between `invalid_dest` (missing or unparseable `payload.dest`) and `invalid_token` (decode failure) is implemented as two distinct throw sites — the original inline sync route at `app/api/shopify/sync/route.ts:5-41` collapsed both into `invalid_token`.

## Verification

- `bunx vitest run lib/shopify/__tests__/auth.test.ts` → 16/16 GREEN (Wave 0 RED stubs now pass)
- `grep -c "console.log" lib/shopify/auth.ts` → 0 (D-10)
- No logger replacement introduced

## Notes

The original parallel executor agent terminated without Bash access. The auth.ts file written by that agent was identical to what was needed; it was copied from the worktree (`.claude/worktrees/agent-a00f94f96fc2bd824/lib/shopify/auth.ts`) into the main working tree and committed there. Worktree branch removed.

## Handoff

- Plan 08 (Wave 3) rewrites `app/api/shopify/sync/route.ts` to use `withShopifySession` as the reference implementation
- Plan 07 (Wave 3) does NOT need this helper — proxy.ts uses `?shop=` query param, not Bearer header
- Phase 2+ embedded API routes (e.g., `/api/shopify/sync/status`, `/api/settings`) consume this helper
