# Phase 2: Sync Pipeline - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 17 (9 created, 8 modified)
**Analogs found:** 15 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/inngest/client.ts` | config/singleton | — | `lib/shopify/client.ts` | role-match |
| `inngest/functions/sync-products.ts` | service | batch + event-driven | `lib/sync/productSync.ts` + RESEARCH.md | partial |
| `inngest/functions/__tests__/sync-products.test.ts` | test | — | `app/api/shopify/sync/__tests__/route.test.ts` | role-match |
| `app/api/inngest/route.ts` | route | request-response | RESEARCH.md Q1 snippet | no-analog (new pattern) |
| `app/api/shopify/sync/status/route.ts` | route/controller | request-response | `app/api/shopify/sync/route.ts` | exact |
| `app/api/shopify/sync/status/__tests__/route.test.ts` | test | — | `app/api/shopify/sync/__tests__/route.test.ts` | exact |
| `app/api/shopify/webhook/__tests__/route.test.ts` | test | — | `app/api/shopify/sync/__tests__/route.test.ts` | role-match |
| `services/shopify/__tests__/ShopifyProductService.test.ts` | test | — | `app/api/shopify/sync/__tests__/route.test.ts` | role-match |
| `prisma/migrations/<timestamp>_add_sync_pipeline/migration.sql` | migration | — | `prisma/migrations/20260523011257_add_shop_column_destructive/migration.sql` | role-match |
| `prisma/schema.prisma` (modify) | model/config | — | itself (existing enum + model block style) | exact |
| `app/api/shopify/sync/route.ts` (rewrite) | route/controller | request-response | itself (current stub) + `lib/shopify/auth.ts` | exact |
| `app/api/shopify/sync/__tests__/route.test.ts` (extend) | test | — | itself (current 6 tests) | exact |
| `app/api/shopify/webhook/route.ts` (rewrite) | route/middleware | request-response | itself (current stub) + RESEARCH.md Q4 | exact |
| `app/(embedded)/onboarding/page.tsx` (extend) | component | request-response + polling | itself (current page) | exact |
| `app/(embedded)/__tests__/onboarding.test.tsx` (extend) | test | — | itself (current tests) | exact |
| `services/shopify/ShopifyProductService.ts` (rewrite) | service | batch | itself (stub) + RESEARCH.md Q2 | partial |
| `lib/db/repositories/ProductRepository.ts` (extend) | repository | CRUD | itself — `findByShopAndId` (line 165) | exact |

---

## Pattern Assignments

### `lib/inngest/client.ts` (config, singleton export)

**Analog:** `lib/shopify/client.ts` (lines 1–13)

**Singleton export pattern** (`lib/shopify/client.ts` lines 1–13):
```typescript
import '@shopify/shopify-api/adapters/web-api';
import { ApiVersion, shopifyApi } from '@shopify/shopify-api';
import { sessionStorage } from './session-storage';

export const shopifyClient = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: ['read_products'],
  hostName: process.env.HOST!,
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: true,
  sessionStorage,
});
```

**Apply to `lib/inngest/client.ts`:** follow the same pattern — one named export from a config object built from env vars. No `globalThis` guard needed (Inngest client is stateless).

```typescript
// lib/inngest/client.ts  (target pattern from RESEARCH.md Q6)
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'smartdiscovery-ai' });
```

---

### `inngest/functions/sync-products.ts` (service, batch + event-driven)

**Analog:** RESEARCH.md Q1 + Q6 (no direct codebase analog; closest structural analog is `lib/sync/productSync.ts`)

**Imports pattern** (from RESEARCH.md Q6):
```typescript
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import { fetchProductBatch, fetchTotalCount } from '@/services/shopify/ShopifyProductService';
import { sessionStorage } from '@/lib/shopify/session-storage';
import { shopifyClient } from '@/lib/shopify/client';
```

**Function creation pattern** (RESEARCH.md Q1, lines 256–263):
```typescript
export const syncProductsFunction = inngest.createFunction(
  { id: 'sync-products', retries: 3 },
  { event: 'shopify/product.sync' },
  async ({ event, step }) => {
    const { syncRunId, shop } = event.data as { syncRunId: string; shop: string };
    // ...
  }
);
```

**Three-step batch loop** (RESEARCH.md Q1, lines 280–317):
```typescript
const batch = await step.run(`fetch-batch-${cursor ?? 'start'}`, async () => {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request(PRODUCTS_QUERY, {
    variables: { first: 100, after: cursor },
  });
  return {
    products: response.data.products.nodes,
    endCursor: response.data.products.pageInfo.endCursor,
    hasNextPage: response.data.products.pageInfo.hasNextPage,
  };
});

await step.run(`upsert-batch-${cursor ?? 'start'}`, async () => {
  const batchErrors: Array<{ shopifyId: string; message: string }> = [];
  for (const product of batch.products) {
    try {
      await productRepository.upsertProduct(shop, mapToUpsertInput(product));
    } catch (err) {
      batchErrors.push({ shopifyId: product.id, message: String(err) });
    }
  }
  if (batchErrors.length === batch.products.length) {
    throw new Error(`Full batch failed: ${batchErrors.map(e => e.message).join(', ')}`);
  }
  return { errors: batchErrors };
});

await step.run(`persist-cursor-${cursor ?? 'start'}`, async () => {
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: {
      cursor: batch.endCursor,
      processedCount: { increment: batch.products.length - upsertErrors.length },
      errors: { push: upsertErrors.map(e => JSON.stringify(e)) },
    },
  });
  return { cursor: batch.endCursor };
});
```

**inngest.send() dispatch** (RESEARCH.md Q1, lines 323–336) — use in sync POST route, not this file.

---

### `app/api/inngest/route.ts` (route, serve handler)

**No close codebase analog** — this is a framework integration route. Use RESEARCH.md Q1 pattern directly.

**Serve handler pattern** (RESEARCH.md Q1, lines 243–250):
```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { syncProductsFunction } from '@/inngest/functions/sync-products';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction],
});
```

---

### `app/api/shopify/sync/status/route.ts` (route, request-response GET)

**Analog:** `app/api/shopify/sync/route.ts` (lines 1–11)

**withShopifySession wrapper pattern** (`app/api/shopify/sync/route.ts` lines 1–11):
```typescript
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';

export const GET = withShopifySession(async ({ shop, session, req }) => {
  void session;
  // parse syncRunId from req URL
  const { searchParams } = new URL(req.url);
  const syncRunId = searchParams.get('syncRunId');
  if (!syncRunId) {
    return NextResponse.json({ error: 'missing_sync_run_id' }, { status: 400 });
  }
  // load SyncRun WHERE id = syncRunId AND shop = shop
  // return 404 if not found, 403 if wrong shop
  return NextResponse.json({ ...syncRun });
});
```

**Error response shape** (from `lib/shopify/auth.ts` lines 79):
```typescript
return NextResponse.json({ error: err.code }, { status: err.status });
// All 4xx: NextResponse.json({ error: '<code>' }, { status: NNN })
```

---

### `app/api/shopify/sync/route.ts` rewrite (route, request-response POST)

**Analog:** itself (current stub, lines 1–11) + `lib/shopify/auth.ts` `withShopifySession` wrapper

**Current file structure to preserve** (`app/api/shopify/sync/route.ts` lines 1–11):
```typescript
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';

export const POST = withShopifySession(async ({ shop, session }) => {
  void shop;
  void session;
  return NextResponse.json({ success: true });
});
```

**inngest.send() pattern** (RESEARCH.md Q1, lines 323–336):
```typescript
await inngest.send({
  id: `sync-${shop}-${Math.floor(Date.now() / 300_000)}`,
  name: 'shopify/product.sync',
  data: { syncRunId: run.id, shop: shop },
});
```

**Idempotency key pattern** (D-05 from CONTEXT.md):
```typescript
import { createHash } from 'node:crypto';
const idempotencyKey = createHash('sha256')
  .update(`${shop}|${Math.floor(Date.now() / 300_000)}`)
  .digest('hex');
```

---

### `app/api/shopify/webhook/route.ts` rewrite (route, middleware)

**Analog:** itself (current stub, lines 1–6) + RESEARCH.md Q4

**HMAC + dedup + raw-body-first pattern** (RESEARCH.md Q4, lines 550–585):
```typescript
export async function POST(req: Request) {
  // STEP 1: Read raw body BEFORE JSON.parse
  const rawBody = await req.text();

  // STEP 2: Validate HMAC using the webhooks.validate API
  const validation = await shopifyClient.webhooks.validate({
    rawBody,
    rawRequest: req,
  });

  if (!validation.valid) {
    return Response.json({ error: 'invalid_hmac' }, { status: 401 });
  }

  const shop = validation.domain;
  const topic = validation.topic;

  // STEP 3: Dedup
  const eventId = req.headers.get('x-shopify-event-id')!;
  try {
    await prisma.webhookEvent.create({ data: { eventId, shop, topic } });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return Response.json({ ok: true }, { status: 200 });
    }
    throw err;
  }

  // STEP 4: Parse after validation
  const payload = JSON.parse(rawBody);
  // ...
}
```

**P2002 unique violation check pattern** — use `(err as { code?: string }).code === 'P2002'` (Prisma error code for unique constraint violation). No import needed from Prisma.

**Conflict resolution guard** (D-17 from CONTEXT.md):
```typescript
const existing = await productRepository.findByShopAndHandle(shop, payload.handle);
if (existing?.updatedAtShopify && payload.updated_at &&
    new Date(payload.updated_at) < existing.updatedAtShopify) {
  return Response.json({ ok: true }, { status: 200 }); // stale event, skip
}
await productRepository.upsertProduct(shop, mapped);
```

---

### `services/shopify/ShopifyProductService.ts` rewrite (service, batch)

**Analog:** itself (current 11-line stub) + RESEARCH.md Q2

**GraphQL client creation pattern** (RESEARCH.md Q2, lines 449–450):
```typescript
import { shopifyClient } from '@/lib/shopify/client';
import type { Session } from '@shopify/shopify-api';

const client = new shopifyClient.clients.Graphql({ session });
const response = await client.request(PRODUCTS_QUERY, {
  variables: { first: batchSize, after: cursor },
});
```

**fetchProductBatch function signature** (RESEARCH.md Q2, lines 444–459):
```typescript
export async function fetchProductBatch(
  session: Session,
  cursor: string | null,
  batchSize: number
): Promise<{ products: ShopifyProductNode[]; endCursor: string | null; hasNextPage: boolean }> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request(PRODUCTS_QUERY, {
    variables: { first: batchSize, after: cursor },
  });
  return {
    products: response.data.products.nodes,
    endCursor: response.data.products.pageInfo.endCursor,
    hasNextPage: response.data.products.pageInfo.hasNextPage,
  };
}
```

**fetchTotalCount function** (RESEARCH.md Q2, lines 461–464):
```typescript
export async function fetchTotalCount(session: Session): Promise<number | null> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request(`query { productsCount { count } }`);
  return response.data?.productsCount?.count ?? null;
}
```

**GraphQL query shape** (RESEARCH.md Q2, lines 363–413) — use `variants(first: 10)` and `images(first: 10)` per Q8 cost analysis (keeps query cost ~300 points, well within 1000/10s limit).

**GID extraction:** `BigInt(id.split('/').pop()!)` for `shopifyId`; `parseFloat(price)` for variant prices.

---

### `lib/db/repositories/ProductRepository.ts` extension (repository, CRUD)

**Analog:** itself — `findByShopAndId` method (lines 165–167)

**findByShopAndId pattern to copy for findByShopAndHandle** (`ProductRepository.ts` lines 165–167):
```typescript
async findByShopAndId(shop: string, id: number): Promise<Product | null> {
  return prisma.product.findFirst({ where: { shop, id } });
}
```

**New method to add:**
```typescript
async findByShopAndHandle(shop: string, handle: string): Promise<Product | null> {
  return prisma.product.findFirst({ where: { shop, handle } });
}
```

**ProductUpsertInput extension** (lines 41–59) — add `updatedAtShopify?: Date | null` field to the existing interface.

---

### `app/(embedded)/onboarding/page.tsx` extension (component, polling)

**Analog:** itself (current, lines 1–66)

**Current useState + fetch pattern** (`onboarding/page.tsx` lines 6–30):
```typescript
'use client';
import { useState } from 'react';

export default function OnboardingPage() {
  const [syncing, setSyncing] = useState(false);

  async function handleStartSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        shopify.toast.show('Sync started');
      } else if (res.status === 401) {
        shopify.toast.show('Session expired. Reload the app.', { isError: true });
      } else {
        shopify.toast.show('Sync failed. Try again.', { isError: true });
      }
    } catch {
      shopify.toast.show('Sync failed. Try again.', { isError: true });
    } finally {
      setSyncing(false);
    }
  }
```

**Polling useEffect pattern to add** (extend with `useEffect`):
```typescript
import { useState, useEffect } from 'react';

// Add to state:
const [syncRunId, setSyncRunId] = useState<string | null>(null);
const [syncState, setSyncState] = useState<'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | null>(null);
const [processedCount, setProcessedCount] = useState(0);
const [totalCount, setTotalCount] = useState<number | null>(null);

// After successful POST, capture syncRunId:
// const data = await res.json();
// setSyncRunId(data.syncRunId);

// Polling effect:
useEffect(() => {
  if (!syncing || !syncRunId) return;
  const id = setInterval(async () => {
    const token = await shopify.idToken();
    const res = await fetch(`/api/shopify/sync/status?syncRunId=${syncRunId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSyncState(data.state);
      setProcessedCount(data.processedCount);
      setTotalCount(data.totalCount ?? null);
      if (['succeeded', 'partial', 'failed'].includes(data.state)) {
        clearInterval(id);
        setSyncing(false);
      }
    }
  }, 2000);
  return () => clearInterval(id);
}, [syncing, syncRunId]);
```

**Progress bar + Polaris web component pattern** (per D-13 from CONTEXT.md):
```tsx
// Replace start-sync button once syncRunId is set:
{syncRunId ? (
  <s-progress-bar value={totalCount ? Math.round((processedCount / totalCount) * 100) : 0} />
) : (
  <s-button data-testid="start-sync" variant="primary" onClick={handleStartSync}
    {...(syncing ? { loading: '' } : {})}>
    Start sync
  </s-button>
)}
```

---

### Prisma schema additions (model, config)

**Analog:** existing `prisma/schema.prisma` enum and model block style

**Enum + model pattern** (RESEARCH.md Q7, lines 726–758):
```prisma
enum SyncState {
  queued
  running
  succeeded
  failed
  partial
}

model SyncRun {
  id             String    @id @default(cuid())
  shop           String
  state          SyncState @default(queued)
  processedCount Int       @default(0)
  totalCount     Int?
  errors         String[]  @default([])
  cursor         String?
  idempotencyKey String    @unique
  startedAt      DateTime  @default(now())
  finishedAt     DateTime?

  @@index([shop])
  @@map("sync_runs")
}

model WebhookEvent {
  eventId    String   @id
  shop       String
  topic      String
  receivedAt DateTime @default(now())

  @@index([shop])
  @@map("webhook_events")
}
```

**Product model addition** (D-17):
```prisma
// Add to existing Product model block:
updatedAtShopify DateTime?
```

---

### Migration SQL (migration, additive)

**Analog:** `prisma/migrations/20260523011257_add_shop_column_destructive/migration.sql`

**CREATE TABLE style to copy** (migration.sql lines 35–61 — column alignment, CONSTRAINT naming, inline comment header):
```sql
-- Migration: <timestamp>_add_sync_pipeline
--
-- ADDITIVE migration. Creates SyncState enum, sync_runs table, and
-- webhook_events table. Adds updatedAtShopify column to products.
-- No existing tables are dropped. Safe to run on any Phase 1+ database.

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');

-- CreateTable
CREATE TABLE "sync_runs" (
    "id"             TEXT          NOT NULL,
    "shop"           TEXT          NOT NULL,
    "state"          "SyncState"   NOT NULL DEFAULT 'queued',
    "processedCount" INTEGER       NOT NULL DEFAULT 0,
    "totalCount"     INTEGER,
    "errors"         TEXT[]        DEFAULT ARRAY[]::TEXT[],
    "cursor"         TEXT,
    "idempotencyKey" TEXT          NOT NULL,
    "startedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"     TIMESTAMP(3),
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "eventId"    TEXT          NOT NULL,
    "shop"       TEXT          NOT NULL,
    "topic"      TEXT          NOT NULL,
    "receivedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("eventId")
);

-- AlterTable (additive only)
ALTER TABLE "products" ADD COLUMN "updatedAtShopify" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sync_runs_idempotencyKey_key" ON "sync_runs"("idempotencyKey");
CREATE INDEX "sync_runs_shop_idx" ON "sync_runs"("shop");
CREATE INDEX "webhook_events_shop_idx" ON "webhook_events"("shop");
```

---

### Test files — Wave 0 RED stubs and extensions

#### `inngest/functions/__tests__/sync-products.test.ts` (new)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts` (lines 1–111) + RESEARCH.md Q9

**vi.mock block placement pattern** (sync route test lines 1–26 — mocks before imports):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: { syncRun: { update: vi.fn() } } }));
vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: { upsertProduct: vi.fn().mockResolvedValue({}) }
}));
vi.mock('@/services/shopify/ShopifyProductService', () => ({
  fetchProductBatch: vi.fn(),
  fetchTotalCount: vi.fn().mockResolvedValue(1),
}));

import { InngestTestEngine } from '@inngest/test';
import { syncProductsFunction } from '../sync-products';
```

**InngestTestEngine execute pattern** (RESEARCH.md Q9, lines 846–857):
```typescript
describe('syncProductsFunction', () => {
  const t = new InngestTestEngine({ function: syncProductsFunction });

  it('processes a single batch and updates SyncRun to succeeded', async () => {
    const { result } = await t.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'run-1', shop: 'test.myshopify.com' } }],
    });
    expect(result).toBeDefined(); // Wave 0 RED: expand assertions in GREEN wave
  });
});
```

#### `app/api/shopify/sync/status/__tests__/route.test.ts` (new)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts` (full file)

**Mock + request helper pattern** (route test lines 1–41):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      decodeSessionToken: vi.fn(),
      getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
    },
  },
}));
vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: { loadSession: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { syncRun: { findFirst: vi.fn() } },
}));

import { GET } from '../route';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';
import { prisma } from '@/lib/db/client';

function makeRequest(syncRunId?: string): Request {
  const url = syncRunId
    ? `http://localhost/api/shopify/sync/status?syncRunId=${syncRunId}`
    : 'http://localhost/api/shopify/sync/status';
  return new Request(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer good' },
  });
}
```

**ReturnType<typeof vi.fn> typing pattern** (route test lines 51–52):
```typescript
(shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
  dest: 'https://example-shop.myshopify.com',
});
```

#### `app/api/shopify/webhook/__tests__/route.test.ts` (new)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts` structure + RESEARCH.md Q9 webhook mock

**Webhook-specific mock block** (RESEARCH.md Q9, lines 880–895):
```typescript
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    webhooks: {
      validate: vi.fn().mockResolvedValue({
        valid: true,
        domain: 'test.myshopify.com',
        topic: 'products/update',
        webhookId: 'wh-1',
      }),
    },
  },
}));
vi.mock('@/lib/db/client', () => ({ prisma: { webhookEvent: { create: vi.fn() } } }));
vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: { upsertProduct: vi.fn(), findByShopAndHandle: vi.fn().mockResolvedValue(null) }
}));
```

#### `app/(embedded)/__tests__/onboarding.test.tsx` extension

**Analog:** itself (current test file, lines 1–95)

**vi.useFakeTimers polling test pattern** (RESEARCH.md Q9, lines 940–947):
```typescript
it('starts polling after sync starts', async () => {
  vi.useFakeTimers();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ syncRunId: 'run-1' }),
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ state: 'running', processedCount: 10, totalCount: 100 }),
  });

  render(<OnboardingPage />);
  fireEvent.click(screen.getByTestId('start-sync'));
  await waitFor(() => expect(screen.queryByTestId('start-sync')).not.toBeInTheDocument());

  vi.advanceTimersByTime(2000);
  await waitFor(() => expect(screen.getByTestId('progress-bar')).toBeInTheDocument());
  vi.useRealTimers();
});
```

---

## Shared Patterns

### Authentication — withShopifySession
**Source:** `lib/shopify/auth.ts` lines 70–84
**Apply to:** `app/api/shopify/sync/route.ts` (rewrite), `app/api/shopify/sync/status/route.ts` (new)
```typescript
export function withShopifySession(
  handler: (ctx: { shop: string; session: Session; req: Request }) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
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

### Error Response Shape
**Source:** `lib/shopify/auth.ts` line 79; `app/api/shopify/sync/route.ts`
**Apply to:** all new/modified API routes
```typescript
return NextResponse.json({ error: '<code_string>' }, { status: NNN });
```

### Prisma Singleton Import
**Source:** `lib/db/client.ts` lines 1–16
**Apply to:** `inngest/functions/sync-products.ts`, `app/api/shopify/webhook/route.ts`, `app/api/shopify/sync/route.ts` (rewrite)
```typescript
import { prisma } from '@/lib/db/client';
```

### Test — vi.mock Before Imports
**Source:** `app/api/shopify/sync/__tests__/route.test.ts` lines 1–29; `lib/shopify/__tests__/auth.test.ts` lines 1–28
**Apply to:** all new `__tests__/route.test.ts` files
- `vi.mock(...)` blocks come BEFORE any `import` of the module under test
- `beforeEach(() => { vi.clearAllMocks(); })`
- `afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); })`
- Cast mocked functions as `ReturnType<typeof vi.fn>` for `.mockResolvedValue()` calls

### Test — shopify Global Stub (onboarding component tests)
**Source:** `app/(embedded)/__tests__/onboarding.test.tsx` lines 13–26
**Apply to:** `app/(embedded)/__tests__/onboarding.test.tsx` extended cases
```typescript
vi.stubGlobal('shopify', {
  idToken: vi.fn().mockResolvedValue('test.jwt.token'),
  toast: { show: vi.fn(), hide: vi.fn() },
});
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
```

### Repository Method Pattern — findFirst with (shop, field)
**Source:** `lib/db/repositories/ProductRepository.ts` lines 165–167
**Apply to:** new `findByShopAndHandle` method
```typescript
async findByShopAndId(shop: string, id: number): Promise<Product | null> {
  return prisma.product.findFirst({ where: { shop, id } });
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/api/inngest/route.ts` | route | framework integration | No other framework-serve route exists; use RESEARCH.md Q1 verbatim |

---

## Metadata

**Analog search scope:** `lib/`, `app/api/`, `app/(embedded)/`, `services/`, `prisma/migrations/`, `components/chat/`
**Files scanned:** 14 source files + 4 migration files
**Pattern extraction date:** 2026-05-23
