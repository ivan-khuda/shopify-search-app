# Phase 4: SearchService + Wire Chat — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 9 created / 5 modified / 1 deleted = 15 total
**Analogs found:** 14 / 15 (1 has no direct analog — preview banner has no precedent component)

---

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `services/search/SearchService.ts` | CREATE | service | request-response (composite SELECT, RRF transform) | `services/embeddings/EmbeddingService.ts` | exact (AI-Gateway service, raw-SQL escape hatch, shop-first signature) |
| `services/search/__tests__/SearchService.test.ts` | CREATE | test (unit, mocked) | request-response | `services/embeddings/__tests__/EmbeddingService.test.ts` | exact (same `vi.hoisted` + `vi.mock('ai')` + `vi.mock('@/lib/db/client')` pattern) |
| `services/chat/getActiveChatModel.ts` | CREATE | service (config-resolver stub) | request-response | `services/search/searchableText.ts` | role-match (small pure-ish helper, single export) |
| `services/chat/__tests__/getActiveChatModel.test.ts` | CREATE | test (unit, pure) | request-response | `services/search/__tests__/searchableText.test.ts` | exact (pure function, no mocks needed) |
| `app/api/chat/route.ts` | REPLACE | API route (POST handler) | streaming (SSE via toUIMessageStreamResponse) | `app/api/shopify/sync/route.ts` | exact (uses `withShopifySession` wrapper, shop-scoped service call) |
| `app/api/chat/__tests__/route.test.ts` | CREATE | test (unit, route-level) | request-response (mocked stream) | `app/api/shopify/sync/__tests__/route.test.ts` | exact (auth-error matrix + service-call verification) |
| `app/api/proxy/chat/route.ts` | CREATE (STUB) | API route (POST handler) | request-response (JSON; storefront) | `app/api/shopify/sync/route.ts` | role-match (no `withShopifySession` — proxy uses different auth, but route handler shape applies) |
| `app/api/proxy/chat/__tests__/route.test.ts` | CREATE | test (unit, route-level) | request-response | `app/api/shopify/sync/__tests__/route.test.ts` | exact |
| `app/(embedded)/chat/page.tsx` | MODIFY | server component (refactor from client) | request-response (await getActiveChatModel) | `app/(embedded)/layout.tsx` | partial (only async/server-component precedent in `app/(embedded)/`) |
| `components/chat/chat.tsx` | MODIFY | client component (chat shell) | event-driven (`useChat` hook stream) | (self — refactor in place) | self-referential (delete glue, no new code shape) |
| `components/chat/message-parts.tsx` | MODIFY | client component (parts renderer) | event-driven (parts stream → DOM) | (self — extend in place) | self-referential (add tool-searchCatalog case to existing switch) |
| `components/chat/__tests__/message-parts.test.tsx` | CREATE | test (RTL component) | event-driven | `components/chat/__tests__/product-card.test.tsx` | role-match (component render + assertion, no mocks needed beyond fixtures) |
| `components/chat/chat.integration-test.tsx` | MODIFY | test (RTL integration) | event-driven | (self — refactor in place) | self-referential (rewire mock to emit tool-searchCatalog part) |
| `components/chat/mock-products.ts` | DELETE | — | — | — | — |
| Preview banner JSX inside `page.tsx` | CREATE (inline, no separate file) | server-rendered UI | request-response | none (no precedent for muted banner) | no analog — implement per UI-SPEC.md |

---

## Pattern Assignments

### `services/search/SearchService.ts` (service, hybrid retrieval)

**Analog:** `services/embeddings/EmbeddingService.ts`
**Why this analog:** Phase 3 service that (a) calls AI Gateway via the `ai` package, (b) drops to raw SQL through `prisma.$executeRaw`, (c) uses shop-first signature, (d) handles vector-literal cast `::vector`. SearchService is the read-side counterpart to EmbeddingService's write-side `embedAndStore`.

**Imports pattern** (`services/embeddings/EmbeddingService.ts:24-25`):
```typescript
import { embed as embedSdk, embedMany } from 'ai';
import { prisma } from '@/lib/db/client';
```
For SearchService, add:
```typescript
import { embed } from '@/services/embeddings/EmbeddingService';  // reuse Phase 3 query embedding
import { withHnswIterativeScan } from '@/lib/db/hnsw';            // mandatory wrapper
import { Prisma } from '@/app/generated/prisma/client';           // for Prisma.sql template fragments
```

**Module-level constants pattern** (`services/embeddings/EmbeddingService.ts:27-28`):
```typescript
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;
```
Copy directly to SearchService:
```typescript
export const RRF_K = 60 as const;
export const BRANCH_LIMIT = 50 as const;
export const RESULT_LIMIT = 10 as const;
```

**Empty-input short-circuit pattern** (`services/embeddings/EmbeddingService.ts:70-73`):
```typescript
export async function embedBatch(texts: string[]): Promise<EmbedBatchResult> {
  if (texts.length === 0) {
    return { ok: [], failed: [] };
  }
  // ...
}
```
Apply to `hybridSearch`:
```typescript
const trimmed = query.trim();
if (!trimmed) return [];  // matches CONTEXT.md Specifics — no AI Gateway call on empty input
```

**Vector literal cast pattern** (`services/embeddings/EmbeddingService.ts:116-119`):
```typescript
const vector = await embed(text);
const vectorLiteral = `[${vector.join(',')}]`;

await prisma.$executeRaw`INSERT INTO product_embeddings ... VALUES (..., ${vectorLiteral}::vector, ...)`;
```
SearchService uses the same `${vectorLiteral}::vector` cast inside the `$queryRaw` template.

**Dimension-mismatch guard pattern** (`services/embeddings/EmbeddingService.ts:48-52`):
```typescript
if (embedding.length !== EMBEDDING_DIMENSIONS) {
  throw new Error(
    `Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`
  );
}
```
SearchService gets this guard for free by importing `embed` from EmbeddingService — do NOT re-wrap.

**Shop-scoping in raw SQL pattern** (`services/embeddings/EmbeddingService.ts:119`):
```typescript
// shop appears as `${shop}` in the INSERT row tuple — note shop = productShop pattern
INSERT INTO product_embeddings (shop, "productShop", "productId", ...) VALUES (${shop}, ${shop}, ${productId}, ...)
```
SearchService applies the same `${shop}` parameter to both `pe.shop` AND `p.shop` (Phase 4 D-03 explicit defense-in-depth).

**Helpful additional source for the transaction pattern:** `lib/db/hnsw.ts` is the canonical wrapper SearchService must use:
```typescript
// lib/db/hnsw.ts:20-27
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
```
Call shape:
```typescript
const rows = await withHnswIterativeScan(async (tx) => {
  return tx.$queryRaw<RankedProductRow[]>`...`;
});
```

**JSDoc block pattern** (`services/embeddings/EmbeddingService.ts:1-23`):
SearchService should open with a similarly framed responsibilities block:
- Numbered responsibilities (EMB-05, EMB-07)
- Security note (no logging of query text in error path — CLAUDE.md "no secrets in logs")
- Multi-tenancy note (D-03 explicit double `WHERE shop = $1`)
- Reuse note (uses EmbeddingService.embed and withHnswIterativeScan unchanged)

---

### `services/search/__tests__/SearchService.test.ts` (test, unit, mocked)

**Analog:** `services/embeddings/__tests__/EmbeddingService.test.ts`
**Why this analog:** Same mocking surface (`ai` package + `@/lib/db/client`), same `vi.hoisted` destructure pattern, same shop-scoping assertion technique.

**Hoist mock pattern** (`services/embeddings/__tests__/EmbeddingService.test.ts:16-31`):
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
  prisma: {
    $executeRaw: executeRawMock,
  },
}));
```

For SearchService.test.ts, adapt to:
```typescript
const { embedMock, queryRawMock, transactionMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
}));

// Option A: mock EmbeddingService directly (cleaner)
vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embed: embedMock,
}));

// Option B: mock `ai` (one indirection deeper — only needed if test wants to assert AI Gateway routing too)

// Mock the hnsw wrapper to invoke the callback with a tx exposing $queryRaw
vi.mock('@/lib/db/hnsw', () => ({
  withHnswIterativeScan: vi.fn(async (cb) => cb({ $queryRaw: queryRawMock })),
}));
```

The `hnsw.test.ts` pattern at `lib/db/__tests__/hnsw.test.ts:29-33` shows the canonical way to wire `$transaction` callback form synchronously:
```typescript
transactionMock.mockImplementation(
  async (cb: (tx: { $executeRaw: typeof executeRawMock }) => Promise<unknown>) =>
    cb({ $executeRaw: executeRawMock }),
);
```

**Shop-scoping assertion pattern** (`services/embeddings/__tests__/EmbeddingService.test.ts:151-163`):
```typescript
const call = executeRawMock.mock.calls[0];
const values = call.slice(1);

// Shop scoping: shop appears twice (shop column + productShop column).
const shopOccurrences = values.filter((v: unknown) => v === 'shop.myshopify.com').length;
expect(shopOccurrences).toBeGreaterThanOrEqual(2);
```
SearchService.test.ts copies this exactly — D-03 says `pe.shop = ${shop} AND p.shop = ${shop}`, so the shop string should appear at least 2 times in the parameter values per branch.

**SQL skeleton assertion pattern** (`services/embeddings/__tests__/EmbeddingService.test.ts:172-180`):
```typescript
const call = executeRawMock.mock.calls[0];
const sqlSkeleton = (call[0] as readonly string[]).join('?');
expect(sqlSkeleton).toMatch(/ON CONFLICT[\s\S]*shop[\s\S]*productShop[\s\S]*productId[\s\S]*DO UPDATE/);
expect(sqlSkeleton).toContain('EXCLUDED."modelVersion"');
expect(sqlSkeleton).toContain('::vector');
expect(sqlSkeleton).not.toContain('<#>');
```
Adapt for SearchService:
```typescript
expect(sqlSkeleton).toMatch(/WITH vec_ranked AS[\s\S]*lex_ranked AS[\s\S]*fused AS/);
expect(sqlSkeleton).toContain('::vector');
expect(sqlSkeleton).toContain('<=>');                              // cosine distance
expect(sqlSkeleton).toContain('websearch_to_tsquery');
expect(sqlSkeleton).toContain('ts_rank_cd');
expect(sqlSkeleton).toContain("p.status = 'ACTIVE'");
expect(sqlSkeleton).not.toContain('<#>');                          // wrong distance op
```

**Cross-shop isolation test pattern** (`lib/db/repositories/__tests__/ProductRepository.test.ts:72-88`):
```typescript
it('shop appears in where clause — cross-shop isolation', async () => {
  await productRepository.findByShopAndId('shop-a.myshopify.com', 1);
  const callA = (...).mock.calls[0][0];

  vi.clearAllMocks();

  await productRepository.findByShopAndId('shop-b.myshopify.com', 1);
  const callB = (...).mock.calls[0][0];

  expect(callA.where.shop).toBe('shop-a.myshopify.com');
  expect(callB.where.shop).toBe('shop-b.myshopify.com');
});
```
SearchService.test.ts repeats this pattern at the `$queryRaw` parameter-values level.

---

### `services/chat/getActiveChatModel.ts` (service, config-resolver stub)

**Analog:** `services/search/searchableText.ts`
**Why this analog:** Tiny pure-ish helper file in `services/`; a single exported async function with a documentation block explaining a contract (the "ASYMMETRY" doc in searchableText is analogous to the "Phase 7 will replace the body" contract here).

**File-level JSDoc pattern** (`services/search/searchableText.ts:3-22`):
```typescript
/**
 * ASYMMETRY (D-03 vs D-04):
 *
 * This embed-input string INCLUDES `options` ...
 * The tsvector column (...) DOES NOT include options ...
 *
 * DO NOT add options to the tsvector composition without re-deriving D-04.
 */
export function buildSearchableText(product: ProductUpsertInput): string { ... }
```
For getActiveChatModel.ts use a similar lock-block:
```typescript
/**
 * Phase 4 contract anchor (D-09):
 *
 * Returns the active chat model for a shop. Phase 4 returns a hardcoded
 * default. Phase 7 will replace the body to read ShopSettings.activeChatModel
 * from the database. The shop-first signature is the contract today —
 * callers in Phase 4 already pass `shop` so Phase 7 is a body-only swap.
 *
 * DO NOT inline the model id at call sites. Always route through this helper.
 */
```

**Constant pattern** (`services/embeddings/EmbeddingService.ts:27-28`):
```typescript
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small' as const;
```
Apply:
```typescript
const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};
```

---

### `services/chat/__tests__/getActiveChatModel.test.ts` (test, pure)

**Analog:** `services/search/__tests__/searchableText.test.ts`
**Why this analog:** Pure function under test, no mocks, no `vi.hoisted` block needed.

**Bare-minimum test pattern** (`services/search/__tests__/searchableText.test.ts:1-30`):
```typescript
import { describe, it, expect } from 'vitest';
import { buildSearchableText } from '../searchableText';

function baseInput(overrides: Partial<ProductUpsertInput> = {}): ProductUpsertInput {
  return { ... };
}

describe('buildSearchableText', () => {
  it('Title/Description/Tags/Vendor/Type/Options labels appear in output in that exact order', () => {
    const out = buildSearchableText(baseInput({ ... }));
    expect(out).toBe('Title: T\n...');
  });
  // ...
});
```
For getActiveChatModel.test.ts:
```typescript
import { describe, it, expect } from 'vitest';
import { getActiveChatModel } from '../getActiveChatModel';

describe('getActiveChatModel (Phase 4 stub)', () => {
  it('returns hardcoded { id: google/gemini-2.5-flash, displayName: Gemini 2.5 Flash } for any shop', async () => {
    const result = await getActiveChatModel('any-shop.myshopify.com');
    expect(result).toEqual({ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' });
  });

  it('returns the same constant for different shops (Phase 4 is shop-agnostic by design)', async () => {
    const a = await getActiveChatModel('shop-a.myshopify.com');
    const b = await getActiveChatModel('shop-b.myshopify.com');
    expect(a).toEqual(b);
  });
});
```

---

### `app/api/chat/route.ts` (REPLACE — API route, streaming)

**Analog:** `app/api/shopify/sync/route.ts`
**Why this analog:** Same `withShopifySession`-wrapped POST handler shape; same shop-scoped service-call dispatch from inside the wrapper closure. The currently-shipped `app/api/chat/route.ts` (Apr 27) violates the AI Gateway constraint and bypasses `withShopifySession` — we DO NOT copy from current code.

**Wrapper pattern** (`app/api/shopify/sync/route.ts:7-35`):
```typescript
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';
// ...
export const POST = withShopifySession(async ({ shop, session }) => {
  void session; // wrapper validated; ...
  // ... body uses `shop` directly ...
  return NextResponse.json({ syncRunId: run.id });
});
```

For `/api/chat/route.ts` the same shape, replacing the body:
```typescript
import { streamText, stepCountIs, tool, convertToModelMessages, type UIMessage } from 'ai';
import { z } from 'zod';
import dedent from 'dedent';
import { withShopifySession } from '@/lib/shopify/auth';
import { hybridSearch } from '@/services/search/SearchService';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';

export const POST = withShopifySession(async ({ shop, req }) => {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const model = await getActiveChatModel(shop);

  const result = streamText({
    model: model.id,  // AI Gateway string — NO provider import
    system: dedent`
      You are a product search assistant for ${shop}.
      Always call the searchCatalog tool before recommending products.
      ...
    `,
    messages: convertToModelMessages(messages),
    tools: {
      searchCatalog: tool({
        description: dedent`...`,
        inputSchema: z.object({                    // ← v6 field name (NOT `parameters`)
          query: z.string().min(1).max(500).describe('...'),
          priceMin: z.number().optional().describe('...'),
          priceMax: z.number().optional().describe('...'),
        }),
        execute: async ({ query, priceMin, priceMax }) => {
          return hybridSearch(shop, query, { priceMin, priceMax });
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
});
```

**Critical:** The current `app/api/chat/route.ts:1-55` uses `model: google("gemini-2.5-flash")` from `@ai-sdk/google` — DELETE this import and switch to the plain string. The `FALLBACK_RESPONSE` / `createMissingApiKeyFallbackResponse` block at lines 11-29 is also gone in the rewrite (per CONTEXT.md D-10 — AI Gateway has its own error handling).

**Streaming response pattern** (`app/api/chat/route.ts:54` — current file, this one line survives):
```typescript
return result.toUIMessageStreamResponse();
```
Keep this exact call shape.

**Imports from sync route to mirror** (`app/api/shopify/sync/route.ts:1-5`):
```typescript
import { NextResponse } from 'next/server';
import { withShopifySession } from '@/lib/shopify/auth';
```
But `/api/chat/route.ts` does NOT need `NextResponse` — the `streamText` result IS the response via `.toUIMessageStreamResponse()`. Only error paths (none in Phase 4) would need NextResponse, and the auth-error JSON response is already handled inside `withShopifySession` (`lib/shopify/auth.ts:78-80`).

---

### `app/api/chat/__tests__/route.test.ts` (test, route-level)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts`
**Why this analog:** Same `withShopifySession` test surface, same `vi.mock('@/lib/shopify/client')` + `vi.mock('@/lib/shopify/session-storage')` pattern, same `makeRequest()` helper for building Bearer-auth requests.

**Auth-mock setup pattern** (`app/api/shopify/sync/__tests__/route.test.ts:9-31`):
```typescript
vi.mock('@/lib/shopify/client', () => {
  return {
    shopifyClient: {
      session: {
        decodeSessionToken: vi.fn(),
        getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
      },
      // ...
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
```
Copy verbatim to `app/api/chat/__tests__/route.test.ts`. Add a third mock for the chat-specific deps:
```typescript
const { streamTextMock, hybridSearchMock, getActiveChatModelMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  hybridSearchMock: vi.fn(),
  getActiveChatModelMock: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: streamTextMock,
    // keep `tool`, `stepCountIs`, `convertToModelMessages` real so the tool definition is exercised
  };
});

vi.mock('@/services/search/SearchService', () => ({
  hybridSearch: hybridSearchMock,
}));

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: getActiveChatModelMock,
}));
```

**Auth-error matrix pattern** (`app/api/shopify/sync/__tests__/route.test.ts:62-112`):
```typescript
it('returns 401 when Authorization header is missing', async () => {
  const res = await POST(makeRequest());
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe('missing_token');
});

it('returns 401 when token cannot be decoded', async () => { ... });
it('returns 401 invalid_dest when payload.dest is not a parseable URL', async () => { ... });
it('returns 401 invalid_shop_domain when hostname is not *.myshopify.com', async () => { ... });
it('returns 401 when no offline session exists for the shop', async () => { ... });
```
The chat route inherits the same 5-case auth matrix automatically by using `withShopifySession`. Test once that the wrapper is in place; the 5 cases are already covered by `lib/shopify/__tests__/auth.test.ts:175-219` (the parametrized `it.each` block).

**Tool wiring assertion pattern** (new — no exact precedent):
```typescript
it('passes shop into the searchCatalog tool execute closure', async () => {
  // arrange auth mocks to authenticate as 'example-shop.myshopify.com'
  // arrange getActiveChatModelMock to return { id: 'google/gemini-2.5-flash', displayName: '...' }
  // arrange streamTextMock to capture the args
  const res = await POST(makeRequest({ Authorization: 'Bearer good' }, { messages: [...] }));

  const streamArgs = streamTextMock.mock.calls[0][0];
  expect(streamArgs.model).toBe('google/gemini-2.5-flash');  // AI Gateway plain string
  expect(streamArgs.tools).toHaveProperty('searchCatalog');

  // Invoke the tool execute to confirm shop closure
  await streamArgs.tools.searchCatalog.execute({ query: 'shoes', priceMax: 100 });
  expect(hybridSearchMock).toHaveBeenCalledWith(
    'example-shop.myshopify.com',
    'shoes',
    { priceMin: undefined, priceMax: 100 },
  );
});

it('system prompt contains the shop name (steers the LLM)', async () => { ... });
it('uses inputSchema (not parameters) on the tool — Vercel AI SDK v6 field name', async () => {
  // The tool object should have a Zod schema at `.inputSchema`, not `.parameters`
});
```

---

### `app/api/proxy/chat/route.ts` (CREATE STUB — API route)

**Analog:** `app/api/shopify/sync/route.ts`
**Why this analog:** Both are POST handlers under `app/api/`; both call a service and return JSON. The proxy route does NOT use `withShopifySession` (App Proxy uses HMAC, Phase 6 territory) but the file shape is identical.

**Route handler skeleton** (`app/api/shopify/sync/route.ts:7`):
```typescript
export const POST = withShopifySession(async ({ shop, session }) => {
  // ...
  return NextResponse.json({ syncRunId: run.id });
});
```

For the proxy stub (no auth wrapper, TODO marker):
```typescript
/**
 * Storefront chat endpoint — Phase 4 STUB.
 *
 * Phase 4 ships only enough surface to satisfy EMB-07's "both routes call
 * SearchService" success criterion. Real HMAC verification and visitor
 * identity wiring belongs to Phase 6.
 *
 * TODO(Phase 6): Replace this stub with:
 *   1. App Proxy HMAC validation (shopifyClient.utils.validateHmac, signator='appProxy')
 *   2. Anonymous visitor identity (signed cookie) per PROJECT.md "Storefront identity"
 *   3. streamText({ tools: { searchCatalog } }) with the same tool as /api/chat
 *   4. Shared chat-ui components from Phase 5
 *
 * DO NOT use from production storefront drawer code until Phase 6.
 */
import { hybridSearch } from '@/services/search/SearchService';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop');
  if (!shop) return Response.json({ error: 'missing_shop' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { query?: string };
  const query = (body.query ?? '').trim();
  if (!query) return Response.json({ products: [] });

  const products = await hybridSearch(shop, query);
  return Response.json({ products });
}
```

**Note on response shape:** `Response.json()` is the Web-API form. The sync route uses `NextResponse.json()` — both work in route handlers; the proxy stub uses the Web-API form because (a) it's simpler, (b) Phase 6 will likely return SSE via `streamText`, dropping NextResponse entirely.

---

### `app/api/proxy/chat/__tests__/route.test.ts` (test, route-level)

**Analog:** `app/api/shopify/sync/__tests__/route.test.ts:50-67` (helper + first test only — auth matrix doesn't apply)

**Helper pattern** (`app/api/shopify/sync/__tests__/route.test.ts:50-55`):
```typescript
function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/shopify/sync', {
    method: 'POST',
    headers,
  });
}
```
Adapt:
```typescript
function makeRequest(url: string, body?: object): Request {
  return new Request(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**Service-call mock pattern** (`app/api/shopify/sync/__tests__/route.test.ts:33-44`):
```typescript
vi.mock('@/lib/db/client', () => ({ ... }));
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: inngestSend } }));
```
Adapt:
```typescript
const { hybridSearchMock } = vi.hoisted(() => ({ hybridSearchMock: vi.fn() }));
vi.mock('@/services/search/SearchService', () => ({ hybridSearch: hybridSearchMock }));
```

**Test cases:**
1. `returns 400 when shop query param is missing`
2. `returns { products: [] } when query body is empty/whitespace (short-circuit)`
3. `calls SearchService.hybridSearch(shop, query) and returns the result as JSON`

---

### `app/(embedded)/chat/page.tsx` (MODIFY — server component)

**Analog:** `app/(embedded)/layout.tsx` (only async/server-component precedent in `(embedded)`)
**Why this analog:** The layout shows how the (embedded) route group hosts non-client code; the current `page.tsx` uses `'use client'` and `useState`. Per RESEARCH.md §6 the planner refactors to either (a) keep the page client but pass `displayName` from a parent server wrapper, or (b) split into Server Page + Client Shell. Option (b) is cleaner — copy the layout's server-component shape.

**Server component shape** (`app/(embedded)/layout.tsx:11-25`):
```typescript
export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="..." strategy="beforeInteractive" />
      <EmbeddedProviders>{children}</EmbeddedProviders>
    </>
  );
}
```
Adapt for `page.tsx`:
```typescript
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { ChatShell } from '@/components/chat/chat-shell';  // new client component (was page.tsx)

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  // middleware guarantees shop is present on this route in practice
  const model = await getActiveChatModel(shop ?? '');
  return (
    <div className="mx-auto w-full">
      <div
        role="status"
        aria-live="off"
        aria-label={`Chat playground preview mode banner. Active model: ${model.displayName}.`}
        className="bg-muted/40 text-muted-foreground text-xs py-1.5 px-4 sm:px-6 border-b border-border"
      >
        Preview mode — using your real catalog · Model:{' '}
        <span className="text-foreground font-semibold">{model.displayName}</span>
      </div>
      <ChatShell />
    </div>
  );
}
```

**Banner exact-character verification:**
- Em-dash between "mode" and "using": U+2014 (`—`)
- Middle-dot between "catalog" and "Model:": U+00B7 (`·`)
- Source: `04-UI-SPEC.md` Copywriting table + `04-CONTEXT.md` D-11

**Note:** the existing client-side state (tabs/history/savedProducts) moves into the new `ChatShell` client component. No state lives in the server `page.tsx`.

**Existing integration test reference:** `app/(embedded)/chat/page.integration-test.tsx` will need its mock target moved from `@/components/chat/chat` to `@/components/chat/chat-shell` (or the page test gets reframed around the server component output). The planner picks the cleaner split.

---

### `components/chat/chat.tsx` (MODIFY — refactor in place)

**Analog:** self (delete `PendingProductAttachment`, `MOCK_PRODUCTS`, `buildMockResults`, `attachedProducts` memo, the in-render product grid). No new pattern to import — this is a deletion plan.

**Lines to delete (current `components/chat/chat.tsx`):**

| Lines | Content | Why |
|-------|---------|-----|
| 17–18 | `import { ProductCard } from '@/components/chat/product-card';`, `import { MOCK_PRODUCTS } from '@/components/chat/mock-products';` | ProductCard moves into MessageParts; MOCK_PRODUCTS file is deleted |
| 77–85 | `ProductAttachmentState`, `PendingProductAttachment` interfaces | No longer used |
| 87–103 | `buildMockResults` function | Replaced by tool-call wiring |
| 106 | `const [pendingProducts, setPendingProducts] = useState<PendingProductAttachment | null>(null);` | No longer needed |
| 112–142 | `attachedProducts` useMemo | No longer needed; products come from `message.parts` |
| 144–169 (partial) | Inside `handleSubmit`: lines 153–158 (the `buildMockResults` call + `setPendingProducts`) — keep the rest of `handleSubmit` (history-add + sendMessage) | Tool wiring replaces this |
| 184–202 | The map block's `productsForMessage` + the inline ProductCard grid `<div className="grid ...">` | Grid moves into `MessageParts` `case 'tool-searchCatalog'` |

**Lines to KEEP:**
- `useChat` import (line 4)
- `useChat()` hook call (line 107) — re-extract `setMessages` if planner moves state into MessageParts; otherwise keep as-is
- All `PromptInput*` JSX (lines 209–231)
- The greeting `<p>` block (lines 175–182), but update the copy per UI-SPEC.md to:
  ```
  Hello! I'm your AI Shopping Assistant. Try a search like "warm winter clothes" or "running shoes under $80".
  ```
  (Note: use `&apos;` for apostrophes to match existing JSX entity pattern at line 178.)

**Threading `savedProductIds` + `onToggleSave` into MessageParts:**
The cleanest refactor (per RESEARCH.md §3) is to pass these as props to `MessageParts`. The current `MessageParts` signature is:
```typescript
// components/chat/message-parts.tsx:129-133
interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  status?: ChatStatus;
}
```
Extend to:
```typescript
interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  status?: ChatStatus;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
}
```
Then pass through from `ChatMessage` (`components/chat/chat-message.tsx:93-99`):
```typescript
<MessageParts
  status={status}
  parts={partsToRender}
  messageId={id}
  savedProductIds={savedProductIds}
  onToggleSave={onToggleSave}
/>
```
And from `chat.tsx`:
```typescript
<ChatMessage
  message={message}
  status={status}
  savedProductIds={savedProductIds}
  onToggleSave={onToggleSave}
/>
```

---

### `components/chat/message-parts.tsx` (MODIFY — extend in place)

**Analog:** self (add a `case 'tool-searchCatalog'` branch to the existing `parts.map` switch).

**Current switch shape** (`components/chat/message-parts.tsx:145-178`):
```typescript
{messageParts.map((part, index) => {
  const { type } = part;
  const key = `message-${messageId}-part-${index}`;

  if (status === "streaming" || (type === "text" && part.text === "Thinking...")) {
    return <TextShimmer duration={10} key={key}>Thinking...</TextShimmer>;
  }

  if (type === "text") {
    return (
      <div className="markdown" key={key}>
        <Response>{part.text}</Response>
      </div>
    );
  }
  // ...
  return null;
})}
```

**Add the tool-searchCatalog branch (per UI-SPEC.md Interaction + Motion Contract):**
```typescript
if (type === 'tool-searchCatalog') {
  // Type guard: tool-${name} parts have `state`, `input`, `output`, `errorText`
  const toolPart = part as ToolUIPart;

  if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
    return (
      <div
        key={key}
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-opacity duration-150"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Searching your catalog…
      </div>
    );
  }

  if (toolPart.state === 'output-available' && Array.isArray(toolPart.output)) {
    const products = toolPart.output as ChatProduct[];
    if (products.length === 0) {
      return (
        <div
          key={key}
          role="status"
          aria-live="polite"
          className="flex flex-col items-start gap-1 transition-opacity duration-150"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <SearchX className="size-5" aria-hidden="true" />
            No matching products
          </div>
          <p className="text-xs text-muted-foreground">
            Try a broader description or remove the price filter.
          </p>
        </div>
      );
    }
    return (
      <ul
        key={key}
        role="list"
        aria-live="polite"
        aria-label={`${products.length} matching products`}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-150"
      >
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              isSaved={savedProductIds.has(product.id)}
              onSave={() => onToggleSave(product)}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (toolPart.state === 'output-error') {
    return (
      <div
        key={key}
        role="status"
        aria-live="polite"
        className="flex flex-col items-start gap-1 transition-opacity duration-150"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <AlertCircle className="size-3 text-destructive" aria-hidden="true" />
          Couldn&apos;t fetch results
        </div>
        <p className="text-xs text-muted-foreground">Please try that search again.</p>
      </div>
    );
  }

  return null;
}
```

**New imports needed:**
```typescript
import { Loader2, SearchX, AlertCircle } from 'lucide-react';
import { ProductCard } from '@/components/chat/product-card';
import type { ChatProduct } from '@/types/product';
```

**TextShimmer for `streaming` branch is reused unchanged.** The existing line 149-151 keeps the "Thinking..." behavior for non-tool streaming.

**ProductCard rendering pattern** (`components/chat/chat.tsx:191-201` — moving from chat.tsx to here):
```typescript
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {productsForMessage.map((product) => (
    <ProductCard
      key={product.id}
      product={product}
      isSaved={savedProductIds.has(product.id)}
      onSave={() => onToggleSave(product)}
    />
  ))}
</div>
```
Note UI-SPEC.md requires `<ul role="list"><li>...` wrapping for a11y — the previous `<div>` form does not — so this is a wrapping upgrade, not a pure move.

---

### `components/chat/__tests__/message-parts.test.tsx` (CREATE — RTL component test)

**Analog:** `components/chat/__tests__/product-card.test.tsx`
**Why this analog:** Same RTL render/screen/fireEvent pattern, same lightweight fixture approach. No mocks beyond fixtures.

**Imports + render pattern** (`components/chat/__tests__/product-card.test.tsx:1-31`):
```typescript
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChatProduct } from '@/types/product';
import { ProductCard } from '@/components/chat/product-card';

describe('ProductCard', () => {
  it('renders product details and calls onSave when the heart button is clicked', () => {
    const onSave = vi.fn();
    const product: ChatProduct = { id: '1', title: '...', price: '...', description: '...', image: '...' };

    render(<ProductCard product={product} isSaved={false} onSave={onSave} />);

    expect(screen.getByText(product.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
```

**Adaptation for `message-parts.test.tsx`:**
```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';
import type { ChatProduct } from '@/types/product';
import { MessageParts } from '@/components/chat/message-parts';

const sampleProducts: ChatProduct[] = [
  { id: '1', title: 'Test Sneakers', price: '$89.00 – $129.00', description: 'A test product.' },
];

function makeMessage(parts: UIMessage['parts']): UIMessage['parts'] {
  return parts;
}

describe('MessageParts — tool-searchCatalog', () => {
  it('renders pill with "Searching your catalog…" when state is input-streaming', () => {
    const parts = makeMessage([
      { type: 'tool-searchCatalog', state: 'input-streaming', input: { query: 'shoes' } } as never,
    ]);
    render(<MessageParts parts={parts} messageId="m1" savedProductIds={new Set()} onToggleSave={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Searching your catalog/i);
  });

  it('renders ProductCard grid when state is output-available with products', () => {
    const parts = makeMessage([
      { type: 'tool-searchCatalog', state: 'output-available', output: sampleProducts } as never,
    ]);
    render(<MessageParts parts={parts} messageId="m1" savedProductIds={new Set()} onToggleSave={vi.fn()} />);
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', '1 matching products');
    expect(screen.getByText('Test Sneakers')).toBeInTheDocument();
  });

  it('renders "No matching products" when state is output-available with empty array', () => {
    const parts = makeMessage([
      { type: 'tool-searchCatalog', state: 'output-available', output: [] } as never,
    ]);
    render(<MessageParts parts={parts} messageId="m1" savedProductIds={new Set()} onToggleSave={vi.fn()} />);
    expect(screen.getByText(/No matching products/i)).toBeInTheDocument();
  });

  it('renders "Couldn\'t fetch results" when state is output-error', () => {
    const parts = makeMessage([
      { type: 'tool-searchCatalog', state: 'output-error', errorText: 'boom' } as never,
    ]);
    render(<MessageParts parts={parts} messageId="m1" savedProductIds={new Set()} onToggleSave={vi.fn()} />);
    expect(screen.getByText(/Couldn't fetch results/i)).toBeInTheDocument();
  });
});
```

---

### `components/chat/chat.integration-test.tsx` (MODIFY — rewire mock)

**Analog:** self (current file pre-tool-call era)

**Current mock shape** (`components/chat/chat.integration-test.tsx:6-30`):
```typescript
const { getMessages, sendMessage, setMessages } = vi.hoisted(() => {
  let messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
    },
  ];

  return {
    getMessages: () => messages,
    sendMessage: vi.fn(),
    setMessages: (nextMessages: typeof messages) => {
      messages = nextMessages;
    },
  };
});

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: getMessages(),
    sendMessage,
    status: 'ready',
  }),
}));
```

**Adaptation:** Replace the `MOCK_PRODUCTS` import (line 4) and the dependence on it. Update one of the `setMessages` calls to include a `tool-searchCatalog` part with `output-available` and inline product fixture:
```typescript
import type { ChatProduct } from '@/types/product';

const TEST_PRODUCT: ChatProduct = {
  id: 'p-1',
  title: 'Test Sneakers',
  price: '$89.00',
  description: 'A test product.',
};

// In the assertion block (was lines 74-90):
setMessages([
  // ...prior messages...
  {
    id: 'assistant-2',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Fresh running options for you.' },
      { type: 'tool-searchCatalog', state: 'output-available', output: [TEST_PRODUCT] } as never,
    ],
  },
]);
```

The `onHistoryAdd` assertion at lines 62-68 — the `productCount: 1` field is no longer derived client-side; either drop it or compute it from message parts in `handleSubmit`. Planner decides.

---

### `components/chat/mock-products.ts` (DELETE)

No analog. Delete the file. Update any remaining imports — Phase 4 RESEARCH.md confirms only:
- `components/chat/chat.tsx:18` (removed in the modify-in-place)
- `components/chat/chat.integration-test.tsx:4` (removed in the modify-in-place)

After both updates, `bun lint` should confirm zero references.

---

## Shared Patterns

### Pattern: Shop-first signature on every service method

**Source:** Phase 1 D-03 contract enforced across `lib/db/repositories/ProductRepository.ts`, `services/embeddings/EmbeddingService.ts`, `services/shopify/ShopifyProductService.ts`.

**Apply to:** Every new service in Phase 4 — SearchService.hybridSearch, getActiveChatModel.

**Concrete excerpts:**

`lib/db/repositories/ProductRepository.ts:167-173`:
```typescript
async findByShopAndId(shop: string, id: number): Promise<Product | null> {
  return prisma.product.findFirst({ where: { shop, id } });
}

async findByShopAndHandle(shop: string, handle: string): Promise<Product | null> {
  return prisma.product.findFirst({ where: { shop, handle } });
}
```

`services/embeddings/EmbeddingService.ts:111-119`:
```typescript
export async function embedAndStore(
  shop: string,
  productId: number,
  text: string
): Promise<void> {
```

Apply to:
```typescript
// services/search/SearchService.ts
export async function hybridSearch(
  shop: string,
  query: string,
  opts: HybridOpts = {},
): Promise<ChatProduct[]> { ... }

// services/chat/getActiveChatModel.ts
export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> { ... }
```

---

### Pattern: AI Gateway routing via plain model string (no provider import)

**Source:** `services/embeddings/EmbeddingService.ts:27,42-46` — the locked Phase 3 D-09 contract.

**Apply to:** `app/api/chat/route.ts` (REPLACE) — the model passed to `streamText({ model })` MUST be a plain string, never a provider helper call.

**Concrete excerpt:**

`services/embeddings/EmbeddingService.ts:42-46`:
```typescript
export async function embed(text: string): Promise<number[]> {
  const { embedding } = await embedSdk({
    model: EMBEDDING_MODEL,  // 'openai/text-embedding-3-small' as const
    value: text,
    maxRetries: 2,
  });
```

Apply to chat route:
```typescript
const model = await getActiveChatModel(shop);
const result = streamText({
  model: model.id,  // 'google/gemini-2.5-flash' — plain string, no `google(...)` wrapper
  // ...
});
```

**The current `app/api/chat/route.ts:8` does this WRONG:**
```typescript
import { google } from "@ai-sdk/google";
// ...
model: google("gemini-2.5-flash"),
```
Phase 4 deletes both. AI Gateway routing is implicit when the string matches `<provider>/<model>` and `AI_GATEWAY_API_KEY` is in env.

---

### Pattern: `withShopifySession` wrapper for authenticated POST routes

**Source:** `lib/shopify/auth.ts:70-84` + `app/api/shopify/sync/route.ts:7`

**Apply to:** `app/api/chat/route.ts` (REPLACE) — must wrap the handler so the LLM closure receives a verified `shop`.

**Concrete excerpt:**

`lib/shopify/auth.ts:70-84`:
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

`app/api/shopify/sync/route.ts:7`:
```typescript
export const POST = withShopifySession(async ({ shop, session }) => {
  void session; // wrapper validated; ...
  // ... shop is closure-captured ...
});
```

Apply to chat route — the tool's `execute` is defined inside this closure so `shop` is captured implicitly.

**Apply NOT to:** `app/api/proxy/chat/route.ts` (Phase 6 will use App Proxy HMAC, not Bearer session token).

---

### Pattern: Shop-scoping via raw SQL with explicit `${shop}` parameter

**Source:** `services/embeddings/EmbeddingService.ts:119` — `INSERT ... (shop, "productShop", ...) VALUES (${shop}, ${shop}, ...)` — defense in depth (both columns get scoped).

**Apply to:** `services/search/SearchService.ts` — D-03 explicitly requires `pe.shop = ${shop} AND p.shop = ${shop}` in both vector and lexical branches.

**Concrete excerpt:**

`services/embeddings/EmbeddingService.ts:119`:
```sql
INSERT INTO product_embeddings (shop, "productShop", "productId", content, embedding, ...)
VALUES (${shop}, ${shop}, ${productId}, ${text}, ${vectorLiteral}::vector, ...)
ON CONFLICT (shop, "productShop", "productId") DO UPDATE SET ...
```

Apply to SearchService (from RESEARCH.md §3):
```sql
WITH vec_ranked AS (
  SELECT p.id, ROW_NUMBER() OVER (ORDER BY pe.embedding <=> ${vectorLiteral}::vector) AS rank
  FROM product_embeddings pe
  INNER JOIN products p ON p.shop = pe."productShop" AND p.id = pe."productId"
  WHERE pe.shop = ${shop}        -- explicit
    AND p.shop = ${shop}          -- explicit (defense-in-depth)
    AND p.status = 'ACTIVE'
  ORDER BY pe.embedding <=> ${vectorLiteral}::vector
  LIMIT ${BRANCH_LIMIT}
),
lex_ranked AS (
  SELECT p.id, ROW_NUMBER() OVER (...) AS rank
  FROM products p
  WHERE p.shop = ${shop}          -- explicit
    AND p.status = 'ACTIVE'
    AND p."searchVector" @@ websearch_to_tsquery('english', ${trimmed})
  ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
  LIMIT ${BRANCH_LIMIT}
)
```

---

### Pattern: `withHnswIterativeScan` callback-form transaction

**Source:** `lib/db/hnsw.ts:20-27` — the mandatory wrapper for any pgvector query.

**Apply to:** `services/search/SearchService.ts` — the entire two-CTE query goes inside one callback. NEVER call `prisma.$queryRaw` for a vector search outside this wrapper.

**Concrete excerpt:**

`lib/db/hnsw.ts:20-27`:
```typescript
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
```

Apply:
```typescript
const rows = await withHnswIterativeScan(async (tx) => {
  return tx.$queryRaw<RankedProductRow[]>`
    WITH vec_ranked AS (...)
    lex_ranked AS (...)
    fused AS (...)
    SELECT ... FROM fused f INNER JOIN products p ON ...
  `;
});
```

**Test mock pattern** (`lib/db/__tests__/hnsw.test.ts:29-33`):
```typescript
transactionMock.mockImplementation(
  async (cb: (tx: { $executeRaw: typeof executeRawMock }) => Promise<unknown>) =>
    cb({ $executeRaw: executeRawMock }),
);
```

For SearchService tests, mock the higher-level wrapper directly instead of recreating the transaction:
```typescript
vi.mock('@/lib/db/hnsw', () => ({
  withHnswIterativeScan: vi.fn(async (cb) => cb({ $queryRaw: queryRawMock })),
}));
```

---

### Pattern: Vitest `vi.hoisted` + mock factory for service tests

**Source:** `services/embeddings/__tests__/EmbeddingService.test.ts:16-31`, `services/shopify/__tests__/ShopifyProductService.test.ts:10-22`, `app/api/shopify/sync/__tests__/route.test.ts:3-44`, `lib/db/__tests__/hnsw.test.ts:11-21`.

**Apply to:** Every new test file in Phase 4 — SearchService.test.ts, route.test.ts (chat + proxy).

**Concrete excerpt** (most representative — `services/embeddings/__tests__/EmbeddingService.test.ts:16-31`):
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
  prisma: {
    $executeRaw: executeRawMock,
  },
}));
```

**`beforeEach` reset pattern** (consistently used):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

### Pattern: Error handling — no token/secret leakage to logs

**Source:** CLAUDE.md "Security: No secrets, no session tokens, no auth headers in logs"; `services/embeddings/EmbeddingService.ts:14-17` (T-3-02 doc block) + line 88 (extracts `err.message` only).

**Apply to:** `services/search/SearchService.ts` (error path inside tool execute), `app/api/chat/route.ts` (no console.log of headers or messages).

**Concrete excerpt:**

`services/embeddings/EmbeddingService.ts:86-93`:
```typescript
} catch (err) {
  // T-3-02: persist err.message string only, never the full err object.
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: [],
    failed: texts.map((_, index) => ({ index, message })),
  };
}
```

Apply to SearchService (per CONTEXT.md Claude's Discretion):
```typescript
try {
  const rows = await withHnswIterativeScan(async (tx) => { ... });
  return rows.map(toChatProduct);
} catch (err) {
  // CLAUDE.md "no secrets in logs": log only err.message, never err.config/headers
  const message = err instanceof Error ? err.message : String(err);
  console.error('[SearchService] hybridSearch failed:', message);
  return [];  // tool returns empty Product[]; LLM responds with "couldn't find" text
}
```

**Test for this** (modeled after `services/embeddings/__tests__/EmbeddingService.test.ts:104-128`):
```typescript
it('hybridSearch returns [] when $queryRaw throws (no secret leak)', async () => {
  embedMock.mockResolvedValueOnce(new Array(1536).fill(0));
  queryRawMock.mockRejectedValueOnce(new Error('connection refused'));

  const result = await hybridSearch('shop.myshopify.com', 'shoes');
  expect(result).toEqual([]);
  // optionally assert console.error was called with err.message only
});
```

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md + UI-SPEC.md patterns directly):

| File / Component | Role | Data Flow | Reason |
|------------------|------|-----------|--------|
| Preview banner JSX (inline in `page.tsx`) | server-rendered UI block | request-response | No precedent for a muted-banner mode indicator anywhere in `components/` or `app/`. The existing header in `page.tsx` (lines 39-49) is a navigation header, not a status banner. Implement directly from UI-SPEC.md §"Copywriting Contract" + §"Color" + §"Spacing Scale". |
| `ChatShell` client component (extracted from current `page.tsx`) | wrapper around Tabs + state | event-driven | This is a refactor-extract: take the body of the current `app/(embedded)/chat/page.tsx` and move it into a new `components/chat/chat-shell.tsx` (or similar). No new pattern needed — the existing client code at lines 13-110 IS the pattern; it just moves to a different file. |

---

## Metadata

**Analog search scope:**
- `services/embeddings/` (EmbeddingService.ts + test) — primary analog for SearchService
- `services/search/` (searchableText.ts + test) — secondary analog for stub services
- `services/shopify/` (ShopifyProductService.ts + test) — vi.hoisted + factory mock precedent
- `lib/db/` (client.ts, hnsw.ts + test, repositories/ProductRepository.ts + test) — shop-scoping + raw-SQL precedents
- `lib/shopify/` (auth.ts + test) — withShopifySession wrapper precedent
- `app/api/chat/` (current route.ts) — code to be REPLACED, not copied
- `app/api/shopify/sync/` (route.ts + test) — primary analog for new route shape
- `app/api/shopify/webhook/` (route.ts + test) — secondary route analog with raw-body + service-call shape
- `app/(embedded)/` (layout.tsx, chat/page.tsx, chat/page.integration-test.tsx) — server/client split precedent
- `components/chat/` (chat.tsx, message-parts.tsx, chat-message.tsx, product-card.tsx + tests) — UI surface to refactor

**Files scanned:** 28
**Strong analogs identified:** 14
**Pattern extraction date:** 2026-05-25

**Cross-references for planner:**
- CONTEXT.md D-XX decisions cited inline in each analog block
- UI-SPEC.md is the authority for visual contract (banner text, motion budget, ARIA, color tokens)
- RESEARCH.md §"Concrete Syntax" provides the exact SQL CTE shape and `inputSchema` (not `parameters`) field rename note
- `lib/db/__tests__/hnsw.test.ts` is the canonical pattern for mocking `withHnswIterativeScan` in service tests
- All shop-scoping tests follow the cross-shop isolation pattern from `lib/db/repositories/__tests__/ProductRepository.test.ts:72-88`
