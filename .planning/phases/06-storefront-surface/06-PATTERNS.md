# Phase 6: Storefront Surface — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 22 new/modified
**Analogs found:** 18 / 22 (4 net-new with no local analog — Theme App Extension surface, esbuild prebuild)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/proxy/chat/route.ts` (REPLACE 501 stub) | route handler | streaming response | `app/api/chat/route.ts` | exact (admin chat) |
| `app/api/proxy/conversations/route.ts` | route handler | CRUD (list/create/bulk-delete) | `app/api/shopify/sync/status/route.ts` + `app/api/shopify/sync/route.ts` | role-match |
| `app/api/proxy/conversations/[id]/route.ts` | route handler | CRUD (read/append) | `app/api/shopify/sync/status/route.ts` | role-match |
| `app/api/proxy/saved-products/route.ts` | route handler | CRUD (list/toggle) | `app/api/shopify/sync/status/route.ts` | role-match |
| `app/api/proxy/saved-products/[productId]/route.ts` | route handler | CRUD (delete) | `app/api/shopify/sync/status/route.ts` | role-match |
| `lib/shopify/app-proxy-auth.ts` | auth middleware wrapper | request-response | `lib/shopify/auth.ts` | exact (parallel pattern) |
| `lib/rate-limit/memory.ts` | utility (limiter) | request-response | (none local — net-new utility) | no analog |
| `lib/chat-ui/stores/db-backed.ts` | store class | CRUD over fetch | `lib/chat-ui/stores/local-storage.ts` | exact (same interface) |
| `lib/chat-ui/stores/hooks.ts` (EDIT) | React hook | useSyncExternalStore | `lib/chat-ui/stores/hooks.ts` (existing) | self-extend |
| `lib/chat-ui/adapters/storefront.ts` (EDIT) | adapter class | request-body composer | `lib/chat-ui/adapters/storefront.ts` (existing) | self-extend |
| `lib/identity/merge.ts` | utility (DB tx) | transactional CRUD | `inngest/functions/sync-products.ts` (prisma `$executeRaw` upsert pattern) | role-match |
| `inngest/functions/retention-sweep.ts` | inngest function | scheduled batch deletes | `inngest/functions/sync-products.ts` | exact (Inngest pattern) |
| `prisma/schema.prisma` (EDIT) | schema model | DDL | `prisma/schema.prisma` (existing `Product`, `ShopifySession`) | self-extend |
| `db/manual-indexes.sql` (EDIT) | raw SQL migration | DDL | `db/manual-indexes.sql` (existing pgvector/GIN partial) | self-extend |
| `extensions/chat-drawer/blocks/chat-drawer.liquid` | Theme Extension block | static asset | (none local — Theme App Extension is net-new) | no analog |
| `extensions/chat-drawer/assets/loader.js` | extension loader script | static asset, lazy import | (none local) | no analog |
| `extensions/chat-drawer/assets/loader.css` | extension CSS | static asset | (none local) | no analog |
| `extensions/chat-drawer/src/StorefrontDrawer.tsx` | React component | UI rendering | `lib/chat-ui/components/chat-pane.tsx` (assumed structurally) | role-match |
| `extensions/chat-drawer/src/PromptChips.tsx` | React component | UI rendering | `lib/chat-ui/components/empty-state.tsx` (assumed) | role-match |
| `extensions/chat-drawer/src/entry.tsx` | entry mount | DOM mount | (none local) | no analog |
| `scripts/build-storefront-bundle.ts` | build script | file I/O | `scripts/apply-manual-indexes.ts` | role-match (script shape only) |
| `shopify.app.toml` (EDIT) | config | TOML | `shopify.app.toml` (existing) | self-extend |
| `package.json` (EDIT) | config | JSON | `package.json` (existing scripts block) | self-extend |

---

## Pattern Assignments

### `app/api/proxy/chat/route.ts` (route handler, streaming response — REPLACE 501 stub)

**Analog:** `app/api/chat/route.ts` (admin chat — exact reference for streamText shape)

**Imports pattern** (lines 48-59 of analog):
```typescript
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import dedent from 'dedent';
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { hybridSearch } from '@/services/search/SearchService';
```

**For Phase 6 storefront:** swap `withShopifySession` → `withAppProxyHmac` (Bearer → HMAC). Keep `streamText` + `searchCatalog` tool + `getActiveChatModel(shop)` calls byte-identical.

**Auth wrapper invocation pattern** (line 61):
```typescript
export const POST = withShopifySession(async ({ shop, req }) => {
```

**Mirror as:**
```typescript
export const POST = withAppProxyHmac(async ({ shop, req }) => {
```

**Core streaming + tool pattern** (lines 76-100):
```typescript
const result = streamText({
  model: model.id,
  system,
  messages: await convertToModelMessages(messages),
  tools: {
    searchCatalog: tool({
      description: dedent`...`,
      inputSchema: z.object({
        query: z.string().min(1).max(500).describe('Natural-language search query'),
        priceMin: z.number().optional().describe('Minimum price filter (USD)'),
        priceMax: z.number().optional().describe('Maximum price filter (USD)'),
      }),
      execute: async ({ query, priceMin, priceMax }) => {
        return hybridSearch(shop, query, { priceMin, priceMax });
      },
    }),
  },
  stopWhen: stepCountIs(3),
});

return result.toUIMessageStreamResponse();
```

**Multi-tenancy lock pattern (T-04-07 / -09 / -13):** `shop` from wrapper closure shadows any tool-arg hallucination — copy verbatim.

**D-19 onFinish write seam (NEW — does not exist in admin analog):**
Append to the `streamText({ ... })` config in this order:
```typescript
onFinish: async ({ response }) => {
  // Atomic single-row UPDATE: messages = messages || $newJson, lastMessageAt = NOW()
  await prisma.conversation.update({
    where: { id: conversationId, shop },
    data: { messages: { /* append assistant turn */ }, lastMessageAt: new Date() },
  });
},
```

---

### `lib/shopify/app-proxy-auth.ts` (auth middleware wrapper, request-response)

**Analog:** `lib/shopify/auth.ts` (parallel `withShopifySession` pattern)

**Imports + error class pattern** (lines 1-20):
```typescript
import type { Session } from '@shopify/shopify-api';
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export type ShopifyAuthErrorCode =
  | 'missing_token'
  | 'invalid_token'
  | 'invalid_dest'
  | 'invalid_shop_domain'
  | 'no_offline_session';

export class ShopifyAuthError extends Error {
  public readonly status: 401 = 401;

  constructor(public readonly code: ShopifyAuthErrorCode) {
    super(`Shopify auth error: ${code}`);
    this.name = 'ShopifyAuthError';
  }
}
```

**For Phase 6:** copy class structure verbatim; replace `ShopifyAuthErrorCode` union with `AppProxyAuthErrorCode = 'missing_signature' | 'invalid_signature' | 'missing_shop' | 'invalid_shop_domain'`.

**Verify function pattern** (lines 22-68):
```typescript
export async function verifyShopSessionToken(
  req: Request
): Promise<{ shop: string; session: Session }> {
  // Step 1: Check Authorization header
  // Step 2: Decode the session token
  // Step 3: Validate dest is present
  // Step 4: Parse dest as URL
  // Step 5: Validate shop domain
  // Step 6: Load offline session
  // Step 7: Return verified context
}
```

**For Phase 6 `verifyAppProxyHmac(req)`:**
- Step 1: Extract `query` params from `new URL(req.url).searchParams`
- Step 2: Reject if `signature` missing → `missing_signature`
- Step 3: `await shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` → false → `invalid_signature`
- Step 4: Read `query.shop`; missing → `missing_shop`
- Step 5: Reject if not `.endsWith('.myshopify.com')` → `invalid_shop_domain`
- Return `{ shop, query }`.

**Higher-order wrapper pattern** (lines 70-84) — copy verbatim, only change the inner verify call:
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

---

### `lib/chat-ui/stores/db-backed.ts` (store class, CRUD over fetch)

**Analog:** `lib/chat-ui/stores/local-storage.ts` (must implement same `HistoryStore` / `SavedProductsStore` interface from `types.ts`)

**Class skeleton pattern** (lines 6-71 of analog — `LocalStorageHistoryStore`):
```typescript
export class LocalStorageHistoryStore implements HistoryStore {
  private readonly scope: string;
  private readonly listeners = new Set<() => void>();
  private cache: ChatHistoryItem[] | null = null;

  constructor(scope: string) {
    if (!scope) {
      throw new Error('LocalStorageHistoryStore requires a non-empty scope');
    }
    this.scope = scope;
  }

  // list() — returns cache or hydrates from source
  // add(entry) — mutates cache, persists, notifies
  // clear() — resets cache, persists, notifies
  // subscribe(listener) — Set-based pub/sub for useSyncExternalStore
  // private notify() — iterate listeners
}
```

**For `DbBackedHistoryStore`:**
- Constructor takes `{ shop, visitorId, customerId? }` instead of `scope` string (DB-backed stores are visitor/customer scoped, not arbitrary scope)
- `list()` returns `cache` synchronously (required by `useSyncExternalStore`) — separate async `refresh()` method calls `GET /apps/smartdiscovery/conversations?visitor_id=...` (App Proxy path), updates cache, calls `notify()`
- `add(entry)` POSTs to `/apps/smartdiscovery/conversations` then optimistically updates cache and calls `notify()`
- `clear()` issues `DELETE /apps/smartdiscovery/conversations?visitor_id=...` (D-06 bulk delete), resets cache, notifies
- `subscribe()` / `notify()` patterns: **copy verbatim from lines 59-70 of analog**

**Saved products pattern** (lines 73-145 of analog — `LocalStorageSavedProductsStore`): mirror for `DbBackedSavedProductsStore`. `toggle()` posts to `POST /apps/smartdiscovery/saved-products` (uses `INSERT … ON CONFLICT DO NOTHING` server-side per D-20).

**Critical:** `list()` must remain synchronous to satisfy `useSyncExternalStore` snapshot contract (line 22-40 of analog shows the cache-first pattern).

---

### `lib/chat-ui/stores/hooks.ts` (EDIT — React hook extension)

**Analog:** `lib/chat-ui/stores/hooks.ts` (existing file)

**Existing hook pattern** (lines 9-24):
```typescript
export function useHistoryStore(scope: string) {
  const store: HistoryStore = useMemo(
    () => new LocalStorageHistoryStore(scope),
    [scope],
  );
  const items = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.list(),
    () => [],
  );
  return {
    items,
    add: (entry: ChatHistoryItem) => store.add(entry),
    clear: () => store.clear(),
  };
}
```

**For Phase 6 — add parallel hooks (CONTEXT D-02 allows parallel variants):**
```typescript
export function useDbBackedHistoryStore({ shop, visitorId, customerId }: {...}) {
  const store = useMemo(
    () => new DbBackedHistoryStore({ shop, visitorId, customerId }),
    [shop, visitorId, customerId],
  );
  // useEffect: store.refresh() on mount
  // remaining shape identical to useHistoryStore
}
```

Mirror for `useDbBackedSavedProductsStore`.

---

### `lib/chat-ui/adapters/storefront.ts` (EDIT — adapter class, additive)

**Analog:** `lib/chat-ui/adapters/storefront.ts` (the file itself, current state)

**Current pattern** (lines 5-21):
```typescript
export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/proxy/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};
    let visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
    return { visitor_id: visitorId };
  }
}
```

**Single edit (CONTEXT D-09, IDN-02):** extend `getRequestBody()` to also read `window.Shopify?.customer?.id`:
```typescript
const customerId = (window as unknown as { Shopify?: { customer?: { id?: string | number } } })
  .Shopify?.customer?.id;
const body: Record<string, unknown> = { visitor_id: visitorId };
if (customerId != null) body.customer_id = String(customerId);
return body;
```

**Do NOT change:** endpoint, getAuthHeaders, STORAGE_KEY constant. The localStorage key `'smartdiscovery.visitor_id'` is referenced in UI-SPEC §5 risks list as canonical — do not introduce a second key.

---

### `app/api/proxy/conversations/route.ts` (route handler, CRUD)

**Analog:** `app/api/shopify/sync/status/route.ts` (GET + 400/404/403 shape) + `app/api/shopify/sync/route.ts` (POST with Prisma create)

**GET pattern** (sync/status/route.ts lines 5-28):
```typescript
export const GET = withShopifySession(async ({ shop, session, req }) => {
  void session;

  const syncRunId = new URL(req.url).searchParams.get('syncRunId');
  if (!syncRunId) {
    return NextResponse.json({ error: 'missing_sync_run_id' }, { status: 400 });
  }

  const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
  if (!run) {
    return NextResponse.json({ error: 'sync_run_not_found' }, { status: 404 });
  }
  if (run.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }

  return NextResponse.json({ /* fields */ });
});
```

**For Phase 6 GET (list with cursor pagination per D-05):**
- Replace `withShopifySession` with `withAppProxyHmac`
- Extract `visitor_id`, `cursor` from searchParams; both required → 400 if missing
- Apply rate limit (60/min reads — see `lib/rate-limit/memory.ts` pattern below)
- `prisma.conversation.findMany({ where: { shop, OR: [{ visitorId }, { customerId: linkedCustomerId }] }, orderBy: { lastMessageAt: 'desc' }, take: 20, cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0 })`
- Return `{ items, nextCursor }`

**POST pattern** (sync/route.ts lines 7-34):
```typescript
export const POST = withShopifySession(async ({ shop, session }) => {
  void session;
  // build idempotency key
  // findFirst — return existing if present
  const run = await prisma.syncRun.create({
    data: { shop, idempotencyKey, state: 'queued', processedCount: 0 },
  });
  return NextResponse.json({ syncRunId: run.id });
});
```

**For Phase 6 POST (D-04 — create Conversation on first message; D-18 title = first 60 chars):**
- Read body `{ visitor_id, customer_id?, firstMessage }` from JSON
- Rate-limit 60/min
- Title = `firstMessage.text?.trim().slice(0, 60) || '(no title)'`
- `prisma.conversation.create({ data: { shop, visitorId, customerId, title, messages: [], lastMessageAt: new Date() } })`
- Return `{ conversation_id: row.id }`

**DELETE bulk (D-06):**
- Extract `visitor_id` from searchParams
- `prisma.conversation.deleteMany({ where: { shop, OR: [{ visitorId }, { customerId: linkedCustomerId }] } })`
- Return `{ deleted: count }`

**Shop-scoping enforcement** (sync/status/route.ts line 17-19): every row check compares `row.shop !== shop` → 403. Copy this defensive check verbatim for every individual-row lookup in Phase 6.

---

### `app/api/proxy/conversations/[id]/route.ts` (route handler, CRUD per-row)

**Analog:** `app/api/shopify/sync/status/route.ts` (single-row lookup + shop ownership check)

**Pattern (sync/status/route.ts lines 13-22):**
```typescript
const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
if (!run) {
  return NextResponse.json({ error: 'sync_run_not_found' }, { status: 404 });
}
if (run.shop !== shop) {
  return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
}
```

**For Phase 6:** Next.js 16 App Router dynamic param signature:
```typescript
export const GET = withAppProxyHmac(async ({ shop, req }) => {
  // Phase 6: extract id from URL pathname, not from params, since withAppProxyHmac signature only passes req
  // Alternative: change wrapper signature to accept ({ params }) too — planner decides
});
```

**PATCH (append turn per D-15 client-side fallback if onFinish race):** atomic raw update:
```typescript
await prisma.$executeRaw`UPDATE "Conversation" SET messages = messages || ${json}::jsonb, "lastMessageAt" = NOW() WHERE id = ${id} AND shop = ${shop}`;
```

Same shop guard 404/403 pattern.

---

### `app/api/proxy/saved-products/route.ts` (route handler, CRUD)

**Analog:** Same as conversations route. GET = filter by visitor + linked customer; POST = `INSERT ... ON CONFLICT DO NOTHING` (D-20 partial unique indexes back this).

**Raw SQL upsert pattern reference** — `inngest/functions/sync-products.ts:135` shows the project's `$executeRaw` ON CONFLICT idiom:
```typescript
await prisma.$executeRaw`INSERT INTO product_embeddings (...) VALUES (...) ON CONFLICT (shop, "productShop", "productId") DO UPDATE SET ...`;
```

**For Phase 6 SavedProduct POST:**
```typescript
await prisma.$executeRaw`
  INSERT INTO "SavedProduct" (shop, "visitorId", "customerId", "productId", "savedAt")
  VALUES (${shop}, ${visitorId}, ${customerId}, ${productId}, NOW())
  ON CONFLICT DO NOTHING
`;
```

The partial unique indexes from `db/manual-indexes.sql` (D-20) drive ON CONFLICT routing.

---

### `lib/rate-limit/memory.ts` (utility — no local analog)

**No analog found.** Use RESEARCH.md sliding-window guidance verbatim.

**Reference pattern for module shape:**
- Export `const RATE_LIMITS = { chat: { window: 5*60*1000, max: 30 }, read: { window: 60*1000, max: 60 } }`
- Export `rateLimit(visitorId: string, bucket: 'chat' | 'read'): { ok: boolean; retryAfterSec?: number }`
- Internal `Map<string, number[]>` keyed by `${bucket}:${visitorId}`, holds timestamps; on each call: filter timestamps within window, reject if over max, otherwise push current ts. Periodic eviction inline (filter on each call is sufficient at this scale).
- **Vercel cold-start caveat:** document inline that in-memory is per-instance (Phase 8 RequestCounter supersedes — see CONTEXT D-08).

---

### `lib/identity/merge.ts` (utility — DB transaction helper)

**Analog:** `inngest/functions/sync-products.ts:135` `prisma.$executeRaw` pattern (raw SQL within Prisma).

**For Phase 6 merge (D-11 exact SQL):**
```typescript
import { prisma } from '@/lib/db/client';

export async function mergeVisitorIntoCustomer(
  shop: string,
  visitorId: string,
  customerId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Idempotency check
    const existing = await tx.visitorCustomerLink.findUnique({
      where: { shop_visitorId_customerId: { shop, visitorId, customerId } },
    });
    if (existing) return;

    // D-11 SQL (verbatim from CONTEXT):
    await tx.$executeRaw`UPDATE "Conversation" SET "customerId" = ${customerId} WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL`;
    await tx.$executeRaw`INSERT INTO "SavedProduct" (shop, "visitorId", "customerId", "productId", "savedAt") SELECT shop, "visitorId", ${customerId}, "productId", "savedAt" FROM "SavedProduct" WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL ON CONFLICT (shop, "customerId", "productId") WHERE "customerId" IS NOT NULL DO NOTHING`;
    await tx.$executeRaw`DELETE FROM "SavedProduct" WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL`;
    await tx.visitorCustomerLink.create({
      data: { shop, visitorId, customerId, mergedAt: new Date() },
    });
  });
}
```

Call inside `/api/proxy/chat` D-21 step 7 (before streamText) — runs in the same logical session as the new Conversation create.

---

### `inngest/functions/retention-sweep.ts` (inngest function, scheduled batch)

**Analog:** `inngest/functions/sync-products.ts` (exact — same Inngest function shape, same `step.run` pagination idiom)

**Function declaration pattern** (lines 25-42 of analog):
```typescript
export const syncProductsFunction = inngest.createFunction(
  {
    id: 'sync-products',
    triggers: [{ event: 'shopify/product.sync' }],
    retries: 3,
    onFailure: async ({ event, error }) => { ... },
  },
  async ({ event, step }) => { ... },
);
```

**For Phase 6 retention sweep:** swap event trigger for cron trigger (RESEARCH §5):
```typescript
export const retentionSweepFunction = inngest.createFunction(
  {
    id: 'retention-sweep',
    triggers: [{ cron: '0 3 * * 0' }], // Weekly Sunday 03:00 UTC
    retries: 3,
  },
  async ({ step }) => {
    // Paginated delete loop
  },
);
```

**Paginated step.run pattern** (lines 67-184 of analog — `while (hasNextPage)` with named step.run per cursor):
```typescript
while (hasNextPage) {
  const cursorKey: string = cursor ?? 'start';
  const batch = await step.run(`fetch-batch-${cursorKey}`, async () => /* fetch */);
  // ... process ...
  cursor = batch.endCursor;
  hasNextPage = batch.hasNextPage;
}
```

**For Phase 6 retention loop:**
```typescript
const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
let totalDeleted = 0;
let batchNum = 0;
while (true) {
  batchNum++;
  const deleted = await step.run(`delete-batch-${batchNum}`, async () => {
    // Find IDs first to bound the delete to 1000
    const rows = await prisma.conversation.findMany({
      where: { lastMessageAt: { lt: cutoff } },
      select: { id: true },
      take: 1000,
    });
    if (rows.length === 0) return 0;
    const result = await prisma.conversation.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    return result.count;
  });
  totalDeleted += deleted;
  if (deleted === 0) break;
}
return { totalDeleted };
```

**Also register in `app/api/inngest/route.ts`:**
```typescript
import { retentionSweepFunction } from '@/inngest/functions/retention-sweep';
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction, retentionSweepFunction],
});
```

---

### `prisma/schema.prisma` (EDIT — add 3 models)

**Analog:** existing `Product`, `SyncRun`, `ShopifySession` models in same file (lines 16-207).

**Shop-scoping pattern** (every model has `shop String` + `@@index([shop])` — observed lines 18, 45, 184, 195):
```prisma
model Product {
  id   Int    @id @default(autoincrement())
  shop String   // myshopify.com hostname
  // ...
  @@index([shop])
  @@map("products")
}
```

**For Phase 6 — apply this pattern to every new model.** Reference structure for `Conversation`:
```prisma
model Conversation {
  id            String    @id @default(cuid())
  shop          String
  visitorId     String
  customerId    String?
  title         String    @db.VarChar(60)
  messages      Json      @default("[]")
  lastMessageAt DateTime  @default(now())
  createdAt     DateTime  @default(now())

  @@index([shop])
  @@index([shop, visitorId])
  @@index([shop, customerId])
  @@index([shop, lastMessageAt])
  @@map("conversations")
}
```

**SavedProduct:** mirror `Product` shop-scoping; `@@unique` constraints **NOT modeled in Prisma** — partial unique indexes ship in `db/manual-indexes.sql` (D-20). Same convention as `ProductEmbedding.embedding` (line 140) which is `Unsupported("vector")?` because Prisma can't model the type.

**VisitorCustomerLink:**
```prisma
model VisitorCustomerLink {
  id         String   @id @default(cuid())
  shop       String
  visitorId  String
  customerId String
  mergedAt   DateTime @default(now())

  @@unique([shop, visitorId, customerId])
  @@index([shop])
  @@map("visitor_customer_links")
}
```

This composite unique IS modeled (no partial filter needed) — see `Product.@@unique([shop, handle])` line 44 for the same idiom.

---

### `db/manual-indexes.sql` (EDIT — append partial unique indexes)

**Analog:** `db/manual-indexes.sql` lines 43-57 (idempotent `CREATE INDEX IF NOT EXISTS` pattern).

**Existing pattern:**
```sql
CREATE INDEX IF NOT EXISTS "product_embeddings_embedding_hnsw_idx"
  ON product_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "products_searchVector_gin_idx"
  ON products
  USING GIN ("searchVector");
```

**For Phase 6 — append after line 57:**
```sql
-- ============================================================
-- 4. Partial unique indexes on saved_products (D-20)
-- ============================================================
-- Prisma cannot model partial unique indexes. Two indexes back the
-- ON CONFLICT clause in /api/proxy/saved-products POST (D-20) and the
-- visitor→customer merge transaction (D-11).

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_anon_unique_idx"
  ON saved_products (shop, "visitorId", "productId")
  WHERE "customerId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_customer_unique_idx"
  ON saved_products (shop, "customerId", "productId")
  WHERE "customerId" IS NOT NULL;
```

**File header rule (lines 12-15 of analog):** these indexes survive `prisma migrate dev` but are wiped by `prisma migrate reset`. Re-run `bun db:indexes` after every reset. Phase 6 doesn't change this contract.

**Idempotency rule (line 17):** every CREATE uses `IF NOT EXISTS` — copy verbatim for Phase 6 additions.

---

### `scripts/build-storefront-bundle.ts` (build script, file I/O)

**Analog:** `scripts/apply-manual-indexes.ts` (script shape only — same Node/tsx entry point, env loading, error exit pattern)

**Script shape pattern** (lines 21-74 of analog):
```typescript
import { readFileSync } from 'node:fs';
import 'dotenv/config';
// ...

async function main(): Promise<void> {
  // do work
  console.log('done');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

**For Phase 6 esbuild prebuild:**
```typescript
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

async function main(): Promise<void> {
  const result = await build({
    entryPoints: ['extensions/chat-drawer/src/entry.tsx'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    metafile: true,
    write: false, // hash content before writing
  });
  const code = result.outputFiles[0].text;
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 8);
  const filename = `storefront-bundle.${hash}.js`;
  writeFileSync(`public/${filename}`, code);
  const version = execSync('git rev-parse --short HEAD').toString().trim();
  writeFileSync('public/storefront-manifest.json', JSON.stringify({ bundle: `/${filename}`, version }));
  console.log(`wrote public/${filename}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

**Wire via `package.json` script** (analog: existing `db:indexes` script):
```json
"prebuild": "bunx tsx scripts/build-storefront-bundle.ts"
```

`prebuild` runs automatically before `bun build` (npm lifecycle hook — confirmed standard, RESEARCH §3).

---

### `shopify.app.toml` (EDIT — append `[app_proxy]`)

**Analog:** `shopify.app.toml` (existing — has `[webhooks]`, `[access_scopes]`, `[auth]` blocks)

**Existing block pattern:**
```toml
[webhooks]
api_version = "2026-04"

[access_scopes]
scopes = "read_products,write_products"

[auth]
redirect_urls = [
  "https://<host>/api/auth/callback",
]
```

**For Phase 6 (STR-03, RESEARCH §6):**
```toml
[app_proxy]
url = "https://<host>/api/proxy"
subpath = "smartdiscovery"
prefix = "apps"
```

Storefront fetches at `/apps/smartdiscovery/*` route through Shopify's HMAC-signing proxy and arrive at our `/api/proxy/*` handlers.

---

### `extensions/chat-drawer/*` (NEW — Theme App Extension)

**No local analog.** This is the first Theme App Extension in the codebase.

Reference Shopify docs (RESEARCH §6) and UI-SPEC.md §StorefrontDrawer / §FAB / §Theme Isolation directly.

**Key constraints from UI-SPEC (DO NOT re-decide):**
- z-index strategy: scrim 2000, drawer 2001, FAB 2002 (UI-SPEC Z-index table)
- FAB 56px (`w-14 h-14`), bottom-right default
- Drawer 400px desktop, 85vh bottom-sheet mobile
- Animation: motion `AnimatePresence` ≤250ms slide; `prefers-reduced-motion` snap
- App Embed schema: `enabled` (checkbox), `accent_color` (color, default `#008060`), `fab_position` (select) — UI-SPEC §App Embed Block Settings
- `Shopify.designMode` guard: check at FAB-click time, not mount (UI-SPEC §5 risks)
- localStorage key: `'smartdiscovery.visitor_id'` — canonical, do not introduce second key

**StorefrontDrawer.tsx composition pattern** — compose `lib/chat-ui/*` exports through `StorefrontAdapter`:
```typescript
import { ChatPane, HistoryPanel, SavedProductsPanel } from '@/lib/chat-ui';
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';
```

(Same composition style admin uses — confirm against admin chat page when planner reaches that step.)

---

## Shared Patterns

### Authentication / Authorization (App Proxy HMAC)

**Source:** `lib/shopify/auth.ts` (mirror pattern for `lib/shopify/app-proxy-auth.ts`)
**Apply to:** Every route under `app/api/proxy/*` — no exceptions. Forgetting HMAC = CR-01 redux (multi-tenant data leak).
```typescript
export const POST = withAppProxyHmac(async ({ shop, query, req }) => {
  // shop derived from VALIDATED query, never from raw URL params
});
```

### Rate Limiting

**Source:** NEW `lib/rate-limit/memory.ts` (no local analog)
**Apply to:** Every `/api/proxy/*` handler before any DB work or streamText call.
```typescript
const rl = rateLimit(visitorId, bucket); // bucket: 'chat' | 'read'
if (!rl.ok) {
  return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
}
```

### Shop Scoping (Multi-tenancy Lock)

**Source:** `prisma/schema.prisma` (every model has `shop String` + `@@index([shop])`)
**Apply to:** Every Prisma query in Phase 6 — `where: { shop, ... }`. Every per-row lookup also checks `row.shop !== shop → 403` (pattern: `app/api/shopify/sync/status/route.ts:17-19`).

### Raw SQL ON CONFLICT Upsert

**Source:** `inngest/functions/sync-products.ts:135`
**Apply to:** SavedProduct toggle endpoint, merge transaction.
```typescript
await prisma.$executeRaw`INSERT INTO ... VALUES ... ON CONFLICT (...) WHERE ... DO NOTHING`;
```

### Idempotent Index Creation

**Source:** `db/manual-indexes.sql` (lines 28, 43, 55 — every CREATE uses `IF NOT EXISTS`)
**Apply to:** New partial unique indexes for `saved_products`.

### Inngest Function Shape

**Source:** `inngest/functions/sync-products.ts`
**Apply to:** `inngest/functions/retention-sweep.ts`. `step.run` per batch keeps each step idempotent and retryable.

### Error Response Format

**Source:** `app/api/shopify/sync/status/route.ts` (400/403/404 pattern)
**Apply to:** Every `/api/proxy/*` route.
```typescript
return NextResponse.json({ error: 'missing_visitor_id' }, { status: 400 });
return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } });
return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
```

### Store Interface Compatibility

**Source:** `lib/chat-ui/stores/types.ts` + `lib/chat-ui/stores/local-storage.ts`
**Apply to:** `lib/chat-ui/stores/db-backed.ts` — DbBacked* MUST implement `HistoryStore` / `SavedProductsStore` byte-identically (Phase 5 D-06). `list()` returns synchronously; async refresh happens separately.

### No Secret Logging

**Source:** `app/api/chat/route.ts` (header comment lines 38-40 — "Zero log statements in this file")
**Apply to:** Every Phase 6 file. No `console.log` of headers, tokens, visitor_ids, customer_ids, or bodies. (PROJECT.md hard constraint.)

---

## No Analog Found

Files with no close match in the codebase (planner should rely on RESEARCH.md + Shopify docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `extensions/chat-drawer/blocks/chat-drawer.liquid` | Theme Extension liquid | static | First Theme App Extension in repo |
| `extensions/chat-drawer/assets/loader.js` | extension loader | dynamic import | First extension JS in repo |
| `extensions/chat-drawer/assets/loader.css` | extension CSS | static | First extension CSS in repo |
| `extensions/chat-drawer/src/entry.tsx` | DOM mount entry | bootstrap | First esbuild bundle entry in repo |
| `lib/rate-limit/memory.ts` | rate limiter | request-response | No existing rate-limit utility |

For these, planner uses:
- RESEARCH.md §"Bundle Build Pipeline" and §"App Proxy specifics" for tooling
- UI-SPEC.md §StorefrontDrawer / §FAB / §App Embed Block Settings for visual + schema contract
- Shopify Theme App Extension official docs (context7 lookup as needed)

---

## Metadata

**Analog search scope:** `app/api/`, `lib/`, `inngest/`, `services/`, `scripts/`, `prisma/`, `db/`, `shopify.app.toml`, `package.json`
**Files scanned:** 22 (full read of `app/api/chat/route.ts`, `app/api/proxy/chat/route.ts`, `app/api/shopify/sync/route.ts`, `app/api/shopify/sync/status/route.ts`, `app/api/inngest/route.ts`, `lib/shopify/auth.ts`, `lib/shopify/client.ts`, `lib/chat-ui/adapters/storefront.ts`, `lib/chat-ui/adapters/types.ts`, `lib/chat-ui/adapters/embedded.ts`, `lib/chat-ui/stores/local-storage.ts`, `lib/chat-ui/stores/types.ts`, `lib/chat-ui/stores/hooks.ts`, `inngest/functions/sync-products.ts`, `lib/inngest/client.ts`, `scripts/apply-manual-indexes.ts`, `db/manual-indexes.sql`, `prisma/schema.prisma`, `shopify.app.toml`, `package.json` scripts block, plus directory listings under `app/api/`, `services/`, `lib/chat-ui/components/`)
**Pattern extraction date:** 2026-05-26
