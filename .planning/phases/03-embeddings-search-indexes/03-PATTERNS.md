# Phase 3: Embeddings + Search Indexes — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 12 (8 NEW, 4 MODIFIED, + 2 doc/script)
**Analogs found:** 11 / 12 (1 file — `db/manual-indexes.sql` — has no in-tree analog; falls back to RESEARCH.md examples + the init migration's `vector` extension preamble)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `services/embeddings/EmbeddingService.ts` | service (new) | request-response (HTTP→AI Gateway) + DB write | `services/shopify/ShopifyProductService.ts` | role-match (both: named-export async functions in `services/<domain>/`; differs — Shopify service is GraphQL client + pure mapper, no DB writes) |
| `services/embeddings/__tests__/EmbeddingService.test.ts` | unit test (new) | mocked I/O | `services/shopify/__tests__/ShopifyProductService.test.ts` | exact (vi.hoisted + class-mock pattern) |
| `services/search/searchableText.ts` | utility (new) | pure transform | `lib/utils.ts` (`cn()`) + `services/shopify/ShopifyProductService.ts:mapToUpsertInput` | role-match (pure fn, named export, type-imports input) |
| `services/search/__tests__/searchableText.test.ts` | unit test (new) | pure-function test | `services/shopify/__tests__/ShopifyProductService.test.ts:36-50` (`describe('toDecimal')` block) | exact (small, no mocks, expect-only) |
| `lib/db/hnsw.ts` | utility (new, db-helper) | transaction wrapper | `lib/db/repositories/ProductRepository.ts:69-165` (`upsertProduct` uses `prisma.$transaction(async (tx) => ...)`) | role-match (same callback-form $transaction pattern; ours is smaller — just SET LOCAL + delegate) |
| `lib/db/__tests__/hnsw.test.ts` | unit test (new) | mocked prisma | `lib/db/repositories/__tests__/ProductRepository.test.ts:1-60` | exact ($transaction mock that invokes the callback) |
| `db/manual-indexes.sql` | manual SQL script (new top-level dir) | DDL | `prisma/migrations/20260207111413_init/migration.sql:1-2` (`CREATE EXTENSION IF NOT EXISTS vector`) | partial (only the extension line is reusable; HNSW/GIN are net-new SQL) |
| `scripts/apply-manual-indexes.ts` | script (new, RESEARCH Option B) | file→pg | — | no analog (`scripts/` directory does not yet exist); follows `prisma/seed.ts` style of standalone tsx script |
| `prisma/migrations/<ts>_add_embeddings_indexes/migration.sql` | migration (new) | DDL | `prisma/migrations/20260523152414_add_sync_pipeline/migration.sql:1-40` | exact (additive, header comment explaining "ADDITIVE migration", `ALTER TABLE ... ADD COLUMN` style) |
| `prisma/schema.prisma` | schema (modified) | model definition | existing `ProductEmbedding` block at lines 132-146 + `Unsupported("vector")` pattern at line 138 | exact (literal in-file pattern to mirror) |
| `inngest/functions/sync-products.ts` | inngest function (modified) | event-driven, step.run | self — the existing 3-step batch loop at lines 68-117 IS the analog | exact (insert a 4th step using the same `step.run(\`<id>-${cursorKey}\`, async () => { ... })` shape) |
| `inngest/functions/__tests__/sync-products.test.ts` | integration test (modified/extended) | InngestTestEngine | self — existing tests at lines 57-175 | exact (add `embedMany` mock + new step assertions to the existing `vi.hoisted` block) |
| `app/api/shopify/webhook/route.ts` | route handler (modified) | request-response | self — existing `products/create|update` branch at lines 131-143 | exact (insert one try/catch block after `upsertProduct` call) |
| `app/api/shopify/webhook/__tests__/route.test.ts` | integration test (modified/extended) | mocked POST | self — existing tests at lines 7-80 | exact (add `EmbeddingService` to the `vi.hoisted` block + extend `products/update` test) |
| `lib/db/repositories/ProductRepository.ts` | repository (POSSIBLY modified) | DB write | self — existing class at lines 68-190 | exact — **but CONTEXT.md D-09 puts the embedding upsert INSIDE `EmbeddingService.embedAndStore` via raw SQL, NOT on the repository.** Likely no edit needed; planner confirms during planning. |
| `package.json` | config (modified) | npm scripts | existing `"scripts"` block (lines 5-10) | role-match (currently only `dev/build/start/lint/test`; pattern is one-line shell command per script) |
| `CLAUDE.md` | docs (modified) | text | self — the `## Commands` and `## Environment Variables` sections | exact (insert two-step workflow note + `AI_GATEWAY_API_KEY` + `DIRECT_URL` env vars) |

---

## Pattern Assignments

### `services/embeddings/EmbeddingService.ts` (service, request-response + DB write)

**Analog:** `services/shopify/ShopifyProductService.ts`

**Module-export convention** (named-export async functions, no class, no singleton — explicitly chosen over the `ProductRepository` class-singleton pattern per CONTEXT.md "Established Patterns"):

```typescript
// services/shopify/ShopifyProductService.ts:143-178
export async function fetchProductBatch(
  session: Session,
  cursor: string | null,
  batchSize: number = 100
): Promise<FetchBatchResult> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request<{...}>(PRODUCTS_QUERY, {...});
  // ...
}

export async function fetchTotalCount(session: Session): Promise<number | null> { ... }
export function mapToUpsertInput(node: ShopifyProductNode): ProductUpsertInput { ... }
```

Mirror this: `EmbeddingService.ts` exports plain `embed`, `embedBatch`, `embedAndStore` + two `export const` constants (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`).

**Type-only import for input shape** (line 3 of analog):

```typescript
import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';
```

Mirror: `EmbeddingService.embedAndStore` takes `(shop: string, productId: number, text: string)` per CONTEXT.md D-09 — the `shop`-first signature mirrors Phase 1 D-03 repository contract (see `productRepository.upsertProduct(shop, input)` at `ProductRepository.ts:69`).

**Defensive error handling on external boundary** (analog's `fetchTotalCount` swallows errors → `null`, lines 168-178):

```typescript
export async function fetchTotalCount(session: Session): Promise<number | null> {
  const client = new shopifyClient.clients.Graphql({ session });
  try {
    const response = await client.request<{...}>(PRODUCTS_COUNT_QUERY);
    return response.data?.productsCount?.count ?? null;
  } catch {
    return null; // D-04: nullable; UI handles unknown totals gracefully
  }
}
```

Mirror: `embedBatch` wraps `embedMany` in try/catch and returns `{ ok: [], failed: [...inputsMappedToErrors] }` instead of rethrowing (RESEARCH §Pattern 1, lines 271-294). The discriminated `{ ok, failed }` shape is the Claude's-Discretion choice flagged by both CONTEXT.md and RESEARCH.md.

**Where analog DIFFERS:**
- ShopifyProductService.ts contains a *pure* mapper (`mapToUpsertInput`) — no DB writes, no Prisma import. `EmbeddingService` MUST import `prisma` for the `$executeRaw` upsert path in `embedAndStore` (RESEARCH §Pattern 1 lines 296-312). Add `import { prisma } from '@/lib/db/client'` at the top.
- ShopifyProductService is GraphQL/Shopify-specific (`shopifyClient.clients.Graphql`); EmbeddingService is HTTP/AI-Gateway via the `ai` package (`import { embed, embedMany } from 'ai'`).

---

### `services/embeddings/__tests__/EmbeddingService.test.ts` (unit, mocked I/O)

**Analog:** `services/shopify/__tests__/ShopifyProductService.test.ts`

**vi.hoisted + class-mock pattern** (lines 8-22 — the canonical Phase-2 mock pattern referenced by CONTEXT.md "Reusable Assets"):

```typescript
// services/shopify/__tests__/ShopifyProductService.test.ts:10-22
const { graphqlRequestMock } = vi.hoisted(() => ({
  graphqlRequestMock: vi.fn(),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    clients: {
      Graphql: class {
        request = graphqlRequestMock;
      },
    },
  },
}));
```

For Phase 3, the `ai` package is functional (not class-based), so use the simpler functional-mock form (also from RESEARCH §AI Gateway Mock Pattern lines 802-812):

```typescript
const { embedMock, embedManyMock, executeRawMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  embedManyMock: vi.fn(),
  executeRawMock: vi.fn(),
}));

vi.mock('ai', () => ({
  embed: embedMock,
  embedMany: embedManyMock,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: { $executeRaw: executeRawMock },
}));
```

**Test-clearing convention** (line 33):

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Where analog DIFFERS:** Phase 2 mocks a class with a `request` method; Phase 3 mocks two top-level functions from `ai`. Otherwise identical — same `mockResolvedValueOnce` / `mockRejectedValueOnce` shape.

---

### `services/search/searchableText.ts` (utility, pure transform)

**Analog (primary):** `lib/utils.ts` — for the "tiny pure-function module" shape:

```typescript
// lib/utils.ts (entire file, 6 lines)
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Analog (secondary):** `services/shopify/ShopifyProductService.ts:180-222` (`mapToUpsertInput`) — for "takes a typed product-shaped input, returns a transformed view":

```typescript
// services/shopify/ShopifyProductService.ts:180-194 (illustrative excerpt)
export function mapToUpsertInput(node: ShopifyProductNode): ProductUpsertInput {
  return {
    shopifyId: gidToBigInt(node.id),
    title: node.title,
    handle: node.handle,
    description: node.description ?? null,
    // ... `?? null` and `?? []` defaults throughout
    tags: node.tags ?? [],
    // ... nested map+default for variants/images/options
  };
}
```

Mirror: `buildSearchableText(product: ProductUpsertInput): string` from RESEARCH lines 569-581. Use `field?.trim() ?? ''` and `(arr ?? []).join(', ')` per the same `??` default pattern.

**Type-only import** (same convention as analog line 3):

```typescript
import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';
```

**Critical asymmetry callout for Phase 4** (per RESEARCH line 584 + D-04): The `tsvector` column does NOT include `options`. The embedding INPUT does. Document this asymmetry in a `//` comment block above `buildSearchableText` so Phase 4's `SearchService` cannot accidentally diverge.

---

### `services/search/__tests__/searchableText.test.ts` (pure-function test)

**Analog:** `services/shopify/__tests__/ShopifyProductService.test.ts:36-50` (the `describe('toDecimal')` block — pure function, no mocks, single-call assertions):

```typescript
// services/shopify/__tests__/ShopifyProductService.test.ts:36-50
describe('toDecimal (RESEARCH.md Q1 RESOLVED)', () => {
  it('handles String shape: "19.99" → 19.99', () => {
    expect(toDecimal('19.99')).toBeCloseTo(19.99);
  });

  it('handles MoneyV2 shape: { amount: "19.99", currencyCode: "USD" } → 19.99', () => {
    expect(toDecimal({ amount: '19.99', currencyCode: 'USD' })).toBeCloseTo(19.99);
  });

  it('returns NaN for unrecognized shapes', () => {
    expect(Number.isNaN(toDecimal(null))).toBe(true);
    // ...
  });
});
```

Mirror: small `describe('buildSearchableText')` block; no `vi.mock`, no `beforeEach`. Cases to cover: full input → labelled multi-line output; missing optional fields → `Title: \nDescription: \n...`; empty options array → `Options: ` (no trailing comma); trimming of whitespace.

---

### `lib/db/hnsw.ts` (utility, transaction wrapper)

**Analog:** `lib/db/repositories/ProductRepository.ts:69-72` — the callback-form `$transaction` (the EXACT shape RESEARCH §Pitfall 1 mandates):

```typescript
// lib/db/repositories/ProductRepository.ts:69-72 (snipped)
async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    // ... tx.product.upsert, tx.productVariant.createMany, ... all use `tx` not `prisma`
    return product;
  });
}
```

Mirror (RESEARCH §Pattern 2 lines 322-347):

```typescript
// lib/db/hnsw.ts
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db/client';

export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
```

**Import of `Prisma` namespace:** ProductRepository.ts line 2 imports `type { Product } from '@/app/generated/prisma/client'`. Use the same path for `type { Prisma }` (the Prisma namespace exposes `Prisma.TransactionClient`).

**Where analog DIFFERS:** ProductRepository's transaction wraps multi-table writes; this helper's transaction wraps one DDL-ish `SET LOCAL` + a delegated callback. Helper does NOT take a `shop` argument — it's a query-shape concern, not a multi-tenant write boundary (those concerns live in the callback's actual `$queryRaw`).

---

### `lib/db/__tests__/hnsw.test.ts` (unit test, mocked prisma)

**Analog:** `lib/db/repositories/__tests__/ProductRepository.test.ts:1-60` — the canonical "mock $transaction so the callback executes inline":

```typescript
// lib/db/repositories/__tests__/ProductRepository.test.ts:3-17
vi.mock('@/lib/db/client', () => ({
  prisma: {
    product: { findFirst: vi.fn(), /* ... */ },
    productVariant: { deleteMany: vi.fn(), createMany: vi.fn() },
    // ...
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Wire $transaction to execute the callback synchronously with the prisma mock as tx
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  );
});
```

Mirror for `withHnswIterativeScan`: mock `$transaction` to invoke its callback with a `tx` whose `$executeRaw` is a `vi.fn()`. Assert:
1. The callback was awaited inside `$transaction`.
2. `tx.$executeRaw` was called with a template string equal to `SET LOCAL hnsw.iterative_scan = 'relaxed_order'`.
3. The user callback ran AFTER the SET LOCAL (assert call-order via `mock.invocationCallOrder`).

Per RESEARCH Q3 (lines 732-735), a true integration smoke test (asserting `SELECT current_setting('hnsw.iterative_scan')` returns `'relaxed_order'`) needs a real Postgres connection — likely a separate `.integration-test.ts` file Phase 3 may defer. The mocked unit test is the minimum Phase 3 must ship.

---

### `db/manual-indexes.sql` (manual SQL script, new top-level dir)

**Analog (only one available — for the `CREATE EXTENSION` preamble):** `prisma/migrations/20260207111413_init/migration.sql:1-2`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

Mirror header style + idempotent shape (RESEARCH §Manual indexes SQL lines 587-620). The HNSW + GIN `CREATE INDEX IF NOT EXISTS` blocks are net-new SQL with no in-tree precedent.

**Header-comment convention:** The Phase 2 sync-pipeline migration (`20260523152414_add_sync_pipeline/migration.sql:1-11`) is the in-tree model for "header block explaining why this file exists + invariants":

```sql
-- Migration: 20260523152414_add_sync_pipeline
--
-- ADDITIVE migration. Creates SyncState enum, sync_runs table, and
-- webhook_events table. Adds the optional updatedAtShopify column to the
-- existing products table. No existing tables are dropped. Safe to run on
-- any Phase 1+ database.
--
-- Errors[] convention: each entry is a JSON-encoded {shopifyId, message}
-- string (per Plan 02-02 documentation in D-15). ...
```

Apply same style to `db/manual-indexes.sql`: heading + WHY-it-lives-outside-Prisma + the Phase-3 D-06 invariant ("re-run `bun db:indexes` after every `prisma migrate reset`").

**Where analog DIFFERS:** This file lives at top-level `db/` — a NEW directory in the repo. `ls` confirms no existing `db/` dir. Plan must `mkdir db/` (or `bunx mkdir` step) as a prerequisite.

---

### `scripts/apply-manual-indexes.ts` (standalone tsx script)

**Analog:** `prisma/seed.ts` (referenced in CLAUDE.md `bunx prisma db seed` — runs via `tsx`). The closest in-tree shape is any module that uses `import 'dotenv/config'` and reads `process.env.DATABASE_URL`:

```typescript
// lib/db/client.ts:1-10
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/app/generated/prisma/client';
import 'dotenv/config';
// ...
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
```

Mirror: same `import 'dotenv/config'` at top, same `process.env.DATABASE_URL` read, but with `pg.Client` directly (per RESEARCH lines 666-691).

**Where analog DIFFERS:** `lib/db/client.ts` uses Prisma's adapter; this script uses raw `pg.Client` to (a) sidestep the Accelerate-URL problem (Pitfall 6) and (b) pre-flight check pgvector >= 0.8.0 before applying SQL. Add `DIRECT_URL ?? DATABASE_URL` fallback per RESEARCH Q1 recommendation.

**Top-level `scripts/` dir:** Doesn't exist yet — `ls` confirms `/Users/ikhuda/sites/personal/shopify-search-app/scripts` is absent. Plan creates the dir.

---

### `prisma/migrations/<ts>_add_embeddings_indexes/migration.sql` (raw-SQL migration)

**Analog:** `prisma/migrations/20260523152414_add_sync_pipeline/migration.sql` (ENTIRE FILE) — the most-recent additive raw-SQL migration in tree.

**Header style** (lines 1-11) — already excerpted above.

**ALTER TABLE pattern** (line 40):

```sql
-- AlterTable
ALTER TABLE "products" ADD COLUMN "updatedAtShopify" TIMESTAMP(3);
```

Mirror: Phase 3 migration's `ADD COLUMN "modelVersion" TEXT NOT NULL`, `ADD COLUMN "searchableText" TEXT NOT NULL`, and the `ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (...) STORED` (the new generated-column form — no in-tree precedent, but RESEARCH §Prisma migration lines 624-648 has the exact SQL).

**Dev-row wipe precedent** — see `prisma/migrations/20260523011257_add_shop_column_destructive/migration.sql:1-13` for the "wipe table because NOT NULL column has no default" header style. Phase 3 migration's `DELETE FROM product_embeddings;` (RESEARCH line 630) must come with a comment matching this precedent.

**UNIQUE constraint additive pattern** (D-10 — `@@unique([shop, productShop, productId])`): The init migration uses `CREATE UNIQUE INDEX "products_shop_id_key" ON "products"("shop", "id");` at line 56 of `20260523011257_add_shop_column_destructive`. Mirror that exact SQL form, OR use `ALTER TABLE product_embeddings ADD CONSTRAINT product_embeddings_shop_productShop_productId_key UNIQUE (shop, "productShop", "productId");` per RESEARCH line 633.

**Where analog DIFFERS:** The Phase 2 sync-pipeline migration adds plain columns. Phase 3 adds a **generated** column (`GENERATED ALWAYS AS (...) STORED`) — no in-tree precedent; RESEARCH §Prisma migration is the only reference.

---

### `prisma/schema.prisma` (modify — additive only)

**Analog:** SELF — the existing `ProductEmbedding` block at lines 132-146:

```prisma
// prisma/schema.prisma:132-146 (current state)
model ProductEmbedding {
  id          Int                    @id @default(autoincrement())
  shop        String                 // redundant with parent — intentional (D-04)
  productShop String                 // composite FK field 1
  productId   Int                    // composite FK field 2
  content     String                 @db.Text
  embedding   Unsupported("vector")? // pgvector extension - will need raw SQL for migration
  createdAt   DateTime               @default(now())

  product Product @relation(fields: [productShop, productId], references: [shop, id], onDelete: Cascade)

  @@index([shop])
  @@index([productShop, productId])
  @@map("product_embeddings")
}
```

Mirror the `Unsupported("vector")?` pattern (line 138) — the same style applies if the planner attempts a `searchVector Unsupported("tsvector")?` on `Product`, **BUT** RESEARCH §Anti-Patterns line 473 explicitly forbids this (Prisma 6.7+ bug #27186 breaks the `search` operator on `Unsupported("tsvector")`). Keep the `searchVector` column ENTIRELY OUTSIDE the Prisma schema — only the raw SQL migration knows about it.

**Additions to `ProductEmbedding` (per D-10):**
```prisma
modelVersion   String     // NOT NULL — pinned model ID (D-09)
searchableText String     @db.Text  // diagnostics: what was actually embedded

@@unique([shop, productShop, productId])  // enables ON CONFLICT in upsert path
```

**Field-ordering convention:** Inline `//` comments after each field, same as existing block. The `@db.Text` annotation is the existing pattern for long-text fields (see `description` at line 22, `descriptionHtml` at line 23).

**Where analog DIFFERS:** No Prisma model in tree has a `String NOT NULL` field added after migrations on a populated table — Phase 1's destructive precedent (`20260523011257_add_shop_column_destructive`) is the closest. Phase 3's `DELETE FROM product_embeddings;` in the migration is the same flavor (dev-only stub rows, prod has none).

---

### `inngest/functions/sync-products.ts` (MODIFIED — insert 4th step)

**Analog:** SELF — the existing 3-step batch loop at lines 68-117 IS the analog. Mirror its exact `step.run(\`<step-id>-${cursorKey}\`, async () => { ... })` shape.

**The insertion site** — between `upsert-batch` (lines 75-99) and `persist-cursor` (lines 101-113). Pattern to mirror:

```typescript
// inngest/functions/sync-products.ts:75-99 (existing upsert-batch step — Phase 3 inserts NEW step right after this)
const { errors: upsertErrors }: { errors: UpsertError[] } = await step.run(
  `upsert-batch-${cursorKey}`,
  async () => {
    const batchErrors: UpsertError[] = [];
    for (const node of batch.products) {
      try {
        await productRepository.upsertProduct(shop, mapToUpsertInput(node));
      } catch (err) {
        batchErrors.push({
          shopifyId: node.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (
      batch.products.length > 0 &&
      batchErrors.length === batch.products.length
    ) {
      throw new Error(
        `Full batch failed: ${batchErrors.map((e) => e.message).join(', ')}`
      );
    }
    return { errors: batchErrors };
  }
);
```

Phase 3's NEW `embed-batch-${cursorKey}` step (RESEARCH §Pattern 3 lines 357-421) follows this EXACTLY:
- Same `step.run(\`<id>-${cursorKey}\`, async () => { ... })` shell.
- Same `batchErrors: UpsertError[]` accumulator.
- Same per-iteration `try/catch` that pushes `{ shopifyId, message }`.
- Same "throw only if 100% failed" guard at the end (matches EMB-02 / D-08).
- Same `return { errors: batchErrors }` shape.

**persist-cursor extension** — the existing step at lines 101-113 currently pushes ONLY `upsertErrors` into `errors[]`. Phase 3 modifies it to also push `embedErrors` (tagged `stage: 'embed'`). Existing pattern at line 109:

```typescript
errors: { push: upsertErrors.map((e) => JSON.stringify(e)) },
```

Phase 3 mutation (RESEARCH lines 424-437):

```typescript
errors: { push: [
  ...upsertErrors.map((e) => JSON.stringify(e)),
  ...embedErrors.map((e) => JSON.stringify({ ...e, stage: 'embed' })),
] },
```

**Import additions** at top of file: `import { embedBatch, EMBEDDING_MODEL } from '@/services/embeddings/EmbeddingService';` + `import { buildSearchableText } from '@/services/search/searchableText';`. Match the existing barrel-less import-from-specific-file style (lines 1-11 of analog).

**Where analog DIFFERS:** The new step writes pgvector rows via `prisma.$executeRaw` (inline) — the existing batch steps all delegate to typed Prisma client calls. This is a new pattern *for this file* but matches RESEARCH §Pattern 1's `embedAndStore` raw-SQL upsert.

---

### `inngest/functions/__tests__/sync-products.test.ts` (MODIFIED — extend)

**Analog:** SELF — the existing test file at lines 8-46 already has the `vi.hoisted` block to extend.

**vi.hoisted extension pattern** (lines 8-17):

```typescript
const { syncRunUpdate, syncRunFindUnique, upsertMock, fetchBatchMock, fetchTotalCountMock, mapToUpsertMock, loadSessionMock, getOfflineIdMock } = vi.hoisted(() => ({
  syncRunUpdate: vi.fn(),
  syncRunFindUnique: vi.fn(),
  upsertMock: vi.fn(),
  fetchBatchMock: vi.fn(),
  fetchTotalCountMock: vi.fn(),
  mapToUpsertMock: vi.fn(),
  loadSessionMock: vi.fn(),
  getOfflineIdMock: vi.fn((shop: string) => `offline_${shop}`),
}));
```

Mirror: add `embedBatchMock`, `executeRawMock`, `productFindUniqueMock` to the same destructure. Add:

```typescript
vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embedBatch: embedBatchMock,
  EMBEDDING_MODEL: 'openai/text-embedding-3-small',
}));

vi.mock('@/services/search/searchableText', () => ({
  buildSearchableText: vi.fn((p: { handle: string }) => `Title: ${p.handle}`),
}));
```

**Prisma mock extension** — the existing mock at lines 19-26 only exposes `syncRun.{update,findUnique}`. Phase 3 must add `$executeRaw: executeRawMock` and `product.findUnique: productFindUniqueMock` to the prisma mock (since the new step calls both).

**Existing test cases as templates** — the partial-failure test at lines 107-133 is the EXACT template for the new "partial embed failure → state=partial" test case. Mirror the structure: mock first product succeeds, second fails, assert `state: 'partial'` + `errorCount: 1` + `errors[]` contains an entry with `stage: 'embed'`.

**Where analog DIFFERS:** Existing tests don't assert step IDs by name; Phase 3 should add an assertion that `embed-batch-start` was called (via Inngest test harness's introspection, or by verifying `embedBatchMock.mock.calls.length` per cursor). Look at RESEARCH §Validation lines 774-775 for the exact assertion shape Phase 3 must add.

---

### `app/api/shopify/webhook/route.ts` (MODIFIED — 2-line insert)

**Analog:** SELF — the existing `products/create | products/update` branch at lines 131-143:

```typescript
// app/api/shopify/webhook/route.ts:131-143 (current state)
if (topic === 'products/create' || topic === 'products/update') {
  // SYN-11: stale-event guard via updatedAtShopify comparison.
  if (payload.handle) {
    const existing = await productRepository.findByShopAndHandle(shop, payload.handle);
    if (
      existing?.updatedAtShopify &&
      payload.updated_at &&
      new Date(payload.updated_at) < existing.updatedAtShopify
    ) {
      return NextResponse.json({ ok: true, skipped: 'stale' }, { status: 200 });
    }
  }
  await productRepository.upsertProduct(shop, mapWebhookPayloadToUpsertInput(payload));
}
```

Mirror: capture the upsert return value as `upserted`, then add try/catch around `embedAndStore`. RESEARCH §Pattern 4 lines 447-463:

```typescript
const mapped = mapWebhookPayloadToUpsertInput(payload);
const upserted = await productRepository.upsertProduct(shop, mapped);
try {
  await embedAndStore(shop, upserted.id, buildSearchableText(mapped));
} catch (err) {
  console.error('[webhook] embed failed for', upserted.id, err);
}
```

**Crucial:** `upsertProduct` returns `Product` (see `ProductRepository.ts:69` signature: `Promise<Product>`). The `upserted.id` is the local Prisma `Product.id`, not Shopify GID. This matches `EmbeddingService.embedAndStore`'s `productId: number` parameter (D-09).

**Import additions** — match existing barrel-less style at lines 12-16:

```typescript
import { embedAndStore } from '@/services/embeddings/EmbeddingService';
import { buildSearchableText } from '@/services/search/searchableText';
```

**Log-and-200 precedent:** The existing handler logs nothing and never swallows errors silently — it `throw err` at line 124 for non-P2002 cases. Phase 3 deliberately breaks this for embed-only failures per RESEARCH Pitfall 3 (lines 524-530). The `console.error` is intentional per PROJECT.md "No secrets in logs" — `err` here is a generic error message, not a token-bearing payload, so it's safe.

**Where analog DIFFERS:** The `products/delete` branch (lines 144-151) needs NO change — FK cascade from `Product` to `ProductEmbedding` handles it. Plan must NOT add embedding-deletion logic there.

---

### `app/api/shopify/webhook/__tests__/route.test.ts` (MODIFIED — extend)

**Analog:** SELF — the existing test file at lines 1-80.

**vi.hoisted extension** (lines 7-14):

```typescript
const { validateMock, webhookCreateMock, productFindFirstMock, upsertProductMock, deleteProductMock, findByShopAndHandleMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  webhookCreateMock: vi.fn(),
  productFindFirstMock: vi.fn(),
  upsertProductMock: vi.fn(),
  deleteProductMock: vi.fn(),
  findByShopAndHandleMock: vi.fn(),
}));
```

Mirror: add `embedAndStoreMock: vi.fn()` and `buildSearchableTextMock: vi.fn((p) => 'mocked-text')`. Add:

```typescript
vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embedAndStore: embedAndStoreMock,
}));
vi.mock('@/services/search/searchableText', () => ({
  buildSearchableText: buildSearchableTextMock,
}));
```

**upsertProductMock must now return a Product-shaped object** with `id` (since Phase 3 reads `upserted.id`). The existing test at line 75-onward already exercises this branch — extend `upsertProductMock.mockResolvedValue({ id: 42 })` and assert `embedAndStoreMock` was called with `('test.myshopify.com', 42, 'mocked-text')`.

**New test case:** "embed failure → returns 200" — mirror the existing `products/update` happy path but with `embedAndStoreMock.mockRejectedValueOnce(new Error('rate limit'))`. Assert: `res.status === 200`, `upsertProductMock` was called (the product IS saved), and `console.error` was called (use `vi.spyOn(console, 'error')`).

**Where analog DIFFERS:** None — pattern is identical to existing webhook test extensions.

---

### `lib/db/repositories/ProductRepository.ts` (POSSIBLY UNCHANGED)

**Analog:** SELF — the existing class at lines 68-190.

Per CONTEXT.md D-09, `EmbeddingService.embedAndStore` does its OWN `prisma.$executeRaw` upsert (see RESEARCH §Pattern 1 lines 296-312). The embedding write does NOT go through `ProductRepository`.

**Planner decision point:** If the planner picks "EmbeddingService delegates DB writes to repository" instead, the new method follows this pattern (lines 69-72):

```typescript
async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    // ...
  });
}
```

— except `upsertEmbedding(shop, productId, vector, modelVersion, text)` uses `$executeRaw` (not typed Prisma client) because `Unsupported("vector")` can't be written via the typed API. RESEARCH §Pattern 1 already shows the raw SQL.

**Recommendation:** Keep the write inside `EmbeddingService` per D-09. ProductRepository stays untouched.

---

### `package.json` (MODIFIED — add `db:indexes` script)

**Analog:** SELF — existing `scripts` block at lines 5-10:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

Mirror: one-line shell command per script entry. RESEARCH lines 654-662 gives two options:

```json
// Option A (psql — not installed locally per RESEARCH lines 80-81):
"db:indexes": "psql \"${DIRECT_URL:-$DATABASE_URL}\" -f db/manual-indexes.sql"

// Option B (Node script — RECOMMENDED per RESEARCH Q1 line 725):
"db:indexes": "bunx tsx scripts/apply-manual-indexes.ts"
```

**Where analog DIFFERS:** None — pattern is identical to existing scripts.

---

### `CLAUDE.md` (MODIFIED — document new commands + env vars)

**Analog:** SELF — the existing `## Commands` (lines 5-30 of CLAUDE.md) and `## Environment Variables` sections.

**Commands section pattern:**

```bash
bunx prisma migrate dev      # Apply migrations
bunx prisma generate         # Regenerate client after schema changes
```

Mirror — add:

```bash
bun db:indexes               # Apply manual pgvector + GIN indexes (run after every prisma migrate reset)
```

**Environment Variables section pattern:**

```
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API key (chat falls back gracefully if absent)
- `DATABASE_URL` — Postgres connection string (Prisma Accelerate URL)
```

Mirror — add two entries:

```
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key for embedding calls (required for EmbeddingService)
- `DIRECT_URL` — Direct Postgres URL (required in production when DATABASE_URL is Accelerate; bypassed by db:indexes script)
```

**Where analog DIFFERS:** None.

---

## Shared Patterns

### Multi-tenant `shop`-first parameter order

**Source:** `lib/db/repositories/ProductRepository.ts:69` (`upsertProduct(shop: string, ...)`) — locked by Phase 1 D-03.

**Apply to:**
- `EmbeddingService.embedAndStore(shop, productId, text)` — D-09 mandates this order.
- The embed-batch step in `sync-products.ts` — already has `shop` in closure from event data (line 41).
- Any future `SearchService.hybridSearch(shop, query)` (Phase 4 — out of Phase 3 scope).

```typescript
// Pattern (from ProductRepository.ts:69)
async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> { /* ... */ }
async findByShopAndId(shop: string, id: number): Promise<Product | null> { /* ... */ }
async findByShopAndHandle(shop: string, handle: string): Promise<Product | null> { /* ... */ }
```

### JSON-encoded errors[] convention

**Source:** `inngest/functions/sync-products.ts:109` — established Phase 2 D-15 + documented in `20260523152414_add_sync_pipeline/migration.sql:9-11`.

```typescript
// inngest/functions/sync-products.ts:109
errors: { push: upsertErrors.map((e) => JSON.stringify(e)) },
```

**Apply to:** Phase 3's embed-batch step — push `JSON.stringify({ shopifyId, message, stage: 'embed' })` so consumers can distinguish upsert vs embed failures post-mortem.

### vi.hoisted + functional vi.mock for top-level module imports

**Source:** Three reference files — same hoisted pattern in each:
- `services/shopify/__tests__/ShopifyProductService.test.ts:10-22` (mocks a class via `class { request = fn }`)
- `inngest/functions/__tests__/sync-products.test.ts:8-46` (mocks 5 separate modules)
- `app/api/shopify/webhook/__tests__/route.test.ts:7-33` (mocks 3 modules)

**Apply to:** Phase 3's EmbeddingService test, the extended sync-products test, the extended webhook test, and the new hnsw helper test. RESEARCH §AI Gateway Mock Pattern (lines 802-812) is the concrete recipe for mocking `ai`.

### Callback-form `prisma.$transaction` (NEVER array form)

**Source:** `lib/db/repositories/ProductRepository.ts:70`.

**Apply to:** `withHnswIterativeScan` helper (the whole reason the helper exists is to enforce this).

**Code-review rule** (per RESEARCH Pitfall 1 line 511): grep for `\$transaction\(\[` in any file touching `hnsw.iterative_scan` and reject.

### `??` defaulting for nullable Shopify fields

**Source:** Used throughout `services/shopify/ShopifyProductService.ts:180-222`:

```typescript
description: node.description ?? null,
tags: node.tags ?? [],
publishedAt: node.publishedAt ? new Date(node.publishedAt) : null,
```

**Apply to:** `buildSearchableText` — `field?.trim() ?? ''` and `(arr ?? []).join(', ')`.

### "No secrets in logs" — error.message NOT error object

**Source:** `inngest/functions/sync-products.ts:84-86`:

```typescript
batchErrors.push({
  shopifyId: node.id,
  message: err instanceof Error ? err.message : String(err),  // .message, not the full err
});
```

**Apply to:** Phase 3 embed-batch step error capture, AND the webhook `console.error('[webhook] embed failed for', upserted.id, err)` — `err` here is acceptable because `console.error` does not persist; if any Phase-3 code pushes to `SyncRun.errors[]`, use `err.message` only (matches PROJECT.md "No secrets in logs anywhere" constraint).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `db/manual-indexes.sql` (HNSW + GIN clauses specifically) | manual SQL DDL | DDL | No HNSW or GIN indexes exist in tree. The `CREATE EXTENSION IF NOT EXISTS vector` preamble has a precedent (init migration line 1) but `CREATE INDEX ... USING hnsw` and `CREATE INDEX ... USING GIN` are net-new. Planner uses RESEARCH §Manual indexes SQL lines 587-620 as the authoritative source. |
| `scripts/` directory + `apply-manual-indexes.ts` (full file) | one-off Node script | file→pg | No `scripts/` dir exists. The closest in-tree node-script is `prisma/seed.ts` (referenced via `bunx prisma db seed` in CLAUDE.md; not directly read in this pass). Planner can use `lib/db/client.ts:1-12` for the env-var-loading + dotenv pattern, then add a raw `pg.Client` connection per RESEARCH lines 666-691. |
| Generated `tsvector` column (`searchVector` ADD COLUMN) | DDL | DDL | No `GENERATED ALWAYS AS (...) STORED` columns exist in any in-tree migration. Pattern comes from RESEARCH §Prisma migration lines 636-647 only. |

---

## Metadata

**Analog search scope:** `services/`, `lib/`, `inngest/`, `app/api/shopify/`, `prisma/`, `package.json`, `CLAUDE.md`
**Files scanned:** 14 (sync-products.ts, sync-products.test.ts, ShopifyProductService.ts, ShopifyProductService.test.ts, ProductRepository.ts, ProductRepository.test.ts, route.ts (webhook), route.test.ts (webhook), client.ts (db), client.ts (shopify) — referenced only, utils.ts, schema.prisma, init migration, sync-pipeline migration, destructive-shop migration, package.json)
**Pattern extraction date:** 2026-05-25

## PATTERN MAPPING COMPLETE

**Phase:** 3 - embeddings-search-indexes
**Files classified:** 17 (8 new + 6 modified + 1 possibly-modified + 2 doc/config)
**Analogs found:** 14 / 17

### Coverage
- Files with exact analog: 11 (every modified file is its own analog; webhook test, sync-products test, schema.prisma, sync-products.ts, webhook/route.ts, EmbeddingService.test.ts via ShopifyProductService.test.ts, hnsw.test.ts via ProductRepository.test.ts, migration file via 20260523152414_add_sync_pipeline, schema.prisma via in-file ProductEmbedding block, package.json via existing scripts, CLAUDE.md via existing Commands section)
- Files with role-match analog: 3 (EmbeddingService.ts → ShopifyProductService.ts; searchableText.ts → lib/utils.ts + mapToUpsertInput; hnsw.ts → ProductRepository.upsertProduct $transaction usage)
- Files with no analog: 3 (db/manual-indexes.sql HNSW/GIN portion, scripts/apply-manual-indexes.ts, generated tsvector ADD COLUMN — all sourced from RESEARCH.md)

### Key Patterns Identified
- All services in `services/<domain>/` export plain named-export async functions; only `ProductRepository` uses a class+singleton (Phase 3 follows the function-export precedent of `ShopifyProductService`).
- All multi-tenant write/read paths take `shop` as the FIRST argument (Phase 1 D-03, replicated through Phase 2 and now Phase 3).
- All Vitest mocks use `vi.hoisted(() => ({ ... }))` + `vi.mock('@/path', () => ({ ... }))` at module top; `beforeEach(() => vi.clearAllMocks())` resets per-test.
- All `prisma.$transaction` usage in tree is the callback form `prisma.$transaction(async (tx) => { ... })`. RESEARCH Pitfall 1 elevates this to a mandatory code-review rule for `withHnswIterativeScan`.
- Errors push into `SyncRun.errors[]` as `JSON.stringify({...})` strings (Phase 2 D-15); Phase 3 extends by adding `stage: 'embed'` tag for diagnostics.
- The Inngest step ID convention `${stepName}-${cursor || 'start'}` (Phase 2 D-01) is the memoization key Phase 3's new `embed-batch-${cursorKey}` must follow.
- Raw-SQL upserts onto `Unsupported("vector")` columns go through `prisma.$executeRaw` template literals (Prisma typed client cannot generate them) — Phase 3 introduces this for the first time in app code; the precedent is the init migration's raw `vector` column declaration.

### File Created
`/Users/ikhuda/sites/personal/shopify-search-app/.planning/phases/03-embeddings-search-indexes/03-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog files (with line ranges) and concrete excerpts for every new and modified file in Phase 3 plans.
