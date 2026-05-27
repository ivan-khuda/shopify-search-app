# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 1-Foundation
**Areas discussed:** Shop migration strategy, Multi-tenancy enforcement, verifyShopSessionToken contract, Middleware matcher scope

---

## Shop Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Destructive (drop+recreate) | Single migration drops + recreates with `shop NOT NULL`. Developers reset with `bunx prisma migrate reset`. | ✓ |
| Additive: nullable → backfill → NOT NULL | Three-step migration. Safer if seed data already exists. | |
| Hybrid: TRUNCATE + drop+recreate | Preserves prior migration indexes/triggers. | |

**User's choice:** Destructive (drop+recreate)
**Notes:** No production data exists; sync pipeline is stubbed. Single migration is acceptable.

| Option | Description | Selected |
|--------|-------------|----------|
| myshopify.com hostname as string | Derived from session-token `payload.dest` hostname. Matches existing `ShopifySession.shop`. | ✓ |
| Shopify shop GID (`gid://shopify/Shop/...`) | GraphQL ID. Domain-independent but requires extra query at first auth. | |
| Internal UUID with Shop mapping table | New table; `shop` columns become FKs. More complex. | |

**User's choice:** myshopify.com hostname as string

---

## Multi-Tenancy Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Repository signatures: `shop` as required argument | TypeScript-level guarantee; cannot forget at call site. | ✓ |
| Prisma client extension with AsyncLocalStorage | Auto-injects `where: {shop}`; more magic, no forgetting even in ad-hoc queries. | |
| Both: repository required + Prisma extension as safety net | Highest protection. | |

**User's choice:** Repository signatures only
**Notes:** Application-layer-only enforcement aligns with PROJECT.md and research/ARCHITECTURE.md (RLS rejected due to Prisma Accelerate pooling).

| Option | Description | Selected |
|--------|-------------|----------|
| Composite key `(shop + id)` in relations | Prisma `references([shop, id])`; structurally prevents cross-shop child references. | ✓ |
| Single FK + runtime check in repository | `productId → product.id` as today; repo asserts `parent.shop == child.shop`. | |
| Tenant-suffixed indexes without composite FK | Index for perf, no referential cross-shop guarantee. | |

**User's choice:** Composite key in relations

---

## `verifyShopSessionToken` Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Throw typed error class + helper wrapper | `withShopifySession(handler)` catches `ShopifyAuthError` and emits `NextResponse.json`. | ✓ |
| `Result<Success, Failure>` discriminated union | Explicit `if (!r.ok) return r.response` in each route. | |
| Pair: helper returns data or null + separate error-response builder | Caller wraps in try/catch + invokes builder. | |

**User's choice:** Throw with typed error class + helper wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| `lib/shopify/auth.ts`, always loads offline session | Single path with 5 typed error codes. | ✓ |
| `lib/shopify/auth.ts`, two tiers (`verifyToken` + `verifyAndLoadSession`) | Fast variant for polling endpoints. | |
| `services/shopify/auth-service.ts`, class-based | Matches `ShopifyProductService` style. | |

**User's choice:** `lib/shopify/auth.ts`, always loads session
**Notes:** Optimization for polling endpoints (Phase 2 status route) deferred until profiling shows the DB hit matters.

---

## Middleware Matcher Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only embedded pages (`/onboarding/*`, `/chat/*`) | API routes do their own Bearer verification via `verifyShopSessionToken`. App Proxy routes (Phase 6) do their own HMAC. | ✓ |
| Embedded pages + embedded API (`/onboarding/*`, `/chat/*`, `/api/(chat|shopify)/*`) | Defense-in-depth. | |
| All routes except `/api/auth` and `/api/proxy` | Catch-all defense. | |

**User's choice:** Only embedded pages

| Option | Description | Selected |
|--------|-------------|----------|
| `?shop=` query param | Shopify Admin appends `?shop=` automatically on embedded URL navigation. Middleware validates corresponding offline session; redirects to `/api/auth` if missing. | ✓ |
| Session-token Bearer header | Page navigation doesn't carry headers — wouldn't work for the first paint. | |
| Both: query first, Bearer fallback | Current behavior; closer to the existing commented logic. | |

**User's choice:** `?shop=` query param

---

## Claude's Discretion

- Whether to seed an initial `shop` value during local dev (for `bunx prisma db seed`).
- Whether composite-key relations are expressed as Prisma `@relation` blocks vs raw indexes + app-layer assertions — pick whichever Prisma 7.3 supports idiomatically.
- `ProductRepository` transaction boundary — each method wraps its own `prisma.$transaction`; no outer-transaction param for V1.
- Whether to colocate `ShopifyAuthError` in `lib/shopify/auth.ts` or split into `lib/shopify/errors.ts`.
- Whether middleware also re-validates the `shop` query against the loaded session's shop (defense-in-depth).

## Deferred Ideas

- Structured logger (pino/winston) to replace `console.log` — Phase 1 is delete-only.
- Defense-in-depth Prisma client extension as a runtime safety net — explicitly rejected for Phase 1.
- Fast-path `verifyToken` variant without DB hit — revisit if Phase 2 polling profiling demands it.
- Per-request rate limiting on auth endpoints — formal home is Phase 8 (Hard Cap).
- PostgreSQL Row-Level Security (RLS) — globally rejected per research.
