# Phase 1: Foundation - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing scaffold secure, multi-tenant safe, and add a real data-access layer. Five concrete deliverables (FND-01..05): (1) every Prisma model that holds merchant data gains a `shop` column with index and the relations between Product ↔ Variant/Image/Option/Embedding become shop-scoped; (2) all `console.log` calls emitting session tokens, auth headers, or Bearer tokens are deleted; (3) `middleware.ts` re-enables session validation on embedded UI pages; (4) `ProductRepository` exposes a real transactional CRUD surface; (5) a shared `verifyShopSessionToken` helper replaces the inline auth logic in API routes.

Phase 1 ships nothing user-visible. It exists so every subsequent phase has a safe, single-tenant-leak-proof scaffold to build on. No sync logic, no embeddings, no UI work — those are Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Shop Schema Migration

- **D-01:** Use a single destructive migration: `DROP TABLE CASCADE` for `products`, `product_variants`, `product_images`, `product_options`, `product_embeddings`, then recreate with `shop String NOT NULL` from the start. No nullable→backfill→NOT NULL three-step. There is no production data; developer environments reset via `bunx prisma migrate reset`. Document the destructive nature in the migration's SQL comment.
- **D-02:** The `shop` value stored in every merchant-data row is the merchant's `myshopify.com` hostname as a plain `String` (e.g., `"example-store.myshopify.com"`). It is derived from the session-token `payload.dest` URL's `hostname` (already done in the existing sync route at `app/api/shopify/sync/route.ts:24-32`). This matches the existing `ShopifySession.shop` column shape — no UUID mapping table, no GID.

### Multi-Tenancy Enforcement

- **D-03:** Enforcement is exclusively at the repository / service signature level — `shop: string` is the first parameter of every method on every repository that touches merchant data (`ProductRepository.upsertProduct(shop, input)`, `listByShop(shop, opts)`, `findByShopAndId(shop, id)`, `deleteProduct(shop, id)`, etc.). No Prisma client extension, no `AsyncLocalStorage`, no automatic `where: { shop }` injection. The TypeScript signature is the contract; if a caller forgets `shop`, it's a compile error. Application-layer only — no PostgreSQL RLS (incompatible with Prisma Accelerate pooling, locked in `.planning/research/ARCHITECTURE.md`).
- **D-04:** Prisma relations between `Product` and its children (`ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding`) use composite keys `(shop, id)` so a child row cannot reference a parent in a different shop. Concretely: `Product` declares `@@unique([shop, id])` and each child declares `productId Int` + `productShop String` + a foreign key `references([shop, id])`. Children carry `shop` redundantly with the parent — the duplication is intentional and matches the structural guarantee. The migration enforces this at the database level.

### `verifyShopSessionToken` Contract

- **D-05:** The helper lives at `lib/shopify/auth.ts` and is invoked from every embedded-admin API route. It always loads the offline session as part of verification — there is no fast-path variant. Phase 2 polling endpoints will pay the DB hit; the optimization can wait until load profiling shows it matters.
- **D-06:** The helper signals failure by throwing a typed `ShopifyAuthError` (single class with a `code` and `status` field). Five codes are exhaustively enumerated: `missing_token` (401), `invalid_token` (401), `invalid_dest` (401), `invalid_shop_domain` (401), `no_offline_session` (401). On success it returns `{ shop: string, session: Session }` (the Shopify SDK `Session` object loaded from `sessionStorage`).
- **D-07:** A wrapper `withShopifySession(handler: (ctx: { shop, session, req }) => Promise<Response>): (req: Request) => Promise<Response>` is exported alongside the verifier. Route handlers use the wrapper so they never write `try/catch` for auth errors — the wrapper catches `ShopifyAuthError`, converts each code to its `NextResponse.json({ error: code }, { status })`, and lets the inner handler's body stay focused on real work. Existing `app/api/shopify/sync/route.ts` is rewritten via this wrapper as the reference implementation.

### Middleware Scope

- **D-08:** `middleware.ts` matcher is `['/onboarding/:path*', '/chat/:path*']` — only embedded UI page routes. API routes (`/api/chat`, `/api/shopify/*`) are NOT covered by the middleware; they call `verifyShopSessionToken` per route via the wrapper from D-07. Phase 6 will add `/api/proxy/*` routes which use App Proxy HMAC verification, not session-token middleware.
- **D-09:** On a matched route, middleware derives `shop` from `request.nextUrl.searchParams.get('shop')` only — Shopify Admin always appends `?shop=` to embedded URLs. No Bearer-header fallback (browser navigation doesn't send the header anyway, and any AJAX path is API-side and not covered by this middleware). When `shop` is missing or its offline session cannot be loaded, redirect to `/api/auth?shop=<derived-shop-or-blank>`. When the session exists, `NextResponse.next()`.
- **D-10:** All `console.log` calls that currently emit `authHeader`, `shop`, `token`, or any session-token-derived value in `middleware.ts`, `app/api/auth/`, and `app/(embedded)/onboarding/` are deleted outright — no replacement logger introduced in this phase. Structured logging is a separate concern for a later milestone. Only delete; do not silence with `if (DEBUG)`.

### Claude's Discretion

- Whether to seed an initial `shop` value during local dev (for `bunx prisma db seed`) — pick a sensible placeholder hostname.
- Whether composite-key relations need to be expressed as Prisma `@relation` blocks or via raw indexes plus app-layer assertions — pick whichever Prisma 7.3 supports most idiomatically; the structural guarantee matters more than syntax.
- `ProductRepository` transaction boundary: each method (`upsertProduct`) wraps its own `prisma.$transaction` for the Product + children write. No outer-transaction parameter for V1 — keep the API simple.
- Whether to colocate `ShopifyAuthError` in `lib/shopify/auth.ts` or split into `lib/shopify/errors.ts` — implementer's call.
- Whether middleware also re-validates the `shop` query against the loaded session's shop (defense-in-depth) or trusts the loaded session — pick the safer of the two if no perf cost.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Core Value, V1 scope, Out of Scope, Key Decisions table
- `.planning/REQUIREMENTS.md` — FND-01..05 are the formal requirements covered by this phase
- `.planning/ROADMAP.md` §"Phase 1: Foundation" — phase goal, success criteria, depends-on chain

### Research
- `.planning/research/SUMMARY.md` — Phase 1 placement in the 8-phase build order; "Foundation unblocks everything"
- `.planning/research/ARCHITECTURE.md` §"Multi-tenancy" — application-layer enforcement only, Prisma Accelerate incompatibility with PostgreSQL RLS
- `.planning/research/PITFALLS.md` §"Shopify-specific" — session-token validation edge cases (clock skew, dest URL parsing); §"Webhook + manual sync race" forewarns Phase 2 patterns to make compatible

### Codebase Snapshot
- `.planning/codebase/ARCHITECTURE.md` §"Anti-Patterns: Commented-Out Middleware Logic" and §"Mock Products in UI Logic" — the exact shape of what Phase 1 is fixing
- `.planning/codebase/CONCERNS.md` §"Console Logging of Auth Tokens" and §"Middleware Auth Check Is Disabled" — the security debt being repaid
- `.planning/codebase/CONVENTIONS.md` §"Error Handling" — existing `Response.json({error}, {status})` pattern that `withShopifySession` wraps
- `.planning/codebase/STACK.md` — pinned Prisma 7.3 + adapter-pg behavior; Vitest 4 for test placement

### Source Anchors (existing code being modified)
- `middleware.ts` — file being re-enabled; current state is commented-out auth + token-logging `console.log` statements
- `app/api/shopify/sync/route.ts:5-41` — inline auth logic that becomes the reference for `verifyShopSessionToken`
- `prisma/schema.prisma` — schema being modified; `Product`/`ProductVariant`/`ProductImage`/`ProductOption`/`ProductEmbedding` rewritten; `ShopifySession.shop` stays as the shape reference for the new column
- `lib/db/repositories/ProductRepository.ts` — 9-line stub being replaced with the real CRUD surface
- `lib/shopify/client.ts`, `lib/shopify/session-storage.ts` — existing helpers that `lib/shopify/auth.ts` builds on (do not touch)
- `app/api/auth/route.ts`, `app/api/auth/callback/route.ts`, `app/(embedded)/onboarding/page.tsx` — additional locations where `console.log` of tokens/shop/headers must be deleted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shopifyClient.session.decodeSessionToken` and `shopifyClient.session.getOfflineId` — already used in `app/api/shopify/sync/route.ts` and `middleware.ts`; `lib/shopify/auth.ts` consolidates those calls instead of replacing them.
- `sessionStorage.loadSession(sessionId)` from `lib/shopify/session-storage.ts` — already returns the `Session` object; `verifyShopSessionToken` re-uses it directly.
- Vitest test scaffolding in `app/api/shopify/sync/__tests__/route.test.ts` and `app/api/auth/__tests__/route.test.ts` — patterns for mocking `shopifyClient`, `sessionStorage`, and `NextResponse` to copy when writing tests for `lib/shopify/auth.ts` and `middleware.ts`.

### Established Patterns
- Singleton exports for SDK clients (`prisma`, `shopifyClient`, `sessionStorage`, `productRepository`) — `verifyShopSessionToken` and `withShopifySession` are exported as plain functions (no class), matching `lib/utils.ts:cn` style rather than the class-based `ProductRepository`.
- `Response.json({error: <code>}, {status: <n>})` is the canonical error shape — `withShopifySession` emits this exact shape so existing tests against API routes continue to pass.
- `@/` path alias (`tsconfig.json`) — all new imports use it. `lib/shopify/auth.ts` is imported as `from '@/lib/shopify/auth'`.

### Integration Points
- `verifyShopSessionToken` will be called from: `app/api/shopify/sync/route.ts` (now), `app/api/shopify/sync/status/route.ts` (Phase 2), `app/api/shopify/webhook/route.ts` (Phase 2 — note: webhook uses HMAC, not session token, so this helper may NOT apply there), `/api/chat/route.ts` (when wired to admin auth in Phase 4), `/api/settings/*` (Phase 7).
- `ProductRepository` CRUD methods will be consumed by: `services/shopify/ShopifyProductService` (Phase 2 sync), `services/search/SearchService` (Phase 4), `/api/proxy/*` storefront routes (Phase 6).
- The destructive Prisma migration is the last destructive change planned — Phase 2+ migrations must be additive (new tables: `SyncRun`, `ShopSettings`, `Conversation`, `SavedProduct`, `RequestCounter`; new columns on `ProductEmbedding` like `modelVersion`).

</code_context>

<specifics>
## Specific Ideas

- `withShopifySession` wrapper pattern is the user's chosen style — the existing 35-line auth-step ladder in `app/api/shopify/sync/route.ts` should be reduced to a one-line wrapper invocation as the reference rewrite.
- The 5 error codes (`missing_token`, `invalid_token`, `invalid_dest`, `invalid_shop_domain`, `no_offline_session`) come directly from the existing sync route's return values — they're locked, not new.
- Existing test file `app/api/shopify/sync/__tests__/route.test.ts` exercises each of those 5 error paths — Phase 1 must keep those tests green (likely by updating the test to mock `verifyShopSessionToken` instead of mocking `shopifyClient.session.decodeSessionToken` directly).

</specifics>

<deferred>
## Deferred Ideas

- **Structured logger (pino/winston) to replace `console.log` outright** — out of scope for Phase 1 (delete-only). Track for a later observability milestone if needed.
- **Per-request rate limiting on auth endpoints** — surfaced in `CONCERNS.md` but Phase 8 (Hard Cap) is the formal home for cap/rate concerns.
- **Defense-in-depth Prisma client extension** that throws when a query against merchant tables lacks a `shop` filter — considered and explicitly rejected for Phase 1 to keep the foundation simple; revisit if a future incident proves repository-only enforcement insufficient.
- **PostgreSQL Row-Level Security (RLS)** — globally out of scope per `.planning/research/ARCHITECTURE.md` (incompatible with Prisma Accelerate connection pooling).
- **Fast-path `verifyToken` variant without offline-session DB hit** for high-throughput Phase 2 polling endpoints — revisit if SyncRun status polling profiling shows the DB hit dominates.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-22*
