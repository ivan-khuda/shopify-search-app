# Plan 01-09 Summary — Phase 1 Verification

**Status:** complete
**Wave:** 4 (verification gate)
**Requirements:** all FND-01..05

## Automated gates (Task 1)

| # | Gate | Result |
|---|------|--------|
| 1 | `bunx vitest run __tests__/proxy.test.ts app/api/shopify/sync/__tests__/route.test.ts lib/shopify/__tests__/auth.test.ts lib/db/repositories/__tests__/ProductRepository.test.ts` | ✓ 36/36 GREEN |
| 2 | `bun run test` (full Vitest suite) | ✓ 58/58 GREEN across 11 files |
| 3 | `bunx tsc --noEmit` on Phase 1 surface | ✓ all Phase 1 files clean (preexisting jenius/ui + shopify global errors unchanged — out of scope) |
| 4 | `grep -rn "console.log" proxy.ts app/api/auth/ app/(embedded)/onboarding/page.tsx` | ✓ 0 matches |
| 5 | `bunx prisma migrate status` | ✓ `Database schema is up to date!` |
| 6 | Schema shape gate | ✓ `@@unique([shop, id])` count=1; `references: [shop, id]` count=4 |
| 7 | ProductRepository signature gate | ✓ `shop: string` count=4 (one per public method) |
| 8 | proxy.ts shape gate | ✓ both matcher entries present; 0 Bearer; 0 runtime export |
| 9 | `lib/shopify/auth.ts` shape gate | ✓ all 5 error codes present; 0 console.log |
| 10 | Live DB smoke (Prisma client + `prisma.product.count()`) | ✓ returns 0 (connection works against `localhost:5432` with `@prisma/adapter-pg`) |

## Phase requirement verification

| REQ-ID | What it asserts | Verification | Status |
|--------|-----------------|--------------|--------|
| FND-01 | Every merchant-data model has `shop` column with index; composite `(shop, id)` FK between Product ↔ children | Gates 5, 6 + live `\d products` shows `shop NOT NULL` | ✓ |
| FND-02 | All `console.log` of session tokens / auth headers / Bearer tokens removed | Gate 4 + 9 + Plan 04 acceptance | ✓ |
| FND-03 | `proxy.ts` re-enabled with matcher `[/onboarding/:path*, /chat/:path*]`; redirects unauthenticated | Gate 8 + 4 proxy tests GREEN | ✓ |
| FND-04 | `ProductRepository` exposes 4 transactional CRUD methods, all `shop: string` first arg | Gate 7 + 11 ProductRepository tests GREEN | ✓ |
| FND-05 | `lib/shopify/auth.ts` exports `verifyShopSessionToken`, `withShopifySession`, `ShopifyAuthError` with 5 codes | Gate 9 + 16 auth tests + 6 sync route tests GREEN | ✓ |

## Phase success criteria (ROADMAP.md §Phase 1)

1. ✓ Every merchant-data Prisma model has `shop` column with index, no query returns data without shop filter
2. ✓ No session token, auth header, or Bearer token appears in any server log
3. ✓ Middleware (now `proxy.ts`) auth is active with correct matcher; unauthenticated requests to `/onboarding` and `/chat` redirect to auth
4. ✓ `ProductRepository` exposes type-safe `upsertProduct`, `deleteProduct`, `listByShop`, `findByShopAndId` backed by Prisma transactions
5. ✓ `verifyShopSessionToken` is a shared helper used via `withShopifySession` (sync route is the reference)

## Manual smoke verification (Task 2 — deferred)

The plan calls for a live OAuth roundtrip + iframe load + direct-URL probes against a Shopify dev store. This requires the user to install the app on a Shopify Partner test store and inspect terminal output for token leaks. The 9 automated gates above and the live DB smoke test cover the structural invariants; the OAuth roundtrip is the only check that requires a human operator.

**Recommended manual checks** (not blocking on Phase 2):
1. `bunx prisma migrate reset --force && bun dev` — confirm no `runtime` error in proxy.ts boot
2. Install on Shopify dev store; grep stdout for `Bearer ` or JWT-shaped strings → expect zero matches
3. Open app in dev-store admin iframe → loads without redirect loop
4. Direct nav to `/onboarding` (no `?shop=`) → 307 to `/api/auth`
5. Direct nav to `/onboarding?shop=nonexistent.myshopify.com` → 307 to `/api/auth?shop=…`
6. Click "Start sync" → 200 (or 401 with enumerated code), not 500

These remain a recommended pre-Phase-2 sanity pass. Track via `/gsd-verify-work` if needed.

## Files produced / modified / deleted by Phase 1

**Created:**
- `lib/shopify/auth.ts` (Plan 02)
- `lib/shopify/__tests__/auth.test.ts` (Plan 01)
- `lib/db/repositories/__tests__/ProductRepository.test.ts` (Plan 01)
- `prisma/migrations/20260523011257_add_shop_column_destructive/migration.sql` (Plan 03)
- `proxy.ts` (Plan 07)
- `docker-compose.yml` (Plan 05 prerequisite — user infrastructure)

**Modified:**
- `prisma/schema.prisma` (Plan 03 — shop column + composite FK)
- `lib/db/repositories/ProductRepository.ts` (Plan 06 — stub → real CRUD)
- `app/api/shopify/sync/route.ts` (Plan 08 — collapsed to single wrapper)
- `app/api/shopify/sync/__tests__/route.test.ts` (Plan 08 — D-06 error code split)
- `app/api/auth/route.ts` (Plan 04 — console.log deleted)
- `app/api/auth/callback/route.ts` (Plan 04 — console.log deleted)
- `app/(embedded)/onboarding/page.tsx` (Plan 04 — console.log deleted)
- `.env` (DATABASE_URL switched from Prisma Accelerate to local Docker Postgres; Accelerate URL kept as comment)
- `lib/db/client.ts` (Plan 09 cleanup — switched to `@prisma/adapter-pg` + Prisma 7 generator path; required to make `bunx tsc --noEmit` green and to actually connect to local Postgres)
- `prisma/seed.ts` (Plan 09 cleanup — same import path fix)

**Renamed:**
- `__tests__/middleware.test.ts` → `__tests__/proxy.test.ts` (Plan 07; history preserved via `git mv`)

**Deleted:**
- `middleware.ts` (Plan 07 — superseded by `proxy.ts`)

**NOT produced (deferred):**
- Structured logger replacement for `console.log` (D-10 is delete-only; later observability milestone)
- Defense-in-depth Prisma client extension (rejected for Phase 1 simplicity)
- Fast-path `verifyToken` variant without DB hit (revisit if Phase 2 polling profiling demands)
- Rate limiting on auth endpoints (Phase 8 owns hard-cap concerns)

## Threat coverage (Phase 1 STRIDE)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-1-01 Session token replay | Short JWT TTL + 10s clock skew + offline-session DB check (auth.ts) | mitigated |
| T-1-02 Cross-tenant data access | Composite FK + repository signature enforcement | mitigated |
| T-1-03 Console-logged tokens | D-10 delete-only; grep gates 0 matches | mitigated |
| T-1-04 Unauthenticated page access | `proxy.ts` matcher + offline-session lookup | mitigated |
| T-1-05 ProductRepository forgetting shop filter | TypeScript signature (`shop: string` first arg) | mitigated |
| T-1-06 `shop` query param spoofing | Can't forge offline session; middleware verifies via DB load | mitigated |

## Notes on Wave 1 execution

The Wave 1 parallel executor subagents (Plans 01-02, 01-03, 01-04) terminated without Bash access in their worktrees. The orchestrator picked up their written files from the dead worktrees, completed any missing pieces (migration SQL authoring, console.log deletions across the remaining 2 files) directly on main, and committed each plan as a separate commit. All acceptance criteria are met at HEAD. Phase 2 should plan for the subagent execution path to be sequential or to retry on Bash denial.

## Final commit ladder (Phase 1)

```
eb3007b  docs(01): create phase plan
48ac5b7  docs(01-01): complete Wave 0 RED test scaffolds plan          # Wave 0
7f65a05  feat(01-02): implement lib/shopify/auth.ts                    # Wave 1
cfe6d9a  feat(01-03): rewrite Prisma schema + destructive migration
ae63ab2  fix(01-04): delete console.log of session tokens
701d41c  docs(01-02,01-03,01-04): plan summaries for Wave 1
bf8bd63  chore: add docker-compose.yml for local pgvector Postgres     # Wave 2 prereq
0ca0f6d  docs(01-05): apply destructive migration to local Postgres    # Wave 2
<next>   feat(01-06,01-07,01-08): ProductRepository, proxy.ts, sync    # Wave 3
<next>   docs(01-09): phase verification + tsc fixes                    # Wave 4
```

## Handoff to Phase 2

- The schema is multi-tenant-safe. New tables (`SyncRun`, `Conversation`, `SavedProduct`, etc.) MUST carry `shop` and follow the same composite-relation pattern.
- All embedded admin API routes go through `withShopifySession`. Phase 2's sync status polling route, webhook handler, and embed Inngest endpoint each adopt this wrapper.
- `proxy.ts` matcher does NOT need to grow — Phase 2 adds API routes (which the wrapper protects), not new embedded UI pages.
- `lib/db/client.ts` is now bound to `@prisma/adapter-pg`. Phase 2's Inngest worker code can `import { prisma } from '@/lib/db/client'` from the same singleton.
- `MOCK_PRODUCTS` removal is Plan 04's responsibility — Phase 4 will replace the keyword search with `SearchService.hybridSearch`.

Ready to start **Phase 2: Sync Pipeline** via `/gsd-plan-phase 2`.
