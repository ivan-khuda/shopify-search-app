# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/shopify/auth.ts` | utility/service | request-response | `app/api/shopify/sync/route.ts` | exact (extracts its inline logic) |
| `lib/shopify/__tests__/auth.test.ts` | test | request-response | `app/api/shopify/sync/__tests__/route.test.ts` | exact |
| `lib/db/repositories/ProductRepository.ts` | repository | CRUD | `lib/shopify/session-storage.ts` + research Q8 | role-match |
| `lib/db/repositories/__tests__/ProductRepository.test.ts` | test | CRUD | `app/api/shopify/sync/__tests__/route.test.ts` | role-match |
| `proxy.ts` (renamed from `middleware.ts`) | middleware | request-response | `middleware.ts` | exact (rewrite of same file) |
| `__tests__/middleware.test.ts` | test | request-response | `__tests__/middleware.test.ts` | exact (update of same file) |
| `prisma/schema.prisma` | config/model | CRUD | `prisma/schema.prisma` (current) | exact (rewrite) |
| `prisma/migrations/<ts>_add_shop_column_destructive/migration.sql` | migration | batch | `prisma/migrations/20260207111413_init/migration.sql` | exact |
| `app/api/shopify/sync/route.ts` | controller | request-response | itself + new `lib/shopify/auth.ts` | exact |
| `app/api/shopify/sync/__tests__/route.test.ts` | test | request-response | itself | exact (mock swap) |
| `app/api/auth/route.ts` | controller | request-response | itself | exact (delete-only) |
| `app/api/auth/callback/route.ts` | controller | request-response | itself | exact (delete-only) |
| `app/(embedded)/onboarding/page.tsx` | component | request-response | itself | exact (delete-only) |

---

## Pattern Assignments

### `lib/shopify/auth.ts` (utility/service, request-response)

**Analog:** `app/api/shopify/sync/route.ts` (entire file — the inline auth ladder becomes this helper)

**Imports pattern** — copy exactly, sourced from `lib/shopify/client.ts` and `lib/shopify/session-storage.ts`:
```typescript
// lib/shopify/auth.ts
import type { Session } from '@shopify/shopify-api';
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';
```

**Error class pattern** — colocated in `auth.ts` (implementer's call per Claude's Discretion):
```typescript
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

**Core `verifyShopSessionToken` pattern** — transliterated from `app/api/shopify/sync/route.ts` lines 5-41 (the 5 error codes map to lines 7-8, 16-17, 20-21, 27-28, 31-32, 38-39 of sync route; `invalid_dest` is split out per D-06):
```typescript
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

**`withShopifySession` wrapper pattern** — wraps `verifyShopSessionToken`; error shape `{ error: code }` matches existing `app/api/shopify/sync/route.ts` and all current tests:
```typescript
type ShopifySessionContext = { shop: string; session: Session; req: Request };

export function withShopifySession(
  handler: (ctx: ShopifySessionContext) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const { shop, session } = await verifyShopSessionToken(req);
      return await handler({ shop, session, req });
    } catch (err) {
      if (err instanceof ShopifyAuthError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }
  };
}
```

---

### `lib/shopify/__tests__/auth.test.ts` (test, request-response)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts` (entire file — mock strategy, describe/it/beforeEach structure)

**Module mock pattern** — copy verbatim from `app/api/shopify/sync/__tests__/route.test.ts` lines 1-29:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shopify/client', () => {
  return {
    shopifyClient: {
      session: {
        decodeSessionToken: vi.fn(),
        getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
      },
    },
  };
});

vi.mock('@/lib/shopify/session-storage', () => {
  return {
    sessionStorage: {
      loadSession: vi.fn(),
    },
  };
});

import { verifyShopSessionToken, withShopifySession, ShopifyAuthError } from '../auth';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';
```

**Test scaffolding pattern** — from `app/api/shopify/sync/__tests__/route.test.ts` lines 38-40 and 42-48:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyShopSessionToken', () => {
  it('throws ShopifyAuthError("missing_token") when Authorization header is missing', async () => {
    const req = new Request('http://localhost/', { method: 'POST' });
    await expect(verifyShopSessionToken(req)).rejects.toThrow(ShopifyAuthError);
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'missing_token' });
  });

  it('throws ShopifyAuthError("invalid_token") when token cannot be decoded', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad token')
    );
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer broken' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'invalid_token' });
  });
  // ... mirror the 5 error codes + happy path from route.test.ts lines 42-111
});
```

**`vi.stubGlobal` pattern** (for `withShopifySession` wrapper tests when needed) — from `app/(embedded)/__tests__/onboarding.test.tsx` lines 13-21, 24-26:
```typescript
// Use vi.stubGlobal only when testing client-side globals (shopify, fetch).
// For server-side helpers like withShopifySession, vi.mock is sufficient.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```

---

### `lib/db/repositories/ProductRepository.ts` (repository, CRUD)

**Analog:** Research Q8 design + `lib/db/client.ts` singleton pattern

**Imports pattern** — `lib/db/client.ts` line 1 shows the import path for prisma; schema output path from `prisma/schema.prisma` line 9:
```typescript
// lib/db/repositories/ProductRepository.ts
import { prisma } from '@/lib/db/client';
import type { Product } from '@/app/generated/prisma';
```

**Note on current stub import:** The current `lib/db/repositories/ProductRepository.ts` imports `from "@prisma/client"` (line 1). After the schema migration regenerates the client to `app/generated/prisma`, the import path changes to `from '@/app/generated/prisma'`. This must be updated as part of the rewrite.

**Singleton export pattern** — from `lib/shopify/client.ts` line 5 and `lib/shopify/session-storage.ts` line 4 (all singletons are `export const`):
```typescript
export const productRepository = new ProductRepository();
```

**Interactive transaction pattern** — from Research Q8 (no existing `$transaction` usage in codebase; pattern is standard Prisma):
```typescript
async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    // Step 1: upsert Product row
    // Step 2: deleteMany children for (shop, productId)
    // Step 3: createMany children with { shop, productShop: shop, productId: product.id }
    return product;
  });
}
```

**Multi-tenant where clause pattern** — `shop` always first; `findFirst` used for compound lookup to avoid dependency on Prisma-generated compound-unique name (Pitfall 2 in RESEARCH.md):
```typescript
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
  // Use deleteMany to avoid dependency on Prisma-generated @@unique where name
  await prisma.product.deleteMany({ where: { shop, id } });
}
```

---

### `lib/db/repositories/__tests__/ProductRepository.test.ts` (test, CRUD)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts` (vi.mock structure, beforeEach, describe/it shape)

**Module mock pattern for Prisma** — no existing Prisma mock in codebase; use standard Vitest approach:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    productVariant: { deleteMany: vi.fn(), createMany: vi.fn() },
    productImage: { deleteMany: vi.fn(), createMany: vi.fn() },
    productOption: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { productRepository } from '../ProductRepository';
import { prisma } from '@/lib/db/client';

beforeEach(() => {
  vi.clearAllMocks();
});
```

**`$transaction` mock pattern** — transaction callback receives the mocked `tx` object:
```typescript
// Wire $transaction to execute the callback synchronously with the prisma mock as tx
(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
  async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
);
```

**Shop isolation test pattern** — verify `shop` is passed in every where clause:
```typescript
it('findByShopAndId scopes query to the given shop', async () => {
  (prisma.product.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  await productRepository.findByShopAndId('shop-a.myshopify.com', 42);
  expect(prisma.product.findFirst).toHaveBeenCalledWith({
    where: { shop: 'shop-a.myshopify.com', id: 42 },
  });
});
```

---

### `proxy.ts` (middleware, request-response)

**Analog:** `middleware.ts` (entire file — rewrite with logged-out console.logs, uncommented session check, updated exports)

**Current file shape** (`middleware.ts` lines 1-47) — the rewrite starts from this exact shape. Key changes:
1. Rename file to `proxy.ts`, rename export `middleware` → `proxy`
2. Delete `export const runtime = 'nodejs'` (line 43) — throws in Next.js 16 proxy
3. Delete `console.log` lines 9, 10, 13 (D-10)
4. Remove Bearer-header fallback block (lines 11-20)
5. Uncomment and complete session check (lines 22-33)
6. Update matcher (line 46) to `['/onboarding/:path*', '/chat/:path*']`

**Rewritten core pattern** — derives from existing `redirectToAuth` helper (lines 37-40) and commented-out session check (lines 27-33):
```typescript
// proxy.ts
import { NextRequest, NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const shop = request.nextUrl.searchParams.get('shop');

  if (!shop) {
    return redirectToAuth(request);
  }

  const offlineSessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(offlineSessionId);

  if (!session) {
    return redirectToAuth(request, shop);
  }

  return NextResponse.next();
}

function redirectToAuth(request: NextRequest, shop?: string): NextResponse {
  const authUrl = new URL('/api/auth', request.url);
  if (shop) authUrl.searchParams.set('shop', shop);
  return NextResponse.redirect(authUrl);
}

export const config = {
  matcher: ['/onboarding/:path*', '/chat/:path*'],
};
// NOTE: export const runtime = 'nodejs' is DELETED — throws in Next.js 16 proxy
```

---

### `__tests__/middleware.test.ts` (test, request-response)

**Analog:** `__tests__/middleware.test.ts` (itself — update, not rewrite)

**Current file shape** (lines 1-82). Changes required:
1. Update import on line 21: `import { middleware } from '../middleware'` → `import { proxy } from '../proxy'`
2. Update mock setup and call sites: `middleware(request)` → `proxy(request)` throughout
3. Remove Bearer fallback tests at lines 50-74 (tests `'extracts shop from valid App Bridge Bearer token'` and `'redirects when Bearer token is invalid'`)
4. Remove `decodeSessionToken` from the mock (no longer called in proxy)
5. Keep tests at lines 29-37, 39-48, 76-81 — these test session-present, session-missing, and no-shop behaviors that remain in the rewritten proxy

**Surviving tests pattern** (lines 29-37, 39-48, 76-81 — keep these as-is except call site rename):
```typescript
it('allows request when shop has offline session', async () => {
  vi.mocked(shopifyClient.session.getOfflineId).mockReturnValue('offline_test.myshopify.com');
  vi.mocked(sessionStorage.loadSession).mockResolvedValue({ shop: 'test.myshopify.com' } as never);

  const request = makeRequest('/chat?shop=test.myshopify.com');
  const response = await proxy(request);         // was: middleware(request)

  expect(response.status).toBe(200);
});

it('redirects to /api/auth when no offline session found', async () => {
  vi.mocked(shopifyClient.session.getOfflineId).mockReturnValue('offline_test.myshopify.com');
  vi.mocked(sessionStorage.loadSession).mockResolvedValue(undefined);

  const request = makeRequest('/chat?shop=test.myshopify.com');
  const response = await proxy(request);

  expect(response.status).toBe(307);
  expect(response.headers.get('Location')).toContain('/api/auth');
});

it('redirects when no shop can be determined', async () => {
  const request = makeRequest('/chat');          // no ?shop=
  const response = await proxy(request);

  expect(response.status).toBe(307);
});
```

**Updated mock block** — remove `decodeSessionToken` since proxy no longer calls it:
```typescript
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      // decodeSessionToken removed — proxy does not use it
      getOfflineId: vi.fn(),
    },
  },
}));
```

---

### `prisma/schema.prisma` (config/model, CRUD)

**Analog:** `prisma/schema.prisma` (itself — rewrite; `ShopifySession` model stays untouched)

**Generator + datasource block** (lines 7-14) — copy verbatim, unchanged:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

**`ShopifySession` model** (lines 131-151) — copy verbatim, absolutely unchanged.

**New `Product` model pattern** — from Research Q1; keeps autoincrement `@id`, adds `shop String`, adds `@@unique([shop, id])` and `@@index([shop])`:
```prisma
model Product {
  id          Int      @id @default(autoincrement())
  shop        String   // myshopify.com hostname (e.g., "example-store.myshopify.com")
  shopifyId   BigInt?
  // ... all other existing fields (title, handle, description, etc.) unchanged ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  variants   ProductVariant[]
  images     ProductImage[]
  options    ProductOption[]
  embeddings ProductEmbedding[]

  @@unique([shop, id])
  @@index([shop])
  @@index([shopifyId])
  @@index([shop, shopifyId])
  @@index([status])
  @@map("products")
}
```

**Child model pattern** — `ProductVariant` as representative; `ProductImage`, `ProductOption`, `ProductEmbedding` follow same shape:
```prisma
model ProductVariant {
  id          Int    @id @default(autoincrement())
  shop        String  // redundant with parent — intentional (D-04)
  productShop String  // composite FK field 1
  productId   Int     // composite FK field 2
  // ... all other existing fields unchanged (title, sku, price, etc.) ...

  product Product @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_variants")
}
```

**`ProductImage` nullable composite FK** (both nullable to mirror existing `productId Int?`):
```prisma
model ProductImage {
  id          Int     @id @default(autoincrement())
  shop        String
  productShop String? // nullable — mirrors productId Int?
  productId   Int?
  variantId   Int?
  // ... existing fields ...

  product Product?        @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)
  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_images")
}
```

---

### `prisma/migrations/<ts>_add_shop_column_destructive/migration.sql` (migration, batch)

**Analog:** `prisma/migrations/20260207111413_init/migration.sql` (entire file — column names, type names, index naming convention)

**Header comment pattern** — from `prisma/migrations/20260502011528_update_shopify_session_schema/migration.sql` lines 1-6 (Prisma auto-generates warning comments):
```sql
-- Migration: YYYYMMDDHHMMSS_add_shop_column_destructive
-- WARNING: Destructive migration. Drops all product tables and recreates with shop column.
-- No production data exists. Developer environments: bunx prisma migrate reset.
```

**pgvector extension guard** — from `prisma/migrations/20260207111413_init/migration.sql` line 2:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**DROP TABLE order** — children before parent (CASCADE handles FKs but order is still correct practice):
```sql
DROP TABLE IF EXISTS "product_embeddings" CASCADE;
DROP TABLE IF EXISTS "product_options" CASCADE;
DROP TABLE IF EXISTS "product_images" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
```

**CREATE TABLE column naming convention** — from `20260207111413_init/migration.sql` lines 5-25 (camelCase quoted column names, `TIMESTAMP(3)`, `DECIMAL(10,2)`, `TEXT[]` for arrays):
```sql
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyId" BIGINT,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    -- ... other columns verbatim from init migration ...
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
```

**New index naming convention** — from `20260207111413_init/migration.sql` lines 94-113 (pattern: `"tablename_columnname_key"` for unique, `"tablename_columnname_idx"` for non-unique):
```sql
CREATE UNIQUE INDEX "products_shop_id_key" ON "products"("shop", "id");
CREATE INDEX "products_shop_idx" ON "products"("shop");
CREATE INDEX "products_shop_shopifyId_idx" ON "products"("shop", "shopifyId");
```

**Composite FK constraint pattern** — from `20260207111413_init/migration.sql` lines 155-167 (`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`):
```sql
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_productShop_productId_fkey"
  FOREIGN KEY ("productShop", "productId")
  REFERENCES "products"("shop", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**pgvector column in `product_embeddings`** — must be raw SQL (from `20260207111413_init/migration.sql` line 89):
```sql
CREATE TABLE "product_embeddings" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "productShop" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,               -- pgvector type; Prisma schema uses Unsupported("vector")
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id")
);
```

---

### `app/api/shopify/sync/route.ts` (controller, request-response) — REWRITE

**Analog:** itself (current 45-line file) + new `lib/shopify/auth.ts`

**Before pattern** — current file lines 1-45 (35-line auth ladder inline)

**After pattern** — reduces to wrapper invocation. Error shape `{ error: code }` is preserved by `withShopifySession` so existing tests continue to pass without error-path test changes:
```typescript
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';

export const POST = withShopifySession(async ({ shop, session }) => {
  // TODO: wire real syncProducts(session). Tracked in docs/superpowers/specs/...
  void shop;
  void session;
  return NextResponse.json({ success: true });
});
```

---

### `app/api/shopify/sync/__tests__/route.test.ts` (test, request-response) — MOCK SWAP

**Analog:** itself (current file lines 1-111)

**Option A: Mock `verifyShopSessionToken` directly** (preferred — tests the contract boundary, not internals):
```typescript
// Replace the two vi.mock blocks at lines 3-25 with a single mock of the auth helper:
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession: vi.fn(
    (handler) => async (req: Request) => {
      // The mock runs verifyShopSessionToken via the real shopifyClient/sessionStorage mocks
      // OR: control auth result directly per-test via mockImplementation
      return handler({ shop: 'example-shop.myshopify.com', session: mockSession, req });
    }
  ),
  verifyShopSessionToken: vi.fn(),
  ShopifyAuthError: class ShopifyAuthError extends Error {
    constructor(public code: string, public status = 401) { super(code); }
  },
}));
```

**Option B: Keep existing mocks** — `shopifyClient.session.decodeSessionToken` and `sessionStorage.loadSession` mocks at lines 3-25 still work because `verifyShopSessionToken` calls them internally. No test changes needed except confirming the test imports still resolve. This is the **lower-risk option** for Phase 1 since all 6 tests pass without modification.

**Recommendation:** Use Option B for Phase 1 (zero test breakage risk). Option A can be a follow-up refactor.

---

### `app/api/auth/route.ts` — DELETE-ONLY

**Pattern:** Delete lines 7-8 verbatim. No other changes.
```typescript
// DELETE these two lines:
console.log('shop', shop);
console.log("shopifyClient", shopifyClient);
```

---

### `app/api/auth/callback/route.ts` — DELETE-ONLY

**Pattern:** Delete line 16 verbatim. No other changes.
```typescript
// DELETE this line:
console.log('redirectUrl', redirectUrl.toString());
```

---

### `app/(embedded)/onboarding/page.tsx` — DELETE-ONLY

**Pattern:** Delete line 13 verbatim. No other changes.
```typescript
// DELETE this line:
console.log("token", token);
```

---

## Shared Patterns

### Authentication helper (apply to all embedded API routes)
**Source:** `app/api/shopify/sync/route.ts` lines 1-45 (current shape); `lib/shopify/auth.ts` (new target)
**Apply to:** `app/api/shopify/sync/route.ts` now; all future embedded API routes (`/api/shopify/sync/status`, `/api/chat`, `/api/settings/*`) in later phases
```typescript
// Wrap every embedded API route handler with:
export const POST = withShopifySession(async ({ shop, session }) => {
  // handler body — shop is verified, session is loaded
});
```

### Error response shape (must remain consistent)
**Source:** `app/api/shopify/sync/route.ts` lines 8, 17, 21, 28, 32, 39 (current)
**Apply to:** All auth error returns in `withShopifySession`
```typescript
// All auth errors use this exact shape — existing tests assert on `body.error`:
NextResponse.json({ error: err.code }, { status: err.status })
```

### Singleton export pattern
**Source:** `lib/shopify/client.ts` line 5, `lib/shopify/session-storage.ts` line 4, `lib/db/client.ts` line 4
**Apply to:** `productRepository` in `lib/db/repositories/ProductRepository.ts`, `verifyShopSessionToken`/`withShopifySession` as plain function exports in `lib/shopify/auth.ts`
```typescript
// Functions: plain named exports (not class methods)
export async function verifyShopSessionToken(...) { ... }
export function withShopifySession(...) { ... }

// Repository: class instance singleton
export const productRepository = new ProductRepository();
```

### `@/` path alias (all new imports)
**Source:** `tsconfig.json` (resolve alias `@/` → project root), used throughout codebase
**Apply to:** All new files — use `@/lib/shopify/auth`, `@/lib/db/client`, `@/lib/db/repositories/ProductRepository`, `@/app/generated/prisma`

### Vitest mock structure
**Source:** `app/api/shopify/sync/__tests__/route.test.ts` lines 1-40
**Apply to:** `lib/shopify/__tests__/auth.test.ts`, `lib/db/repositories/__tests__/ProductRepository.test.ts`
- `vi.mock(...)` blocks before all imports (hoisted automatically)
- `import` of mocked modules after `vi.mock` blocks
- `beforeEach(() => vi.clearAllMocks())` in every describe block
- `vi.stubGlobal` / `vi.unstubAllGlobals` only for browser globals (follow `onboarding.test.tsx` lines 13-26)

---

## No Analog Found

All files have clear analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `app/api/`, `lib/shopify/`, `lib/db/`, `__tests__/`, `app/(embedded)/`, `prisma/`
**Files scanned:** 15 source files read directly
**Pattern extraction date:** 2026-05-22
