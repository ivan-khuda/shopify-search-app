# Phase 1: Foundation - Research

**Researched:** 2026-05-22
**Domain:** Prisma multi-tenant schema, Shopify session-token auth, Next.js 16 middleware
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single destructive migration: DROP TABLE CASCADE for `products`, `product_variants`, `product_images`, `product_options`, `product_embeddings`, then recreate with `shop String NOT NULL` from the start. Developer environments reset via `bunx prisma migrate reset`.
- **D-02:** `shop` = `myshopify.com` hostname as plain `String` (e.g., `"example-store.myshopify.com"`). Derived from session-token `payload.dest` URL's `hostname`. Matches existing `ShopifySession.shop` shape — no UUID mapping, no GID.
- **D-03:** Enforcement exclusively at repository/service signature level. `shop: string` is the first parameter of every method on every repository. No Prisma extension, no AsyncLocalStorage, no RLS.
- **D-04:** Composite `(shop, id)` keys: `Product` declares `@@unique([shop, id])` and each child (`ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding`) declares `productId Int` + `productShop String` + `@relation(fields: [productShop, productId], references: [shop, id])`. Children carry `shop` redundantly — intentional.
- **D-05:** `verifyShopSessionToken` lives at `lib/shopify/auth.ts`, always loads offline session, no fast-path variant.
- **D-06:** Throws `ShopifyAuthError` with one of 5 codes: `missing_token` (401), `invalid_token` (401), `invalid_dest` (401), `invalid_shop_domain` (401), `no_offline_session` (401). Returns `{ shop: string, session: Session }` on success.
- **D-07:** `withShopifySession(handler)` wrapper — catches `ShopifyAuthError`, converts each code to `NextResponse.json({ error: code }, { status })`. Inner handler receives `{ shop, session, req }`.
- **D-08:** Middleware matcher: `['/onboarding/:path*', '/chat/:path*']` only. API routes call helper directly.
- **D-09:** Shop derived from `request.nextUrl.searchParams.get('shop')` only. No Bearer fallback in middleware.
- **D-10:** Delete `console.log` of `authHeader`, `shop`, `token`, and session-token-derived values outright. No replacement logger.

### Claude's Discretion

- Whether to seed an initial `shop` value during local dev (for `bunx prisma db seed`)
- Whether composite-key relations need `@relation` blocks or raw indexes plus app-layer assertions
- `ProductRepository` transaction boundary: each method wraps its own `prisma.$transaction`
- Whether to colocate `ShopifyAuthError` in `lib/shopify/auth.ts` or split into `lib/shopify/errors.ts`
- Whether middleware also re-validates `shop` query against the loaded session's shop

### Deferred Ideas (OUT OF SCOPE)

- Structured logger (pino/winston) — delete-only in Phase 1
- Per-request rate limiting on auth endpoints — Phase 8
- Defense-in-depth Prisma client extension
- PostgreSQL RLS — globally out of scope
- Fast-path `verifyToken` without offline-session DB hit
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Every Prisma model holding merchant data carries a `shop` (string) column with index; queries always filter by shop | Q1 (composite key syntax), Q5 (migration mechanics), Q8 (repository signatures) |
| FND-02 | All `console.log` statements emitting session tokens, auth headers, or Bearer tokens are removed | Q10 (exact file:line locations catalogued), no library research needed |
| FND-03 | Middleware auth check in `middleware.ts` re-enabled with correct `config.matcher` | Q6 (Next.js 16 proxy/middleware migration reality), existing test infrastructure |
| FND-04 | `ProductRepository` exposes type-safe `upsertProduct`, `deleteProduct`, `listByShop`, `findByShopAndId` backed by Prisma transactions | Q8 (interface design), Q1 (nested writes pattern) |
| FND-05 | `verifyShopSessionToken(request)` extracted and shared across embedded admin API routes | Q3 (token payload), Q4 (session loading), Q2 (error class shape) |
</phase_requirements>

---

## Summary

Phase 1 is pure infrastructure surgery: no new features, no UI changes. Five deliverables all build on two technical foundations — the Prisma schema migration to multi-tenant composite keys, and the extraction of session-token verification logic into a reusable auth helper. Both are well-understood problems with clear patterns in this codebase.

The biggest implementation surprise is **Next.js 16's renaming of `middleware.ts` to `proxy.ts`**. The file still runs as `middleware.ts` (deprecated with a build warning), but Phase 1 should migrate to `proxy.ts` with `export function proxy()` to stay current. The `export const runtime = 'nodejs'` declaration in the current file will throw an error in the new proxy file — the runtime is now **always nodejs and cannot be configured**. The matcher syntax (`export const config = { matcher: [...] }`) is unchanged and the existing array of path strings works as-is.

The Prisma composite-key schema (D-04) is syntactically supported: a parent can have both `@id @default(autoincrement())` and `@@unique([shop, id])`, and a child can reference the `@@unique` constraint via `@relation(fields: [productShop, productId], references: [shop, id])`. This is not the same as a composite `@@id` — the parent keeps its integer primary key, the composite unique is an additional constraint. The migration must be fully destructive (D-01) and must preserve the `CREATE EXTENSION IF NOT EXISTS vector` preamble.

The `ShopifyAuthError` class design and the `withShopifySession` wrapper pattern are straightforward transliterations of the existing inline logic in `app/api/shopify/sync/route.ts`. The 5 error codes are already tested by `route.test.ts` — Phase 1 keeps those tests green by updating them to mock `verifyShopSessionToken` instead of mocking `shopifyClient.session.decodeSessionToken` directly.

**Primary recommendation:** Implement in this sequence: (1) write the migration SQL and update schema, (2) build `lib/shopify/auth.ts` and its tests, (3) rewrite sync route via wrapper, (4) build full `ProductRepository`, (5) fix middleware/proxy file, (6) delete console.logs. Sequence matters because the repository depends on the schema, and the auth helper can be built independently in parallel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session token verification | API / Backend | Middleware (page-level guard only) | Token is a Bearer credential on HTTP requests; verification requires DB hit (offline session load); middleware does page-level redirect only |
| Multi-tenancy enforcement | Data Access Layer | API / Backend signature | Repository signatures are the structural contract; route handlers pass shop derived from verified token |
| Shop derivation from token | API / Backend | — | `payload.dest` is a server-side JWT claim; never trust client-provided shop without token verification |
| Middleware session check | Frontend Server (SSR / middleware) | — | Guards embedded UI pages from unauthenticated direct navigation; derives shop from `?shop=` query param |
| console.log deletion | Logging / Cross-cutting | — | Present in middleware, API routes, and a client component; each requires surgical edit |
| Prisma schema migration | Database / Storage | — | Structural change to DB tables; requires migration file, not just code change |

---

## Standard Stack

### Core (all already in package.json — no new packages required for Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma | 7.3.0 | Schema migration, client generation | Already installed; `@@unique` composite key support confirmed [CITED: prisma.io/docs] |
| @prisma/client | 7.3.0 | DB queries, `$transaction` | Already installed |
| @shopify/shopify-api | 12.3.0 | `decodeSessionToken`, `getOfflineId`, `Session` type | Already installed; no upgrade needed |
| next | 16.1.6 | proxy file (née middleware), `NextRequest`, `NextResponse` | Already installed |

**Phase 1 installs zero new packages.** All implementation uses existing dependencies.

### Package Legitimacy Audit

> Not applicable — Phase 1 installs no new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
Shopify Admin iFrame
  │  navigates to /onboarding?shop=X or /chat?shop=X
  ▼
proxy.ts (renamed from middleware.ts)
  ├── reads ?shop= query param
  ├── sessionStorage.loadSession(getOfflineId(shop))
  ├── session missing → redirect to /api/auth?shop=X
  └── session present → NextResponse.next()

Onboarding page
  │  POST /api/shopify/sync
  │  Authorization: Bearer <session_token>
  ▼
app/api/shopify/sync/route.ts
  └── withShopifySession(async ({ shop, session }) => {
        // real sync logic (Phase 2)
        return NextResponse.json({ success: true })
      })

withShopifySession (lib/shopify/auth.ts)
  ├── verifyShopSessionToken(req)
  │     ├── extract Bearer token from Authorization header
  │     ├── decodeSessionToken(token)  → JwtPayload
  │     ├── new URL(payload.dest).hostname → shop
  │     ├── validate shop.endsWith('.myshopify.com')
  │     └── sessionStorage.loadSession(getOfflineId(shop)) → Session | undefined
  │
  ├── throws ShopifyAuthError(code, status) on any failure
  └── passes { shop, session, req } to handler on success

ProductRepository (lib/db/repositories/ProductRepository.ts)
  ├── upsertProduct(shop, input) → prisma.$transaction([...])
  ├── findByShopAndId(shop, id) → prisma.product.findFirst({where:{shop,id}})
  ├── listByShop(shop, opts) → prisma.product.findMany({where:{shop},...})
  └── deleteProduct(shop, id) → prisma.product.delete({where:{shop_id:{shop,id}}})

PostgreSQL (via Prisma Accelerate)
  products(shop NOT NULL, id SERIAL, @@unique([shop,id]))
  product_variants(shop NOT NULL, productShop, productId, FK → products(shop,id))
  product_images(shop NOT NULL, productShop, productId, FK → products(shop,id))
  product_options(shop NOT NULL, productShop, productId, FK → products(shop,id))
  product_embeddings(shop NOT NULL, productShop, productId, FK → products(shop,id))
  shopify_sessions ← untouched
```

### Recommended Project Structure (Phase 1 additions)

```
lib/
├── shopify/
│   ├── client.ts          (unchanged)
│   ├── session-storage.ts (unchanged)
│   └── auth.ts            ← NEW: verifyShopSessionToken, withShopifySession, ShopifyAuthError
└── db/
    └── repositories/
        └── ProductRepository.ts  ← REPLACE stub with full CRUD

proxy.ts                   ← RENAME from middleware.ts + uncomment auth + update export name
                              (or: keep middleware.ts with deprecation warning, implementer decides)

prisma/
└── migrations/
    └── YYYYMMDDHHMMSS_add_shop_column_destructive/
        └── migration.sql  ← DROP TABLE CASCADE + recreate with shop column
```

---

## Q1: Prisma 7.3 Composite-Relation Syntax

**Answer:** Both `@id @default(autoincrement())` and `@@unique([shop, id])` can coexist on the same model. Children reference `@@unique` via `@relation(fields:..., references:...)` identically to how they'd reference `@@id`. [CITED: prisma.io/docs/orm/reference/prisma-schema-reference#unique-1]

### Exact Schema Pattern (D-04)

```prisma
// prisma/schema.prisma

model Product {
  id          Int      @id @default(autoincrement())
  shop        String   // myshopify.com hostname
  shopifyId   BigInt?
  // ... all other existing fields ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  variants   ProductVariant[]
  images     ProductImage[]
  options    ProductOption[]
  embeddings ProductEmbedding[]

  @@unique([shop, id])   // ← composite key children can reference
  @@index([shop])        // ← leading index for multi-tenant queries
  @@index([shopifyId])
  @@index([shop, shopifyId])  // for upsert by shopifyId within shop
  @@index([status])
  @@map("products")
}

model ProductVariant {
  id           Int    @id @default(autoincrement())
  shop         String // redundant with parent — intentional (D-04)
  productShop  String // FK composite field 1
  productId    Int    // FK composite field 2
  // ... all other existing fields ...

  product Product @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_variants")
}

model ProductImage {
  id          Int     @id @default(autoincrement())
  shop        String
  productShop String?  // nullable because images can also belong to variants
  productId   Int?
  variantId   Int?
  // ... existing fields ...

  product Product?       @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_images")
}

model ProductOption {
  id          Int    @id @default(autoincrement())
  shop        String
  productShop String
  productId   Int
  // ... existing fields ...

  product Product @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_options")
}

model ProductEmbedding {
  id          Int                    @id @default(autoincrement())
  shop        String
  productShop String
  productId   Int
  content     String                 @db.Text
  embedding   Unsupported("vector")?
  createdAt   DateTime               @default(now())

  product Product @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_embeddings")
}

model ShopifySession {
  // UNCHANGED — do not touch
}
```

**Important constraint:** All fields in `@@unique` must be non-nullable. `shop String` (NOT NULL) and `id Int @id` (NOT NULL) — both satisfy this. [CITED: prisma.io/docs/orm/reference/prisma-schema-reference#unique-1]

**Caveat on ProductImage:** Current schema has `productId Int?` (nullable) because images can be variant-scoped. If `productShop` is declared nullable to mirror this, composite FK is still valid — but Prisma requires both fields to have the same nullability for the composite FK. Make both nullable (`productShop String?`, `productId Int?`) for image-to-product relation, and keep `variantId Int?` for variant-to-image as a single-field FK (unchanged).

**`@@id([shop, id])` vs `@@unique([shop, id])`:** D-04 says `@@unique`, not `@@id`. This is the right choice — keeping `@id` as the integer autoincrement means all Prisma query helpers that expect a single primary key still work (e.g., `prisma.product.findUnique({ where: { id } })`). The `@@unique` adds a second unique constraint that the child FKs reference.

---

## Q2: `ShopifyAuthError` Class Shape

**Pattern:** Based on existing codebase conventions (`CONVENTIONS.md`: `export class`; error handling via `Response.json({error}, {status})`), and the instruction to colocate or split (Claude's Discretion).

```typescript
// lib/shopify/auth.ts (or lib/shopify/errors.ts — implementer's call)

export type ShopifyAuthErrorCode =
  | 'missing_token'
  | 'invalid_token'
  | 'invalid_dest'
  | 'invalid_shop_domain'
  | 'no_offline_session';

export class ShopifyAuthError extends Error {
  constructor(
    public readonly code: ShopifyAuthErrorCode,
    public readonly status: 401 = 401
  ) {
    super(`Shopify auth error: ${code}`);
    this.name = 'ShopifyAuthError';
  }
}
```

**Why this shape:**
- The 5 codes map 1:1 to the 5 `return NextResponse.json({ error: '...' }, { status: 401 })` statements in `app/api/shopify/sync/route.ts:8,17,21,28,33,39` [VERIFIED: read file]
- All codes use status 401 (confirmed from sync route source) — `status` field defaults to 401 but is typed as `401` for discriminated safety
- `Error` subclass means `instanceof ShopifyAuthError` works reliably in `catch` blocks
- Matches codebase pattern of `export class` for service objects [CITED: .planning/codebase/CONVENTIONS.md]

**Current sync route error code mapping (source lines):**

| Line | Condition | Error Code |
|------|-----------|-----------|
| 8 | No `Authorization: Bearer` header | `missing_token` |
| 17 | `decodeSessionToken` throws | `invalid_token` |
| 21 | `payload.dest` missing | `invalid_token` |
| 28 | `new URL(payload.dest)` throws | `invalid_dest` (note: currently returns `invalid_token` — D-06 says `invalid_dest` is a separate code) |
| 33 | hostname doesn't end with `.myshopify.com` | `invalid_shop_domain` |
| 39 | `loadSession` returns null/undefined | `no_offline_session` |

**Clarification:** The existing sync route collapses `invalid_dest` and `invalid_token` both into `'invalid_token'` (lines 17, 21, 28). D-06 separates them. The new `verifyShopSessionToken` should throw `invalid_dest` when `payload.dest` is missing or not a parseable URL, `invalid_token` only when `decodeSessionToken` itself throws.

---

## Q3: Session-Token Decoding Contract

**Source:** [Shopify session tokens docs](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens) + [decodeSessionToken source](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/lib/session/decode-session-token.ts) [CITED]

### JWT Payload Shape

| Field | Type | Content |
|-------|------|---------|
| `iss` | string | Shop admin domain (e.g., `"https://example-store.myshopify.com/admin"`) |
| `dest` | string | **Shop domain** (e.g., `"https://example-store.myshopify.com"`) — this is what `verifyShopSessionToken` parses |
| `aud` | string | Client ID of the app (`SHOPIFY_API_KEY`) |
| `sub` | string | User that the session token is intended for |
| `exp` | number | Expiry timestamp (UNIX) |
| `nbf` | number | Not-before timestamp (UNIX) |
| `iat` | number | Issued-at timestamp (UNIX) |
| `jti` | string | Secure random UUID |
| `sid` | string | Unique session ID per user and app |

### Key contract details

- **`dest` field:** Contains the full shop URL (e.g., `"https://example-store.myshopify.com"`). `new URL(payload.dest).hostname` → `"example-store.myshopify.com"`. This is the correct shop derivation path — identical to what `app/api/shopify/sync/route.ts:26` already does [VERIFIED: read file].
- **Clock skew tolerance:** `JWT_PERMITTED_CLOCK_TOLERANCE = 10` seconds — the SDK uses `jose.jwtVerify` with 10s tolerance. [CITED: github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/lib/session/decode-session-token.ts]
- **Audience validation:** `checkAudience: true` (default) — validates `aud === SHOPIFY_API_KEY`. This check is done inside `decodeSessionToken` automatically.
- **Error thrown on failure:** `ShopifyErrors.InvalidJwtError` — this is what the catch block in `verifyShopSessionToken` should handle.
- **Algorithm:** HMAC-SHA256 (HS256).

### `verifyShopSessionToken` control flow

```typescript
// lib/shopify/auth.ts
import type { Session } from '@shopify/shopify-api';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function verifyShopSessionToken(
  req: Request
): Promise<{ shop: string; session: Session }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ShopifyAuthError('missing_token');
  }

  const token = authHeader.slice('Bearer '.length);

  let payload: { dest?: string };
  try {
    payload = await shopifyClient.session.decodeSessionToken(token);
  } catch {
    throw new ShopifyAuthError('invalid_token');
  }

  if (!payload.dest) {
    throw new ShopifyAuthError('invalid_dest');
  }

  let shop: string;
  try {
    shop = new URL(payload.dest).hostname;
  } catch {
    throw new ShopifyAuthError('invalid_dest');
  }

  if (!shop.endsWith('.myshopify.com')) {
    throw new ShopifyAuthError('invalid_shop_domain');
  }

  const sessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(sessionId);

  if (!session) {
    throw new ShopifyAuthError('no_offline_session');
  }

  return { shop, session };
}
```

---

## Q4: Session Loading Contract

**Source:** [VERIFIED: read `app/api/shopify/sync/route.ts`]

```typescript
// app/api/shopify/sync/route.ts:35-39
const sessionId = shopifyClient.session.getOfflineId(shop);
const session = await sessionStorage.loadSession(sessionId);

if (!session) {
  return NextResponse.json({ error: 'no_offline_session' }, { status: 401 });
}
```

**Contract:**
- `sessionStorage.loadSession(id)` returns `Promise<Session | undefined>`. It does **not** throw when the session is missing — it returns `undefined`. [VERIFIED: existing sync route usage]
- The `sessionStorage` export is `PrismaSessionStorage` from `@shopify/shopify-app-session-storage-prisma@8.0.1`, backed by the `ShopifySession` Prisma model. [VERIFIED: read `lib/shopify/session-storage.ts`]
- `shopifyClient.session.getOfflineId(shop)` is a pure synchronous function returning the offline session ID string (e.g., `"offline_example-shop.myshopify.com"`). [VERIFIED: existing sync route test mocks confirm this at `route.test.ts:8`]
- `Session` type is from `@shopify/shopify-api` — re-export it in auth.ts using `import type { Session } from '@shopify/shopify-api'`.

---

## Q5: Migration Mechanics

**Existing migrations (VERIFIED: read directory):**

| Migration | What it created |
|-----------|-----------------|
| `20260207111413_init` | All product tables (no `shop` column), `CREATE EXTENSION IF NOT EXISTS vector` preamble, product FK constraints |
| `20260216181046_add_shop_table` | `shopify_sessions` table (original schema) |
| `20260502011528_update_shopify_session_schema` | Altered `shopify_sessions` — dropped `onlineAccessInfo`, changed `expires` type, added user fields |

**Tables to DROP + recreate:** `products`, `product_variants`, `product_images`, `product_options`, `product_embeddings`.
**Table to preserve:** `shopify_sessions` — it has live session data and its schema is correct as-is.

### Migration SQL skeleton

```sql
-- Migration: YYYYMMDDHHMMSS_add_shop_column_destructive
-- WARNING: Destructive migration. Drops all product tables and recreates with shop column.
-- No production data exists. Developer environments: bunx prisma migrate reset.

-- Preserve pgvector extension (already created in 20260207111413_init, idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop product tables (CASCADE removes FK constraints automatically)
DROP TABLE IF EXISTS "product_embeddings" CASCADE;
DROP TABLE IF EXISTS "product_options" CASCADE;
DROP TABLE IF EXISTS "product_images" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;

-- Recreate products with shop column
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,                    -- multi-tenancy column
    "shopifyId" BIGINT,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "descriptionHtml" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "priceMin" DECIMAL(10,2),
    "priceMax" DECIMAL(10,2),
    "compareAtPriceMin" DECIMAL(10,2),
    "compareAtPriceMax" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_shop_id_key" ON "products"("shop", "id");
CREATE UNIQUE INDEX "products_shop_shopifyId_key" ON "products"("shop", "shopifyId") WHERE "shopifyId" IS NOT NULL;
CREATE INDEX "products_shop_idx" ON "products"("shop");
CREATE UNIQUE INDEX "products_handle_key" ON "products"("handle");
CREATE INDEX "products_status_idx" ON "products"("status");
-- ... recreate other product indexes ...

-- Recreate product_variants with shop + composite FK
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "productShop" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "shopifyId" BIGINT,
    -- ... other columns same as before ...
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_productShop_productId_fkey"
  FOREIGN KEY ("productShop", "productId")
  REFERENCES "products"("shop", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate product_images, product_options, product_embeddings similarly
-- (product_images: productShop TEXT, productId INT nullable for variant-scoped images)
-- product_embeddings must include: embedding vector (raw type, Prisma can't generate)

-- For product_embeddings, the vector column must be raw SQL:
CREATE TABLE "product_embeddings" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "productShop" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,               -- pgvector type preserved
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_embeddings"
  ADD CONSTRAINT "product_embeddings_productShop_productId_fkey"
  FOREIGN KEY ("productShop", "productId")
  REFERENCES "products"("shop", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**pgvector extension:** The `CREATE EXTENSION IF NOT EXISTS vector` preamble is already in the first migration. Prisma will include it again in the new migration only if the schema declares `previewFeatures = ["postgresqlExtensions"]` — which this schema does not. The safe approach: include `CREATE EXTENSION IF NOT EXISTS vector` at the top of the new migration SQL as a no-op guard. [CITED: PITFALLS.md §"Prisma Drops Your HNSW Index"]

**Prisma schema drift warning:** After the migration, run `bunx prisma migrate status` to confirm no drift. The `Unsupported("vector")` column in `ProductEmbedding` may trigger a drift warning on subsequent `prisma migrate dev` runs — this is expected and documented in PITFALLS.md §Pitfall 3. The migration preserves the `vector` column via raw SQL, not via Prisma schema.

**Migration file naming:** Prisma auto-names migration folders. Run:
```bash
bunx prisma migrate dev --name add_shop_column_destructive
```
This generates the timestamp-prefixed folder. Then manually edit the generated SQL to match the destructive pattern above (Prisma won't generate DROP TABLE CASCADE on its own).

---

## Q6: Middleware / Next.js 16 Specifics

**Critical finding:** Next.js 16 deprecated `middleware.ts` and renamed it to `proxy.ts`. [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16]

### What changed and what it means for Phase 1

| Aspect | Old (middleware.ts) | New (proxy.ts in Next.js 16) |
|--------|--------------------|-----------------------------|
| File name | `middleware.ts` | `proxy.ts` (middleware.ts still works with build warning) |
| Export name | `export function middleware()` | `export function proxy()` |
| Runtime declaration | `export const runtime = 'nodejs'` | **Removed — throws error if set. Runtime is always nodejs now.** |
| Matcher config | `export const config = { matcher: [...] }` | Same — unchanged |
| Matcher array syntax | `['/chat/:path*', '/onboarding/:path*']` | Same — unchanged |

**Action for Phase 1:** The file must be migrated to `proxy.ts` (or kept as `middleware.ts` with deprecation warning — implementer's choice per D-08). **The `export const runtime = 'nodejs'` line at `middleware.ts:43` MUST be deleted** — it will throw an error in proxy.ts. [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy — "Setting the `runtime` config option in Proxy will throw an error."]

**Current middleware.ts state (VERIFIED: read file):**
- Line 9: `console.log('authHeader', authHeader)` — DELETE (D-10)
- Line 10: `console.log('shop', shop)` — DELETE (D-10)
- Line 13: `console.log('token', token)` — DELETE (D-10)
- Lines 22-32: Session validation commented out — UNCOMMENT and complete (FND-03)
- Line 43: `export const runtime = 'nodejs'` — DELETE (throws in proxy.ts)
- Line 46: matcher empty — SET to `['/onboarding/:path*', '/chat/:path*']` (D-08)

**D-09 alignment:** The current middleware already uses `searchParams.get('shop')` (line 6) for the `shop` query param. The Bearer fallback at lines 11-20 is what D-09 says to remove. The rewritten middleware/proxy file should:
1. Get `shop` from `searchParams.get('shop')`
2. If missing → redirect to `/api/auth`
3. Load offline session via `sessionStorage.loadSession(shopifyClient.session.getOfflineId(shop))`
4. If session missing → redirect to `/api/auth?shop=<shop>`
5. If session present → `NextResponse.next()`

**Existing middleware test (`__tests__/middleware.test.ts`):** Already written and tests the correct behavior described above, including Bearer-token fallback tests. The Bearer fallback tests (lines 51-74) will need to be removed or updated since D-09 removes Bearer fallback from middleware. The three core tests (lines 29-47, 39-47) confirm the session-check redirect behavior and should stay green.

**Calling Prisma from middleware/proxy:** Prisma runs on Node.js runtime (not edge). Since Next.js 16 proxy defaults to Node.js runtime, Prisma calls in proxy.ts are fine — no cold-start edge incompatibility. The existing `middleware.ts:43` already declares Node.js runtime for this reason.

---

## Q7: Test Impact Analysis

**Files touched by Phase 1 and their test implications:**

### 1. `app/api/shopify/sync/route.ts` → rewritten via `withShopifySession`

**Test file:** `app/api/shopify/sync/__tests__/route.test.ts` [VERIFIED: read file]

**Current mocking:** Mocks `shopifyClient.session.decodeSessionToken` and `sessionStorage.loadSession` directly, then calls the 5 auth error paths by manipulating those mocks.

**Required update after Phase 1:** The route no longer calls these directly — it calls `withShopifySession` which calls `verifyShopSessionToken`. The test must be updated to:
- Option A: Mock `verifyShopSessionToken` from `@/lib/shopify/auth` (cleanest)
- Option B: Keep mocking `shopifyClient.session.decodeSessionToken` and `sessionStorage.loadSession` — these still work because `verifyShopSessionToken` calls them internally

Option A is preferred (tests the contract boundary). Option B is also valid since the integration is shallow.

**Tests that must stay green:** All 6 tests (missing_token, invalid_token, invalid_dest, non-myshopify domain, no_offline_session, 200 success). The error code strings must not change.

### 2. `middleware.ts` / `proxy.ts` → rewritten

**Test file:** `__tests__/middleware.test.ts` [VERIFIED: read file]

**Current state:** 5 tests. Tests 3-4 (Bearer token extraction) test the Bearer fallback logic that D-09 removes from middleware.

**Required update:** Remove or update Bearer-token tests (lines 51-74) since D-09 says middleware only reads from `?shop=` param. Keep tests 1-2 (session present → 200; session missing → 307 redirect) and test 5 (no shop → 307 redirect). Add test for: shop param missing with no token → redirect.

**Test file must also be updated for file/function rename** if migrating to proxy.ts: `import { middleware } from '../middleware'` → `import { proxy } from '../proxy'`.

### 3. `app/(embedded)/onboarding/page.tsx` → delete `console.log`

**Test file:** `app/(embedded)/__tests__/onboarding.test.tsx` [VERIFIED: read file]

**Impact:** Minimal. The onboarding test mocks `shopify.idToken()` via `vi.stubGlobal('shopify', shopifyMock)` and never tests console output. Deleting the `console.log("token", token)` at line 13 requires **no test changes**. All 7 tests continue to pass unchanged.

### 4. `app/api/auth/route.ts` → delete `console.log`

**Test file:** `app/api/auth/__tests__/route.test.ts` [VERIFIED: read file]

**Impact:** None. Tests mock `shopifyClient.auth.begin` and `shopifyClient.auth.callback`. Deleting `console.log('shop', shop)` and `console.log("shopifyClient", shopifyClient)` requires **no test changes**.

### 5. `lib/db/repositories/ProductRepository.ts` → full rewrite

**Test file:** None currently exists. [VERIFIED: find results show no ProductRepository test]

**Required:** New test file `lib/db/repositories/__tests__/ProductRepository.test.ts` covering the 4 public methods. Mock `prisma.$transaction` and the individual Prisma model methods.

### 6. `lib/shopify/auth.ts` → new file

**Test file:** None (new file). Create `lib/shopify/__tests__/auth.test.ts`.

**Mocking strategy (same as sync route tests):**
```typescript
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      decodeSessionToken: vi.fn(),
      getOfflineId: vi.fn((shop) => `offline_${shop}`),
    },
  },
}));
vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: { loadSession: vi.fn() },
}));
```

---

## Q8: ProductRepository Signature Design

**Recommended interface:**

```typescript
// lib/db/repositories/ProductRepository.ts

import { prisma } from '@/lib/db/client';
import type { Product, Prisma } from '@/app/generated/prisma';

export interface ProductVariantInput {
  shopifyId?: bigint;
  title: string;
  sku?: string;
  barcode?: string;
  price: number; // converted to Decimal in upsert
  compareAtPrice?: number;
  position: number;
  inventoryQuantity?: number;
  inventoryPolicy: string;
  availableForSale: boolean;
  requiresShipping: boolean;
  taxable: boolean;
  weight?: number;
  weightUnit?: string;
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface ProductImageInput {
  shopifyId?: bigint;
  url: string;
  altText?: string;
  width?: number;
  height?: number;
  position: number;
}

export interface ProductOptionInput {
  shopifyId?: bigint;
  name: string;
  position: number;
  values: string[];
}

export interface ProductUpsertInput {
  shopifyId?: bigint;
  title: string;
  handle: string;
  description?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  status: string;
  tags: string[];
  publishedAt?: Date;
  priceMin?: number;
  priceMax?: number;
  compareAtPriceMin?: number;
  compareAtPriceMax?: number;
  variants: ProductVariantInput[];
  images: ProductImageInput[];
  options: ProductOptionInput[];
}

export interface ListOpts {
  limit?: number;
  offset?: number;
  status?: string;
}

export class ProductRepository {
  async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert the Product row
      const product = await tx.product.upsert({
        where: { shopifyId: input.shopifyId ?? -1n }, // or use handle
        update: { ...fields, shop },
        create: { ...fields, shop },
      });

      // 2. Delete and recreate children (simplest correct approach for Phase 2)
      await tx.productVariant.deleteMany({ where: { productShop: shop, productId: product.id } });
      await tx.productImage.deleteMany({ where: { productShop: shop, productId: product.id } });
      await tx.productOption.deleteMany({ where: { productShop: shop, productId: product.id } });

      // 3. Create children with composite FK
      if (input.variants.length) {
        await tx.productVariant.createMany({
          data: input.variants.map(v => ({ ...v, shop, productShop: shop, productId: product.id })),
        });
      }
      // ... images, options similarly

      return product;
    });
  }

  async findByShopAndId(shop: string, id: number): Promise<Product | null> {
    return prisma.product.findFirst({ where: { shop, id } });
  }

  async listByShop(shop: string, opts: ListOpts = {}): Promise<Product[]> {
    return prisma.product.findMany({
      where: { shop, ...(opts.status ? { status: opts.status } : {}) },
      take: opts.limit,
      skip: opts.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteProduct(shop: string, id: number): Promise<void> {
    await prisma.product.delete({
      where: { shop_id: { shop, id } }, // compound where using @@unique name
    });
  }
}

export const productRepository = new ProductRepository();
```

**`$transaction` pattern:** Interactive transaction (`prisma.$transaction(async (tx) => {...})`) is the correct choice for multi-table upsert because it allows sequential operations with results from previous steps (the `product.id` is needed for child rows). Sequential transaction (`prisma.$transaction([...])` with array) does not support this. [CITED: prisma.io/docs/orm/prisma-client/queries/transactions]

**`deleteMany` + `createMany` vs nested write upsert:** Prisma does not have a native `upsertMany`. The simplest correct Phase 1 pattern for children is delete-all-children-for-product + createMany. This is correct because Phase 1 has no product data, and the Phase 2 sync will be idempotent by Shopify ID. The webhook upsert pattern (SYN-11) uses `updated_at_shopify` for conflict resolution — that's Phase 2 concern, not Phase 1.

**`findByShopAndId` where clause:** `findFirst({ where: { shop, id } })` is correct since `id` is the `@id` primary key and `shop` is an indexed column. The compound `where: { shop_id: { shop, id } }` (using the `@@unique` name) works too for `findUnique` but requires knowing Prisma auto-names the constraint.

**Prisma-generated compound where name for `deleteProduct`:** When `@@unique([shop, id])` is declared, Prisma generates a compound where input named `{model}_{field1}_{field2}` — for `products(shop, id)` this would be accessible as `where: { shop_id: { shop, id } }`. Verify the exact generated name after `bunx prisma generate`. Alternatively use `delete({ where: { id } })` since `id` is `@id` and is globally unique — but this skips the shop validation. Use `findFirst({ where: { shop, id } })` + `delete({ where: { id } })` for safety if the compound where name is uncertain. [ASSUMED: exact Prisma-generated compound where name needs verification after schema migration]

---

## Q9: Existing Migration Inventory

**Result:** [VERIFIED: read all 3 migration files]

| Migration | What It Contains | Keep? |
|-----------|-----------------|-------|
| `20260207111413_init` | Creates `products`, `product_variants`, `product_images`, `product_options`, `product_embeddings` tables; `CREATE EXTENSION IF NOT EXISTS vector` | **These tables get dropped by new migration** — migration history preserved, tables replaced |
| `20260216181046_add_shop_table` | Creates `shopify_sessions` table | **Keep** — session table untouched |
| `20260502011528_update_shopify_session_schema` | Alters `shopify_sessions` column types | **Keep** — session table untouched |

**`ShopifySession` is untouched.** The destructive migration drops only the 5 product-related tables via `DROP TABLE CASCADE`. `shopify_sessions` must NOT be dropped.

**Migration history:** Prisma migration history (`_prisma_migrations` table) is preserved. The new destructive migration is a new entry in that history — it does not replace old entries. This is correct: Prisma tracks that the old migrations ran, and the new migration adds the schema evolution on top. Running `bunx prisma migrate reset` replays all migrations from scratch including the new destructive one. [ASSUMED: standard Prisma migration behavior — well-established]

---

## Q10: Console.log Deletion Map

**All console.log statements to delete (by file:line):**

| File | Line | Content | D-10 Reason |
|------|------|---------|------------|
| `middleware.ts` | 9 | `console.log('authHeader', authHeader)` | logs auth header (sensitive) |
| `middleware.ts` | 10 | `console.log('shop', shop)` | logs shop (identifier) |
| `middleware.ts` | 13 | `console.log('token', token)` | logs Bearer token (CRITICAL) |
| `app/api/auth/route.ts` | 7 | `console.log('shop', shop)` | logs shop |
| `app/api/auth/route.ts` | 8 | `console.log("shopifyClient", shopifyClient)` | logs SDK object (config leak) |
| `app/api/auth/callback/route.ts` | 16 | `console.log('redirectUrl', redirectUrl.toString())` | logs redirect URL with shop param |
| `app/(embedded)/onboarding/page.tsx` | 13 | `console.log("token", token)` | logs session token (CRITICAL) |

[VERIFIED: read all 4 files]

**D-10 is strictly delete-only** — no replacement, no conditional `if (DEBUG)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation + clock skew | Custom JWT parser | `shopifyClient.session.decodeSessionToken(token)` | SDK handles HS256, 10s clock skew, audience check, error types |
| Session persistence | Custom session DB queries | `sessionStorage.loadSession(id)` (already in use) | PrismaSessionStorage handles the query contract |
| Middleware path matching | Custom regex in middleware body | `export const config = { matcher: [...] }` | Next.js evaluates at build time; custom regex in body runs on every request |
| Composite FK enforcement | App-layer checks that `productShop === shop` | `@@unique([shop, id])` + `@relation(references: [shop, id])` at DB level | DB enforces it structurally; app checks are defense-in-depth only |
| Transaction retry logic | Manual retry loop | Prisma `$transaction` with `maxWait`/`timeout` options | Prisma handles transaction isolation and serialization errors |

---

## Common Pitfalls

### Pitfall 1: `export const runtime = 'nodejs'` in proxy.ts causes a build error
**What goes wrong:** Copying `middleware.ts` to `proxy.ts` without removing `export const runtime = 'nodejs'` causes Next.js 16 to throw at build time.
**Why it happens:** Next.js 16 proxy always runs on Node.js. The `runtime` config is not configurable and not allowed.
**How to avoid:** Delete `export const runtime = 'nodejs'` entirely when migrating to proxy.ts.
**Warning signs:** Build error mentioning "runtime config option is not available in Proxy files."

### Pitfall 2: Prisma composite compound where clause name is unknown until after `generate`
**What goes wrong:** `prisma.product.delete({ where: { shop_id: { shop, id } } })` fails at runtime because Prisma generates a different name for the `@@unique([shop, id])` constraint.
**Why it happens:** Prisma auto-names compound unique where inputs. The name depends on field names and may not be `shop_id`.
**How to avoid:** After `bunx prisma generate`, inspect the generated client types at `app/generated/prisma/index.d.ts` to find the exact compound where input name. Alternatively, use `prisma.product.deleteMany({ where: { shop, id } })` which always works.
**Warning signs:** TypeScript error on the `where` clause field name.

### Pitfall 3: `@@unique([shop, id])` requires both fields to be non-nullable
**What goes wrong:** Declaring `shop String?` (nullable) in the `@@unique` breaks the constraint — Prisma will not allow optional fields in a `@@unique`.
**Why it happens:** Prisma enforces this at schema validation time.
**How to avoid:** Declare `shop String` (NOT `shop String?`). Since we're recreating tables from scratch, there's no migration cost to making it non-nullable.
**Warning signs:** `prisma validate` / `prisma migrate dev` reports "All fields must be required to use @@unique."

### Pitfall 4: Bearer fallback removal breaks existing middleware.test.ts tests
**What goes wrong:** Tests at lines 51-74 in `__tests__/middleware.test.ts` test Bearer-token extraction in middleware. D-09 removes this code. Tests fail.
**Why it happens:** Tests were written for the current (incorrect) middleware behavior.
**How to avoid:** Update the tests when rewriting the middleware. Remove Bearer token tests; keep session-check and redirect tests.
**Warning signs:** Vitest errors on `'extracts shop from valid App Bridge Bearer token'` and `'redirects when Bearer token is invalid'` tests after middleware rewrite.

### Pitfall 5: `ShopifySession` table accidentally included in DROP TABLE CASCADE
**What goes wrong:** Including `shopify_sessions` in the destructive migration wipes all offline sessions, breaking all existing app installs.
**Why it happens:** Developer writes `DROP TABLE CASCADE` too broadly.
**How to avoid:** Explicitly list only the 5 product tables. The migration SQL must NOT mention `shopify_sessions`.
**Warning signs:** All API routes return `no_offline_session` after migration (sessions gone).

### Pitfall 6: Confusing `@@unique([shop, id])` with `@@id([shop, id])`
**What goes wrong:** Declaring `@@id([shop, id])` instead of `@@unique([shop, id])` removes the `@id @default(autoincrement())` primary key, breaking all single-field Prisma queries like `findUnique({ where: { id } })`.
**Why it happens:** D-04 says composite keys — easy to misread as composite primary keys.
**How to avoid:** D-04 explicitly says `@@unique` not `@@id`. The autoincrement `@id` stays. The composite is an additional constraint.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` with `export function middleware()` | `proxy.ts` with `export function proxy()` | Next.js 16.0.0 | Phase 1 should migrate; `middleware.ts` still works with deprecation warning |
| `export const runtime = 'nodejs'` in middleware | Removed — proxy always runs on Node.js, unconfigurable | Next.js 16.0.0 | Delete this line during migration |
| Multi-field FK references `@@id` only | Multi-field FK can reference `@@unique` composite | Prisma 2+ | D-04 pattern is valid |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Prisma-generated compound where input for `@@unique([shop, id])` is accessible as `shop_id` in TypeScript | Q8 | deleteProduct needs adjustment; workaround is deleteMany |
| A2 | `middleware.ts` with old-style export still runs in Next.js 16.1.6 (just with deprecation warning, no build break) | Q6 | If it broke outright, proxy.ts rename becomes blocking |
| A3 | `PrismaSessionStorage.loadSession` returns `undefined` (not `null`) when session not found | Q4 | If it returns `null`, the `!session` check still works (both are falsy) — low risk |
| A4 | Standard Prisma migration history behavior: new migration applies on top of existing history without affecting `shopify_sessions` | Q9 | If assumption wrong, session table at risk — verify with `bunx prisma migrate status --dry-run` before running |

---

## Open Questions

1. **Proxy.ts vs middleware.ts for Phase 1**
   - What we know: Both work in Next.js 16.1.6; `middleware.ts` shows a deprecation warning; `proxy.ts` is the current convention; the test import path must change if renamed.
   - What's unclear: Whether the project wants to incur the file rename + test update overhead in Phase 1 vs deferring.
   - Recommendation: Migrate to `proxy.ts` in Phase 1 since the file is being substantially rewritten anyway. Cost is low; staying on deprecated API is unnecessary tech debt.

2. **`upsertProduct` by `shopifyId` or `handle`**
   - What we know: The Prisma schema currently has `shopifyId BigInt? @unique` but post-migration it will be `@@index([shop, shopifyId])` without the global unique.
   - What's unclear: For the `upsert({ where: ... })` call, what constitutes the unique lookup key within a shop? `shopifyId` (if provided) or `handle`?
   - Recommendation: Use `shopifyId` as the upsert key within a shop — it's the stable Shopify entity ID. `handle` can change. Use `prisma.product.upsert({ where: { shopifyId_shop: { shopifyId, shop } } })` if Prisma generates that compound where, otherwise use findFirst + create/update pattern.

3. **ProductImage composite FK nullable fields**
   - What we know: Current schema has `productId Int?` and `variantId Int?` on `ProductImage` (image can be product-level or variant-level).
   - What's unclear: Does the composite FK `(productShop, productId)` with nullable fields work in Prisma? Nullable composite FK is less common.
   - Recommendation: Add `productShop String?` (nullable) to match `productId Int?`. For the `@relation`, use `fields: [productShop, productId]` with both nullable — Prisma supports nullable composite FKs.

---

## Environment Availability

> Step 2.6: All required tools are existing project dependencies. No external services are added.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bunx / bun | `prisma migrate dev`, test runner | ✓ | inferred from package manager | — |
| PostgreSQL | Prisma migrations | ✓ | via Prisma Accelerate (DATABASE_URL) | — |
| prisma CLI | Schema migration | ✓ | 7.3.0 (package.json) | — |

**Runtime State Inventory:** SKIPPED — Phase 1 is not a rename/refactor phase. It modifies column structure (not renames), deletes console.log calls, and creates new files.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts __tests__/middleware.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Every merchant-data model has `shop` column; repository methods require `shop: string` | Unit | `bunx vitest run lib/db/repositories/__tests__/ProductRepository.test.ts` | ❌ Wave 0 |
| FND-01 | Migration applies without error | Manual smoke | `bunx prisma migrate dev --dry-run` | N/A — migration file |
| FND-02 | No `console.log` of tokens in targeted files | Static analysis | `grep -rn "console.log" middleware.ts app/api/auth/ app/(embedded)/onboarding/page.tsx` | N/A — grep |
| FND-03 | Unauthenticated request to `/onboarding` redirects | Unit | `bunx vitest run __tests__/middleware.test.ts` | ✅ exists (needs update) |
| FND-03 | Authenticated request to `/onboarding` allows through | Unit | `bunx vitest run __tests__/middleware.test.ts` | ✅ exists |
| FND-04 | `upsertProduct` wraps in transaction, shop param required | Unit | `bunx vitest run lib/db/repositories/__tests__/ProductRepository.test.ts` | ❌ Wave 0 |
| FND-04 | `listByShop` only returns records for given shop | Unit | same | ❌ Wave 0 |
| FND-05 | `verifyShopSessionToken` throws correct error codes | Unit | `bunx vitest run lib/shopify/__tests__/auth.test.ts` | ❌ Wave 0 |
| FND-05 | `withShopifySession` returns error response on `ShopifyAuthError` | Unit | same | ❌ Wave 0 |
| FND-05 | Sync route still returns 401 with correct error codes | Integration | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` | ✅ exists (needs mock update) |

### Sampling Rate

- **Per task commit:** `bunx vitest run __tests__/middleware.test.ts app/api/shopify/sync/__tests__/route.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/shopify/__tests__/auth.test.ts` — covers FND-05 (`verifyShopSessionToken` 5 error codes + happy path, `withShopifySession` wrapper)
- [ ] `lib/db/repositories/__tests__/ProductRepository.test.ts` — covers FND-04 (upsert, find, list, delete; shop isolation)
- [ ] `__tests__/middleware.test.ts` update — remove Bearer fallback tests, add `?shop=` missing redirect test

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Shopify session token via `decodeSessionToken` (HS256 JWT, SDK-verified) |
| V3 Session Management | YES | Offline session loaded from DB; session tokens are short-lived JWTs |
| V4 Access Control | YES | Repository signature enforcement (`shop` param); middleware page guard |
| V5 Input Validation | Partial | Shop hostname validated with `.endsWith('.myshopify.com')` check |
| V6 Cryptography | N/A | No custom crypto; SDK handles JWT signing |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session token replay (leaked token reused) | Spoofing | Tokens expire (short TTL); 10s clock skew tolerance limits window |
| Cross-tenant data access (missing `shop` filter) | Information Disclosure | Repository signature enforcement; `shop` first param on all methods |
| Console-logged tokens in centralized logs | Information Disclosure | D-10: delete all `console.log` of tokens — no replacement |
| Unauthenticated embedded page access | Elevation of Privilege | Middleware/proxy guards `/onboarding` and `/chat`; redirects to auth |
| `shop` param spoofing in middleware | Spoofing | Middleware loads offline session by shop — if session doesn't exist, redirect to auth (can't forge a session) |

---

## Sources

### Primary (HIGH confidence)

- `app/api/shopify/sync/route.ts` — verified existing auth logic, error codes, session loading contract
- `__tests__/middleware.test.ts` — verified test patterns, Bearer fallback tests that need removal
- `app/api/shopify/sync/__tests__/route.test.ts` — verified test patterns, mock strategy
- `middleware.ts` — verified current state (commented-out auth, console.logs, runtime export)
- `prisma/schema.prisma` — verified current schema, `Unsupported("vector")` field
- `prisma/migrations/` (all 3) — verified migration history, table creation SQL
- [nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — Next.js 16 proxy runtime behavior, matcher syntax, no runtime config
- [nextjs.org/docs/app/guides/upgrading/version-16](https://nextjs.org/docs/app/guides/upgrading/version-16) — middleware → proxy rename, runtime change
- [github.com/Shopify/shopify-app-js — decode-session-token.ts](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/lib/session/decode-session-token.ts) — 10s clock tolerance, HS256, `InvalidJwtError`
- [shopify.dev session token payload fields](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens) — `dest`, `aud`, `iss`, `sub`, `exp`, `nbf`, `sid` field documentation

### Secondary (MEDIUM confidence)

- [prisma.io/docs/orm/reference/prisma-schema-reference#unique-1](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique-1) — `@@unique` alongside `@id`, all fields must be required
- [prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations](https://www.prisma.io/docs/v6/orm/prisma-schema/data-model/relations/one-to-many-relations) — multi-field `@relation` syntax with composite keys
- [prisma.io/docs/orm/prisma-client/queries/transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — interactive transaction pattern

### Tertiary (LOW confidence / ASSUMED)

- Prisma compound where input name for `@@unique([shop, id])` — needs verification post-`generate`

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing dependencies verified
- Architecture: HIGH — based on verified source files and official docs
- Pitfalls: HIGH — based on verified Next.js 16 docs and Prisma schema validation rules
- Session token contract: HIGH — verified against SDK source and Shopify docs

**Research date:** 2026-05-22
**Valid until:** 2026-07-01 (stable stack; @shopify/shopify-api 12.x, Prisma 7.x, Next.js 16.x — no planned upgrades)
