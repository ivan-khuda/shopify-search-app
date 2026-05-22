# Architecture Research

**Domain:** Two-surface Shopify embedded app + storefront drawer with AI hybrid search
**Researched:** 2026-05-22
**Confidence:** HIGH (verified against official Shopify docs, Vercel AI SDK docs, pgvector patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  SURFACE A: Embedded Admin (Shopify Admin iFrame)               │
│  app/(embedded)/           auth: session-token Bearer           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ /chat page  │  │ /onboarding  │  │ /settings (future) │     │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘     │
│         │                │                    │                  │
│         └────────────────┴────────────────────┘                 │
│                          │                                       │
│              POST /api/chat (Bearer)                            │
│              POST /api/shopify/sync (Bearer)                    │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  SURFACE B: Storefront Drawer (Theme App Extension)             │
│  ┌────────────────────────────────────────┐                     │
│  │  App Embed Block (Liquid snippet)       │                     │
│  │  ┌────────────┐   ┌───────────────┐    │                     │
│  │  │  FAB btn   │   │  Chat Drawer  │    │                     │
│  │  └─────┬──────┘   └───────┬───────┘    │                     │
│  │        │ open drawer      │            │                     │
│  └────────┴──────────────────┴────────────┘                     │
│                          │                                       │
│    POST /apps/smartdiscovery/chat  (App Proxy, HMAC signed)     │
│    GET  /apps/smartdiscovery/conversations  (App Proxy)         │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  SHARED CHAT-UI (lib/chat-ui/)                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  ChatPane  ChatMessage  ProductCard  HistoryPanel     │       │
│  │  SavedProductsPanel  PromptInput  EmptyState          │       │
│  │  (no App Bridge deps, adapter pattern for identity)  │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  API LAYER (app/api/)                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  /api/chat        │  │ /api/proxy/chat  │  │/api/shopify/  │  │
│  │  (embedded admin) │  │ (App Proxy route)│  │  sync + wh    │  │
│  └────────┬──────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                      │                    │           │
│           └──────────────────────┴────────────────────┘           │
│                                  │                                 │
│                    SearchService + ChatService                     │
│               services/search/  services/chat/                    │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│  SERVICE LAYER                   │                               │
│  ┌──────────────────┐  ┌─────────┴──────────┐  ┌─────────────┐  │
│  │ ShopifyProduct   │  │  SearchService      │  │ EmbedService│  │
│  │ Service          │  │ (hybrid pgvector +  │  │ (batched    │  │
│  │ (GraphQL fetch)  │  │  tsvector + RRF)    │  │  embed gen) │  │
│  └──────────────────┘  └────────────────────┘  └─────────────┘  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│  DATA LAYER (lib/db/)             │                               │
│  ┌──────────────────┐  ┌─────────┴──────────┐                   │
│  │  ProductRepository│  │  ConversationRepo   │                   │
│  │  EmbeddingRepo   │  │  VisitorRepo        │                   │
│  └──────────────────┘  └────────────────────┘                   │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│  PostgreSQL + pgvector            │                               │
│  Products / Variants / Embeddings │ SyncRun / Conversations      │
│  Visitors / Messages / Saved      │ ShopifySession               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Question 1: Two-Surface Route Organization

### Decision: `app/api/proxy/` route group for storefront

Use a dedicated route group `app/api/proxy/` (not `app/api/storefront/`) to make the authentication boundary instantly visible in the directory tree. Every file under `app/api/proxy/` enforces App Proxy HMAC verification; every file under `app/api/` (at root) uses session-token Bearer auth.

```
app/
├── (embedded)/                   # Shopify Admin iFrame surface
│   ├── layout.tsx                # Loads App Bridge scripts
│   ├── EmbeddedProviders.tsx
│   ├── chat/page.tsx
│   ├── onboarding/page.tsx
│   └── settings/page.tsx         # NEW: model picker
├── api/
│   ├── auth/                     # OAuth (no auth required on these)
│   │   ├── route.ts
│   │   └── callback/route.ts
│   ├── chat/route.ts             # Embedded admin chat (Bearer auth)
│   ├── shopify/
│   │   ├── sync/
│   │   │   ├── route.ts          # POST: enqueue SyncRun, return run_id
│   │   │   └── [runId]/
│   │   │       └── status/route.ts  # GET: SyncRun progress polling
│   │   └── webhook/route.ts      # HMAC-verified product webhooks
│   └── proxy/                    # App Proxy surface (HMAC per request)
│       ├── _middleware.ts        # Shared HMAC guard (see note)
│       ├── chat/route.ts         # Storefront chat stream
│       ├── conversations/route.ts
│       └── saved/route.ts
```

**Note on `proxy/_middleware.ts`**: Next.js route-level middleware files are not yet a production feature as of 2026 (only root `middleware.ts` runs). The HMAC verification guard is a shared helper function (`lib/proxy/verifyProxyRequest.ts`) called at the top of each proxy route handler. This is the correct pattern — do not rely on a co-located middleware file.

### Auth boundary separation (concrete)

**Embedded admin routes** (under `app/(embedded)/` and `app/api/` except `app/api/proxy/`):
- Auth: `Authorization: Bearer <shopify_session_token>`
- Verification: `shopifyClient.session.decodeSessionToken(token)` then load offline session from DB
- Shop extracted from: `new URL(payload.dest).hostname`

**App Proxy routes** (under `app/api/proxy/`):
- Auth: Shopify signs query params with HMAC-SHA256 using your `SHOPIFY_API_SECRET`
- Verification: `shopifyClient.utils.validateHmac(queryParams, { signator: 'appProxy' })`
- Shop extracted from: `queryParams.shop`
- Customer identity: `queryParams.logged_in_customer_id` (empty string if anonymous)
- Visitor identity: signed cookie `visitor_id` set on first request, validated server-side

### Shared proxy verification helper

```typescript
// lib/proxy/verifyProxyRequest.ts
import { shopifyClient } from '@/lib/shopify/client';

export async function verifyProxyRequest(
  searchParams: URLSearchParams
): Promise<{ shop: string; customerId: string | null } | null> {
  const params = Object.fromEntries(searchParams.entries());
  const isValid = await shopifyClient.utils.validateHmac(params, {
    signator: 'appProxy',
  });
  if (!isValid) return null;

  return {
    shop: params.shop,
    customerId: params.logged_in_customer_id || null,
  };
}
```

---

## Question 2: Shared Chat-UI Package

### Decision: `lib/chat-ui/` in-tree barrel module (not a monorepo)

A full monorepo (`packages/chat-ui/`) introduces workspace config, separate `package.json`, and transpile complexity that is not warranted when both consumers live in the same Next.js app. The existing `lib/` convention already hosts shared, framework-neutral modules.

Use `lib/chat-ui/` as an in-tree package with a clean internal barrel. Avoid a single `index.ts` that re-exports everything — export by sub-path to preserve server/client component boundaries.

```
lib/
└── chat-ui/
    ├── components/
    │   ├── ChatPane.tsx          # "use client" — orchestrates useChat hook
    │   ├── ChatMessage.tsx       # "use client"
    │   ├── ProductCard.tsx       # "use client"
    │   ├── HistoryPanel.tsx      # "use client"
    │   ├── SavedProductsPanel.tsx# "use client"
    │   └── EmptyState.tsx        # no hook deps, can be server component
    ├── hooks/
    │   └── useChatAdapter.ts     # "use client" — wraps useChat with adapter
    ├── adapters/
    │   ├── types.ts              # ChatIdentityAdapter interface
    │   ├── EmbeddedAdapter.ts    # Gets session token via window.shopify.idToken()
    │   └── StorefrontAdapter.ts  # Reads visitor_id cookie, sends to proxy endpoint
    ├── types/
    │   └── index.ts              # ChatProduct, ChatHistoryItem, etc.
    └── utils/
        └── buildSearchContext.ts # Pure fn: messages[] → context string for search
```

### App Bridge isolation via Adapter pattern

The critical separation: `ChatPane` never imports `window.shopify` or App Bridge APIs. It receives a `ChatIdentityAdapter` via React context/props.

```typescript
// lib/chat-ui/adapters/types.ts
export interface ChatIdentityAdapter {
  /** Returns Bearer token for the /api/chat endpoint */
  getAuthHeader(): Promise<Record<string, string>>;
  /** The endpoint to POST chat messages to */
  chatEndpoint: string;
  /** Identity to associate this conversation with */
  identity: { type: 'embedded'; shop: string } | { type: 'storefront'; visitorId: string; customerId?: string };
}
```

```typescript
// lib/chat-ui/adapters/EmbeddedAdapter.ts
// "use client"
export function createEmbeddedAdapter(shop: string): ChatIdentityAdapter {
  return {
    async getAuthHeader() {
      const token = await window.shopify.idToken();
      return { Authorization: `Bearer ${token}` };
    },
    chatEndpoint: '/api/chat',
    identity: { type: 'embedded', shop },
  };
}
```

```typescript
// lib/chat-ui/adapters/StorefrontAdapter.ts
// "use client"
export function createStorefrontAdapter(proxyBase: string): ChatIdentityAdapter {
  return {
    async getAuthHeader() {
      return {}; // App Proxy HMAC is added by Shopify, not the client
    },
    chatEndpoint: `${proxyBase}/chat`,
    identity: {
      type: 'storefront',
      visitorId: getOrCreateVisitorId(), // reads/writes signed cookie
    },
  };
}
```

**What to lift out of `components/chat/` into `lib/chat-ui/`:**
- `chat.tsx` → `lib/chat-ui/components/ChatPane.tsx` (remove mock product search, remove `window.shopify.idToken()` call, accept adapter prop)
- `chat-message.tsx` → `lib/chat-ui/components/ChatMessage.tsx` (no changes)
- `product-card.tsx` → `lib/chat-ui/components/ProductCard.tsx` (no changes)
- `history-panel.tsx` → `lib/chat-ui/components/HistoryPanel.tsx` (no changes)
- `saved-products-panel.tsx` → `lib/chat-ui/components/SavedProductsPanel.tsx` (no changes)
- `mock-products.ts` → DELETE (replaced by server-side search)
- `empty-state.tsx` → `lib/chat-ui/components/EmptyState.tsx`

**What stays in `components/` (surface-specific wrappers):**
- `components/chat/AdminChatPage.tsx` — thin wrapper that instantiates `EmbeddedAdapter` and passes to `ChatPane`
- Extension package: storefront drawer wraps `ChatPane` with `StorefrontAdapter`

---

## Question 3: Sync Pipeline Architecture

### Decision: DB-backed SyncRun + `next/server after()` + polling (no SSE in V1)

Vercel's `after()` from `next/server` (available since Next.js 15.1) keeps the function alive after the HTTP response is sent. This is the right fit for V1's ~5k product catalog without introducing an external queue (Inngest, BullMQ) in the first milestone.

For progress feedback, **polling beats SSE** in V1: SSE on Vercel uses one serverless function instance per connection, and the sync run doesn't exceed a few minutes. A simple polling loop at 2s intervals against a status endpoint is operationally simpler and survives cold starts.

### SyncRun model (add to `prisma/schema.prisma`)

```prisma
model SyncRun {
  id             Int        @id @default(autoincrement())
  shop           String
  state          SyncState  @default(PENDING)
  totalCount     Int?
  processedCount Int        @default(0)
  errorCount     Int        @default(0)
  errors         Json?      // Array of { productId, message }
  triggeredBy    String     @default("manual") // "manual" | "webhook"
  idempotencyKey String     @unique
  startedAt      DateTime   @default(now())
  completedAt    DateTime?

  @@index([shop, state])
  @@index([shop, startedAt])
  @@map("sync_runs")
}

enum SyncState {
  PENDING
  RUNNING
  COMPLETE
  FAILED
  PARTIAL
}
```

### Sync invocation flow

```
POST /api/shopify/sync (Bearer auth)
  1. Validate session token → extract shop
  2. Check for RUNNING SyncRun for this shop → 409 if already running
  3. INSERT SyncRun row (state=PENDING, idempotencyKey = sha256(shop + floor(Date.now()/300000)))
  4. Return { runId } immediately (200 response)
  5. after(() => runSync(runId, shop, session))
     └── runSync() runs in background after response sent:
         a. UPDATE SyncRun state=RUNNING
         b. ShopifyProductService.fetchAllProducts() with cursor pagination
         c. For each page (250 products):
            - ProductRepository.upsertBatch(products, shop)
            - UPDATE SyncRun processedCount += batch.length
         d. EmbeddingService.generateForShop(shop)  [batched, 20/call]
         e. UPDATE SyncRun state=COMPLETE / FAILED
         f. Send Resend email summary
```

**Idempotency key strategy:** `sha256(shop + 5-minute-window-bucket)`. If merchant double-clicks "Start sync", the same key prevents a duplicate run insertion (unique constraint returns conflict → return existing runId).

**Partial failure handling:** Errors from individual products are collected into `SyncRun.errors[]` (JSON array). The run completes with `state=PARTIAL` if `errorCount > 0 && processedCount > 0`. The next sync re-processes all products (upsert is idempotent via `shopifyId` unique constraint).

### Status endpoint shape

```typescript
// GET /api/shopify/sync/[runId]/status
// Response shape (MediaType: application/json)
type SyncStatusResponse = {
  runId: number;
  state: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'PARTIAL';
  processedCount: number;
  totalCount: number | null;    // null until first page fetched
  errorCount: number;
  errors: Array<{ productId: string; message: string }>;  // truncated to 20
  startedAt: string;            // ISO 8601
  completedAt: string | null;
};
```

Frontend polls at 2s intervals while `state === 'RUNNING' || state === 'PENDING'`. Stops when terminal state reached.

---

## Question 4: Embedding Pipeline

### Decision: Dedicated `services/embedding/EmbeddingService.ts`, called from sync orchestrator

Embedding generation is not a repository responsibility (repositories own DB I/O, not API calls). It is not a route handler responsibility (too slow/stateful). It belongs in the service layer, called sequentially from the sync orchestrator after the product upsert batch.

```
lib/sync/productSync.ts (orchestrator)
  └── calls ShopifyProductService.fetchAllProducts()
  └── calls ProductRepository.upsertBatch()
  └── calls EmbeddingService.generateForShop(shop)
        └── queries ProductEmbedding rows where modelVersion != CURRENT_MODEL
               or where productId has no embedding row
        └── builds text content: title + description + tags + productType + vendor
        └── calls Vercel AI Gateway embedMany() in batches of 20
        └── EmbeddingRepository.upsertBatch(embeddings)
```

### Embedding versioning strategy

Add `modelVersion` and `modelName` columns to `ProductEmbedding`. When the embedding model changes, a background migration re-embeds rows where `modelVersion != CURRENT_VERSION`. During transition, queries filter by `modelVersion = CURRENT_VERSION` to avoid mixing vector spaces.

```prisma
model ProductEmbedding {
  id           Int                    @id @default(autoincrement())
  productId    Int
  shop         String                 // multi-tenancy column
  content      String                 @db.Text
  embedding    Unsupported("vector")? // pgvector - raw SQL migration
  modelName    String                 @default("text-embedding-3-small")
  modelVersion String                 @default("v1")
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([shop, modelVersion])  // filtered queries during model transitions
  @@map("product_embeddings")
}
```

**Retry strategy:** Vercel AI Gateway calls are wrapped in a retry helper with exponential backoff (3 attempts, 1s/2s/4s delays). If all retries fail, the product ID is added to `SyncRun.errors[]` and the sync continues.

**Batching:** `embedMany()` from the Vercel AI SDK accepts an array. Call with batches of 20 content strings. At 5k products this is 250 API calls — acceptable on Vercel's AI Gateway with standard rate limits.

```typescript
// services/embedding/EmbeddingService.ts
const BATCH_SIZE = 20;
const CURRENT_MODEL_VERSION = 'v1';
const CURRENT_MODEL_NAME = 'text-embedding-3-small';

async generateForShop(shop: string): Promise<void> {
  const needsEmbedding = await prisma.product.findMany({
    where: {
      shop,
      OR: [
        { embeddings: { none: { modelVersion: CURRENT_MODEL_VERSION } } },
      ],
    },
    select: { id: true, title: true, description: true, tags: true, productType: true, vendor: true },
  });

  for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
    const batch = needsEmbedding.slice(i, i + BATCH_SIZE);
    const contents = batch.map(buildEmbeddingContent);
    const { embeddings } = await embedMany({ model: embeddingModel, values: contents });
    await embeddingRepository.upsertBatch(
      batch.map((p, idx) => ({ productId: p.id, shop, content: contents[idx], embedding: embeddings[idx], modelVersion: CURRENT_MODEL_VERSION, modelName: CURRENT_MODEL_NAME }))
    );
  }
}
```

---

## Question 5: Hybrid Search Service

### Decision: `services/search/SearchService.ts` with deterministic retrieve-then-generate

**Why deterministic, not tool-calling:** Tool calling lets the model decide when to retrieve. For a product search app, we always want retrieval before generation — the model should never answer "I don't have product data" when the DB has products. Deterministic retrieve-then-generate is simpler, predictable, and eliminates the "forgot to call the tool" failure mode.

The Vercel AI SDK RAG guide uses tool calling, but that pattern suits open-domain knowledge bases. For a closed-domain product catalog, always retrieve.

### Query path (storefront)

```
Storefront drawer
  │  POST /apps/smartdiscovery/chat (App Proxy)
  ▼
app/api/proxy/chat/route.ts
  1. verifyProxyRequest(searchParams) → { shop, customerId }
  2. Resolve visitorId from signed cookie
  3. Extract latest user message text
  ▼
SearchService.search(query, shop, { limit: 8 })
  ├── Step A (parallel):
  │   ├── vectorSearch: embed query → cosine top-20 FROM product_embeddings
  │   │   WHERE shop = $shop AND modelVersion = CURRENT
  │   └── textSearch: tsvector websearch_to_tsquery top-20
  │       FROM products WHERE shop = $shop AND status = 'ACTIVE'
  ├── Step B: RRF merge (1/(k+rank), k=60) in-process → top-8
  └── Returns: Product[]
  ▼
ConversationService.appendMessage(visitorId, userMessage)
  ▼
streamText({
  system: systemPrompt(shop) + "\n\nCatalog context:\n" + formatProducts(products),
  messages: conversationHistory,  // last N turns from DB
  model: shopSettings.activeModel,
})
  ▼
ConversationService.appendMessage(visitorId, assistantMessage, attachedProductIds)
  ▼
Return streaming response to drawer
```

### Query path (embedded admin — same service, different auth)

```
app/api/chat/route.ts
  1. Validate Bearer session token → shop
  2. SearchService.search(latestUserMessage, shop)
  3. streamText() with product context
```

### SearchService interface

```typescript
// services/search/SearchService.ts
export interface SearchResult {
  products: SearchProduct[];
  retrievalMs: number;
  sources: ('vector' | 'fulltext')[];
}

export class SearchService {
  async search(
    query: string,
    shop: string,
    options?: { limit?: number; modelVersion?: string }
  ): Promise<SearchResult>;
}
```

### Hybrid SQL pattern (raw SQL via Prisma `$queryRaw`)

```sql
-- Vector search leg
WITH vector_search AS (
  SELECT p.id, p.title, p.handle, p.description, p.price_min, p.price_max,
         ROW_NUMBER() OVER (ORDER BY pe.embedding <=> $query_vector) AS rank
  FROM product_embeddings pe
  JOIN products p ON p.id = pe.product_id
  WHERE pe.shop = $shop
    AND pe.model_version = $model_version
    AND p.status = 'ACTIVE'
  ORDER BY pe.embedding <=> $query_vector
  LIMIT 20
),
-- Full-text search leg
text_search AS (
  SELECT p.id, p.title, p.handle, p.description, p.price_min, p.price_max,
         ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')), websearch_to_tsquery('english', $query)) DESC) AS rank
  FROM products p
  WHERE p.shop = $shop
    AND p.status = 'ACTIVE'
    AND to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')) @@ websearch_to_tsquery('english', $query)
  LIMIT 20
),
-- RRF merge
rrf AS (
  SELECT
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.title, t.title) AS title,
    COALESCE(v.handle, t.handle) AS handle,
    COALESCE(v.description, t.description) AS description,
    COALESCE(v.price_min, t.price_min) AS price_min,
    COALESCE(v.price_max, t.price_max) AS price_max,
    COALESCE(1.0 / (60 + v.rank), 0) + COALESCE(1.0 / (60 + t.rank), 0) AS rrf_score
  FROM vector_search v
  FULL OUTER JOIN text_search t ON v.id = t.id
)
SELECT * FROM rrf ORDER BY rrf_score DESC LIMIT $limit;
```

**Why RRF over score normalization:** Cosine similarity and `ts_rank` are on different scales. RRF rank fusion avoids normalization math and consistently outperforms simple score averaging (84% vs 62% retrieval precision per research).

---

## Question 6: Multi-Tenancy

### Decision: Explicit `shop` String column + middleware extraction + Prisma extension guard

**Do not use PostgreSQL RLS for V1.** RLS with Prisma requires either a connection-per-tenant (not compatible with Prisma Accelerate's pooling) or `SET LOCAL app.current_shop` in every transaction (complex, error-prone). For V1 with Prisma Accelerate, the correct pattern is application-layer enforcement.

### Three-layer defense

**Layer 1: Middleware extracts shop from auth token** (request boundary)

```typescript
// middleware.ts — enable matcher to cover embedded routes
export const config = {
  matcher: ['/chat/:path*', '/onboarding/:path*', '/settings/:path*'],
};
```

**Layer 2: Every route handler calls `getShopFromRequest()`** (route boundary)

```typescript
// lib/auth/getShopFromRequest.ts
export async function getShopFromRequest(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new AuthError('missing_token');
  const payload = await shopifyClient.session.decodeSessionToken(token);
  const shop = new URL(payload.dest as string).hostname;
  if (!shop.endsWith('.myshopify.com')) throw new AuthError('invalid_shop');
  return shop;
}

// For proxy routes:
export async function getShopFromProxyRequest(
  searchParams: URLSearchParams
): Promise<string> {
  const result = await verifyProxyRequest(searchParams);
  if (!result) throw new AuthError('invalid_hmac');
  return result.shop;
}
```

**Layer 3: Every Prisma query includes `where: { shop }` explicitly** (data boundary)

This is the most critical layer. Do not rely on the caller to remember scoping. Use a thin repository base that requires `shop` in every query signature:

```typescript
// lib/db/repositories/BaseRepository.ts
export abstract class ShopScopedRepository {
  protected async findMany<T>(
    model: string,
    shop: string,
    where: object,
    ...
  ): Promise<T[]> {
    // All queries pass through here — shop is structurally required
  }
}
```

### Schema additions needed

Every model that holds merchant data must carry a `shop` column:

| Model | Shop Column | Notes |
|-------|-------------|-------|
| `Product` | `shop String` | Add index `@@index([shop])` |
| `ProductVariant` | inherits via Product FK | No direct shop column needed |
| `ProductImage` | inherits via Product FK | No direct shop column needed |
| `ProductEmbedding` | `shop String` | Needed for direct queries that skip the JOIN |
| `SyncRun` | `shop String` | Already in proposed schema above |
| `Conversation` | `shop String` | New model |
| `Message` | inherits via Conversation FK | |
| `Visitor` | `shop String` | New model |
| `SavedProduct` | `shop String` | New model |
| `ShopSettings` | `shop String @unique` | New model for model picker |

**One critical rule:** Queries on `ProductEmbedding` and `Conversation` must filter by `shop` first (index-supported) before applying any secondary filter. The `shop` index should always be the leading index.

---

## Question 7: Build Order / Phase Dependencies

### Dependency graph

```
Phase 1: Foundation (must complete first — everything else blocks on this)
  ├── Add shop column to Product + related models (migration)
  ├── Re-enable middleware auth (security baseline)
  ├── Strip console.log of tokens (security baseline)
  ├── Implement ProductRepository.upsertBatch()
  └── Implement ShopifyProductService.fetchAllProducts() (real GraphQL)

Phase 2: Sync Pipeline (blocks embedding + search)
  ├── SyncRun model + migration
  ├── Sync route: create SyncRun + after() background job
  ├── Status polling endpoint
  ├── Onboarding UI: real progress bar
  └── Webhook handler with HMAC (incremental upsert)
      └── BLOCKS: real-time catalog freshness

Phase 3: Embedding Pipeline (blocks search)
  ├── EmbeddingService with batch embed + versioning columns
  ├── EmbeddingRepository.upsertBatch() with raw SQL
  ├── Cosine index migration (raw SQL for pgvector HNSW)
  └── tsvector index + GIN migration on products.title+description
      └── BLOCKS: SearchService

Phase 4: Search Service (blocks both surfaces returning real results)
  ├── SearchService.search() with hybrid SQL (pgvector + tsvector + RRF)
  ├── Wire /api/chat to use SearchService (replace MOCK_PRODUCTS)
  └── Wire /api/proxy/chat to use SearchService
      └── BLOCKS: storefront drawer returning real products

Phase 5: Shared Chat-UI extraction (blocks storefront surface)
  ├── Extract components/chat/ → lib/chat-ui/
  ├── EmbeddedAdapter + StorefrontAdapter
  ├── Conversation + Visitor persistence models
  └── Connect history/saved to DB
      └── BLOCKS: storefront drawer UI

Phase 6: Storefront Surface (requires Phase 4 + Phase 5)
  ├── App Proxy routes (app/api/proxy/)
  ├── Visitor identity (signed cookie + customer_id linking)
  ├── Theme App Extension package (App Embed block + FAB + drawer)
  └── Connect drawer to /proxy/chat endpoint

Phase 7: Admin Settings (can overlap with Phase 6)
  ├── ShopSettings model (active model per shop)
  ├── Settings page with Vercel AI Gateway model catalog
  └── Chat endpoints use shopSettings.activeModel

Phase 8: Hard cap + email
  ├── Per-shop request counter (ChatRequest model or Redis counter)
  ├── Hard monthly cap check in chat route handlers
  └── Resend email on sync completion
```

### Critical blocking dependency

**Phase 3 (Embeddings) must complete before Phase 4 (Search).** The search service has no fallback until embeddings exist for shop products. Do not build the storefront surface until at least one shop's products are embedded and returning real search results in the admin playground.

**Phase 5 (Shared Chat-UI) must start before Phase 6 (Storefront).** If the storefront UI is built directly against `components/chat/`, both surfaces will diverge. Extract first, then build the storefront wrapper.

---

## Recommended Project Structure (target state)

```
shopify-search-app/
├── app/
│   ├── (embedded)/
│   │   ├── chat/page.tsx           # Uses AdminChatPage wrapper
│   │   ├── onboarding/page.tsx
│   │   └── settings/page.tsx       # NEW
│   └── api/
│       ├── auth/
│       ├── chat/route.ts           # Bearer auth, calls SearchService
│       ├── proxy/                  # App Proxy surface (HMAC)
│       │   ├── chat/route.ts
│       │   ├── conversations/route.ts
│       │   └── saved/route.ts
│       └── shopify/
│           ├── sync/
│           │   ├── route.ts
│           │   └── [runId]/status/route.ts
│           └── webhook/route.ts
├── components/
│   ├── chat/                       # Surface-specific wrappers only
│   │   └── AdminChatPage.tsx
│   └── ui/                         # shadcn primitives (unchanged)
├── lib/
│   ├── auth/
│   │   ├── getShopFromRequest.ts   # Bearer token → shop
│   │   └── getShopFromProxyRequest.ts
│   ├── chat-ui/                    # Shared UI (extracted from components/chat/)
│   │   ├── components/
│   │   ├── adapters/
│   │   ├── hooks/
│   │   └── types/
│   ├── db/
│   │   ├── client.ts
│   │   └── repositories/
│   │       ├── ProductRepository.ts
│   │       ├── EmbeddingRepository.ts
│   │       ├── ConversationRepository.ts
│   │       ├── VisitorRepository.ts
│   │       └── SavedProductRepository.ts
│   ├── proxy/
│   │   └── verifyProxyRequest.ts
│   ├── shopify/
│   │   ├── client.ts
│   │   └── session-storage.ts
│   └── sync/
│       └── productSync.ts          # Orchestrator (calls services)
├── services/
│   ├── chat/
│   │   └── ConversationService.ts  # Persist turns, load history
│   ├── embedding/
│   │   └── EmbeddingService.ts     # Batched embed generation
│   ├── search/
│   │   └── SearchService.ts        # Hybrid pgvector + tsvector + RRF
│   ├── settings/
│   │   └── ShopSettingsService.ts  # Active model per shop
│   └── shopify/
│       └── ShopifyProductService.ts
├── extensions/
│   └── storefront-drawer/          # Theme App Extension package
│       ├── assets/
│       │   ├── drawer.js           # Bundle: React + lib/chat-ui
│       │   └── drawer.css
│       └── blocks/
│           └── app-embed.liquid
├── prisma/
│   └── schema.prisma               # Add: SyncRun, Conversation, Message,
│                                   #      Visitor, SavedProduct, ShopSettings
│                                   #      shop columns on Product, ProductEmbedding
└── types/
    ├── product.ts
    └── shopify.ts
```

---

## Architectural Patterns

### Pattern 1: Thin Route Handlers

Route handlers are not service code. Their only responsibilities are: (a) authenticate/verify, (b) deserialize input, (c) call one service method, (d) serialize response.

```typescript
// app/api/proxy/chat/route.ts — ~20 lines of glue
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const shopCtx = await getShopFromProxyRequest(searchParams);
  if (!shopCtx) return NextResponse.json({ error: 'invalid_hmac' }, { status: 401 });

  const { messages } = await req.json();
  const query = messages.at(-1)?.content ?? '';

  const products = await searchService.search(query, shopCtx.shop);
  const history = await conversationService.getHistory(visitorId, shopCtx.shop);

  return streamText({ ... }).toUIMessageStreamResponse();
}
```

### Pattern 2: Repository as DB Boundary

Services call repositories. Route handlers do not call `prisma` directly. Every repository method requires `shop` as a parameter (structural enforcement of multi-tenancy).

### Pattern 3: Adapter-Injected ChatPane

The `ChatPane` component from `lib/chat-ui/` is surface-agnostic. Surface-specific code lives exclusively in adapters. This means the storefront drawer can reuse 100% of the chat component tree.

### Pattern 4: Deterministic RAG (always retrieve)

Never let the model decide whether to search. Always run `SearchService.search()` before `streamText()`. Pass results as context in the system prompt. This is simpler, faster, and eliminates the "model didn't think to search" failure mode.

---

## Anti-Patterns

### Anti-Pattern 1: Embedding product search in `components/chat/`

**What happens:** `buildMockResults()` is client-side keyword search in `chat.tsx`. When extended, it would mean shipping the entire product catalog to the browser.
**Why it's wrong:** Does not scale, breaks multi-tenancy, exposes catalog data to browser.
**Do this instead:** `SearchService.search()` on the server, results returned as context to `streamText()`.

### Anti-Pattern 2: Single middleware.ts as the only auth guard

**What happens:** If middleware is bypassed (wrong matcher, cold start edge case), route handlers have no defense.
**Why it's wrong:** Defense in depth requires per-route validation.
**Do this instead:** `getShopFromRequest()` at the top of every protected route handler in addition to middleware.

### Anti-Pattern 3: Storing session tokens in logs

**What happens:** `console.log('token', token)` in middleware.ts and onboarding.
**Why it's wrong:** Tokens are valid JWTs that can be replayed until expiry; centralised logs (DataDog, Sentry) become a credential store.
**Do this instead:** Remove all console.log of auth headers/tokens before any public launch. Use a structured logger with redaction if debugging is needed.

### Anti-Pattern 4: Building storefront surface before embeddings exist

**What happens:** Storefront drawer ships but returns 0 products (no embeddings in DB yet).
**Why it's wrong:** First impression is broken; hard to validate the core value proposition.
**Do this instead:** Complete Phases 1-4 (sync + embed + search working in admin playground) before building the storefront surface.

### Anti-Pattern 5: Monorepo for shared chat-UI in V1

**What happens:** `packages/chat-ui/` with separate `package.json`, Turborepo config, transpile setup.
**Why it's wrong:** Adds 2-3 days of infrastructure work for a package consumed by exactly one Next.js app. The `next.config.ts` `transpilePackages` + workspace symlinks create subtle build errors.
**Do this instead:** `lib/chat-ui/` in-tree. If a second app genuinely needs the package, extract to monorepo then.

---

## Integration Points

### External Services

| Service | Integration Point | Auth Pattern | Notes |
|---------|------------------|--------------|-------|
| Shopify Admin GraphQL | `services/shopify/ShopifyProductService.ts` | Offline session access token | Cursor-paginated, 250 products/page, respect 1000ms leaky-bucket |
| Shopify App Bridge | `lib/chat-ui/adapters/EmbeddedAdapter.ts` | `window.shopify.idToken()` | Only in embedded adapter, never in shared components |
| Shopify App Proxy | `app/api/proxy/` routes | HMAC query param verification | `shopifyClient.utils.validateHmac(..., { signator: 'appProxy' })` |
| Vercel AI Gateway | `app/api/chat/route.ts`, `services/embedding/EmbeddingService.ts` | `VERCEL_AI_GATEWAY_API_KEY` env var | Single provider for chat + embeddings |
| Resend | `services/email/SyncEmailService.ts` | `RESEND_API_KEY` env var | Called from sync orchestrator on completion |
| pgvector | `services/search/SearchService.ts` via `prisma.$queryRaw` | DB connection | Raw SQL required; Prisma cannot generate vector queries |

### Internal Boundaries

| Boundary | Communication | Rule |
|----------|---------------|------|
| Route handler → Service | Direct TypeScript call | Handler owns auth; service owns business logic |
| Service → Repository | Direct TypeScript call | Service owns orchestration; repository owns SQL |
| ChatPane → Auth | `ChatIdentityAdapter` interface | ChatPane never imports surface-specific modules |
| Sync orchestrator → Embedding service | Sequential call after upsert | Embedding runs after all products saved; never interleaved |
| Webhook handler → Sync | Single-product upsert (not full sync) | Webhooks trigger incremental upsert, not a new SyncRun |

---

## Scaling Considerations

| Scale | Approach |
|-------|---------|
| 0-50 shops, up to 5k products each | Single Vercel deployment, Prisma Accelerate, `after()` for sync — no queue needed |
| 50-500 shops | Monitor Vercel function concurrency; consider Inngest for sync to avoid cold-start queuing |
| 500+ shops | Extract embedding pipeline to a dedicated worker; add Redis for real-time sync status (replace polling with pub/sub) |

**First bottleneck for V1:** Vercel function concurrency during simultaneous syncs by multiple shops. If two shops sync at the same time, each uses one function invocation for the `after()` worker. At 5k products × 10 pages × API latency, each sync runs ~2-4 minutes. Vercel's concurrency limit (default 1000) makes this non-issue until hundreds of shops sync simultaneously.

---

## Sources

- [Shopify App Proxy authentication — shopify.dev](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies)
- [shopify-api-js `validateHmac` for App Proxy — GitHub](https://github.com/shopify/shopify-api-js/blob/main/packages/shopify-api/docs/reference/utils/validateHmac.md)
- [shopify-api-js `decodeSessionToken` — GitHub](https://github.com/shopify/shopify-api-js/blob/main/packages/shopify-api/docs/reference/session/decodeSessionToken.md)
- [Vercel AI SDK RAG chatbot guide — ai-sdk.dev](https://ai-sdk.dev/docs/guides/rag-chatbot)
- [Hybrid search with RRF: pgvector + tsvector — dev.to](https://dev.to/lpossamai/building-hybrid-search-for-rag-combining-pgvector-and-full-text-search-with-reciprocal-rank-fusion-6nk)
- [Hybrid search missing manual — paradedb.com](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
- [Next.js background jobs with after() — Inngest blog](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts)
- [Background jobs Next.js + PostgreSQL production — render.com](https://render.com/articles/nextjs-background-jobs-postgresql-production)
- [Embedding versioning with pgvector — dbi-services.com](https://www.dbi-services.com/blog/rag-series-embedding-versioning-with-pgvector-why-event-driven-architecture-is-a-precondition-to-ai-data-workflows/)
- [Multi-tenant row-level scoping with Prisma — dev.to](https://dev.to/whoffagents/multi-tenant-saas-data-isolation-row-level-security-tenant-scoping-and-plan-enforcement-with-1gd4)
- [Shopify Theme App Extensions overview — shopify.dev](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)

---

*Architecture research for: SmartDiscovery AI — two-surface Shopify embedded app*
*Researched: 2026-05-22*
