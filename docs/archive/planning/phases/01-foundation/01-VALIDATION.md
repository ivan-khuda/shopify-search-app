---
phase: 1
slug: foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
approved: 2026-05-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `bunx vitest run __tests__/middleware.test.ts app/api/shopify/sync/__tests__/route.test.ts lib/shopify/__tests__/auth.test.ts lib/db/repositories/__tests__/ProductRepository.test.ts` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~20 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds (quick), 60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-01 | TBD | 0 | FND-04, FND-05 | T-1-01 | Wave 0 test stubs created (auth + repository) | unit | `bunx vitest run lib/shopify/__tests__/auth.test.ts lib/db/repositories/__tests__/ProductRepository.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-02 | TBD | 1 | FND-01 | T-1-02 | Schema migration creates `shop` column on 5 product tables; pgvector extension preserved | manual smoke | `bunx prisma migrate dev --name foundation_shop_column` | N/A | ⬜ pending |
| 1-XX-03 | TBD | 1 | FND-01 | T-1-02 | Composite `(shop, id)` relations enforce cross-shop FK isolation | unit | `bunx vitest run lib/db/repositories/__tests__/ProductRepository.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-04 | TBD | 1 | FND-02 | T-1-03 | No `console.log` of session tokens, auth headers, or Bearer tokens in targeted files | static | `! grep -rn "console.log" middleware.ts app/api/auth/ "app/(embedded)/onboarding/page.tsx"` | N/A | ⬜ pending |
| 1-XX-05 | TBD | 1 | FND-05 | T-1-04 | `verifyShopSessionToken` throws `ShopifyAuthError` with exhaustive 5 error codes | unit | `bunx vitest run lib/shopify/__tests__/auth.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-06 | TBD | 1 | FND-05 | T-1-04 | `withShopifySession` wrapper converts `ShopifyAuthError` to `NextResponse.json` with correct status | unit | same | ❌ W0 | ⬜ pending |
| 1-XX-07 | TBD | 2 | FND-04 | T-1-05 | `ProductRepository.upsertProduct(shop, input)` wraps Product+Variants+Images+Options in single transaction | unit | `bunx vitest run lib/db/repositories/__tests__/ProductRepository.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-08 | TBD | 2 | FND-04 | T-1-05 | `findByShopAndId`, `listByShop`, `deleteProduct` only return/affect rows for given shop | unit | same | ❌ W0 | ⬜ pending |
| 1-XX-09 | TBD | 2 | FND-05 | T-1-04 | Sync route rewritten via `withShopifySession`; existing 5 error-code tests stay green | integration | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` | ✅ exists (mocks updated) | ⬜ pending |
| 1-XX-10 | TBD | 3 | FND-03 | T-1-06 | Middleware redirects unauthenticated requests to `/onboarding` and `/chat` to `/api/auth?shop=` | unit | `bunx vitest run __tests__/middleware.test.ts` | ✅ exists (updated for `?shop=` only) | ⬜ pending |
| 1-XX-11 | TBD | 3 | FND-03 | T-1-06 | Middleware allows authenticated requests through when offline session exists | unit | same | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/shopify/__tests__/auth.test.ts` — covers FND-05 (`verifyShopSessionToken` 5 error codes + happy path, `withShopifySession` wrapper)
- [ ] `lib/db/repositories/__tests__/ProductRepository.test.ts` — covers FND-04 (upsert+children in transaction, find/list/delete by shop, cross-shop isolation)
- [ ] `__tests__/middleware.test.ts` update — remove Bearer fallback tests (D-09 deletes that path), add `?shop=` missing redirect test, add valid-session pass-through test
- [ ] `app/api/shopify/sync/__tests__/route.test.ts` update — mock `verifyShopSessionToken` instead of `shopifyClient.session.decodeSessionToken` directly; keep 5 error-code assertions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Destructive Prisma migration applies cleanly on a fresh DB | FND-01 | `bunx prisma migrate dev` is interactive; CI runs it after reset | (1) `bunx prisma migrate reset --force` (2) `bunx prisma migrate dev --name foundation_shop_column` (3) verify `\d products` shows `shop NOT NULL` column; (4) `\dx vector` confirms pgvector extension exists |
| Embedded admin still loads through Shopify Admin iframe with `?shop=` param | FND-03 | Requires live Shopify Partner Dashboard dev store | Open dev store → install dev app → admin loads → ensure no redirect loop, ensure `/onboarding` and `/chat` open without errors |
| No tokens appear in `bun dev` console during local OAuth flow | FND-02 | Requires live OAuth flow to confirm | Run `bun dev`; install on dev store; grep stdout for "Bearer " or "token" — must be empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (auth.test.ts, ProductRepository.test.ts)
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 60s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after planner aligns task IDs to this map

**Approval:** pending
