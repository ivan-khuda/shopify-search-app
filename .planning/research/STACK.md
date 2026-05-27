# Technology Stack — New Capabilities (V1 Delta)

**Project:** SmartDiscovery AI
**Researched:** 2026-05-22
**Scope:** NEW dependencies only. Existing stack (Next.js 16, bun, Prisma 7, PostgreSQL, `ai` 6, `@ai-sdk/google`, `@shopify/shopify-api` 12, shadcn/ui primitives, Tailwind 4) is locked and NOT repeated here.

---

## 1. Theme App Extension (TAE)

### Toolchain

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| Shopify CLI | 3.x (bundled — no direct dep) | Scaffold TAE, dev preview, deploy | Required by Shopify for any extension work; `shopify app generate extension` is the only supported generator |

**No npm dependency to add.** Shopify CLI ships as a standalone binary managed via the `shopify` command (already assumed present for Shopify development). The extension itself lives in `extensions/chat-drawer/` within the repo and is deployed via `shopify app deploy`.

### File Structure (High Confidence — official docs + verified sample)

```
extensions/
  chat-drawer/
    assets/
      chat-drawer.js        # bundled JS (vanilla or self-contained bundle)
      chat-drawer.css       # optional scoped styles
    blocks/
      app-embed.liquid      # App Embed block — injects FAB + drawer mount
    snippets/               # (optional) reusable Liquid helpers
    locales/                # (optional) i18n JSON
    shopify.extension.toml  # extension name + type = "theme"
```

### App Embed Block Schema (Confirmed via official sample repo)

```liquid
{% schema %}
{
  "name": "SmartDiscovery Chat",
  "target": "body",
  "javascript": "chat-drawer.js",
  "stylesheet": "chat-drawer.css",
  "settings": [
    {
      "type": "color",
      "id": "accent_color",
      "label": "Accent color",
      "default": "#000000"
    }
  ]
}
{% endschema %}
```

- `"target": "body"` renders the block just before `</body>` — correct for FAB injection
- `"javascript": "chat-drawer.js"` is auto-loaded from `assets/` by Shopify's CDN; deduplicated if multiple instances
- Shopify CDN-serves every file in `assets/` — no webpack/bundler config needed for simple scripts; for a React subtree you bundle to a single file via `esbuild` or Vite as a pre-step

### shopify.extension.toml (Confirmed format)

```toml
api_version = "2026-04"

[[extensions]]
type = "theme"
name = "chat-drawer"
handle = "chat-drawer"
```

### App Proxy Configuration (in root `shopify.app.toml`)

```toml
[app_proxy]
url = "/api/storefront"          # Next.js route that handles proxied requests
prefix = "apps"
subpath = "smartdiscovery"       # storefront URL: /apps/smartdiscovery
```

Add `write_app_proxy` to OAuth scopes.

**Storefront URL pattern:** `https://<shop>.myshopify.com/apps/smartdiscovery/*`
Shopify forwards to: `https://<your-app-host>/api/storefront/*` with added query params: `shop`, `logged_in_customer_id`, `path_prefix`, `timestamp`, `signature`.

**No new npm package for TAE.** Pure Liquid + vanilla JS (or a self-contained bundle compiled offline).

**Confidence: HIGH** — official docs + verified from Shopify's own sample (blocks/app-embed.liquid pattern confirmed).

---

## 2. Vercel AI Gateway

### SDK Package

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@ai-sdk/gateway` | 3.0.119 (latest) | Explicit gateway provider instance | Needed to call `gateway.getAvailableModels()` for the settings screen; plain string model refs in `ai` package already use gateway implicitly |

The `ai` package (already at 6.0.190 in lockfile) includes `gateway` re-export. You only need `@ai-sdk/gateway` explicitly if you want `createGateway()` for custom API key or to call `getAvailableModels()`.

**Replace `@ai-sdk/google` 3.0.21** with AI Gateway provider. Direct Google SDK stays in dev/test only or is removed entirely — PROJECT.md mandates "Vercel AI Gateway is the sole runtime entry point."

### Install

```bash
bun add @ai-sdk/gateway
```

Remove from runtime: `@ai-sdk/google` (keep as devDependency only if used in tests, else remove).

### Usage Patterns

**Streaming chat (replaces current `@ai-sdk/google` usage in `app/api/chat/route.ts`):**
```typescript
import { streamText } from 'ai';

// No provider import needed — plain string uses AI Gateway by default
const result = streamText({
  model: 'google/gemini-2.5-flash',
  messages,
});
return result.toUIMessageStreamResponse();
```

**Embeddings (batch, for productSync):**
```typescript
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: 'openai/text-embedding-3-small',
  values: productTexts,              // string[]
  maxParallelCalls: 5,               // avoid rate limits during sync
});
```

**Dynamic model catalog (Settings screen):**
```typescript
import { gateway } from '@ai-sdk/gateway';

const { models } = await gateway.getAvailableModels();
const chatModels = models.filter(m => m.modelType === 'language');
const embeddingModels = models.filter(m => m.modelType === 'embedding');

// Each model has: id, name, description, pricing.input, pricing.output, context_window
```

**REST alternative (no SDK, for lightweight server-side fetch):**
```typescript
const res = await fetch('https://ai-gateway.vercel.sh/v1/models');
const { data: models } = await res.json();
// models[].type: 'language' | 'embedding' | 'reranking' | 'image' | 'video'
// models[].context_window, models[].pricing.input, models[].pricing.output
```

### Recommended Embedding Model

`openai/text-embedding-3-small` — 1,536 dimensions, $0.02/M tokens, drop-in match for existing Prisma schema's `vector` type. Store as `vector(1536)` in migration.

Fallback: `google/gemini-embedding-2` — 3,072 dims (or 1,536 with MRL), $0.20/M, multimodal capable (overkill for V1 text-only). Do not use for V1 — costs 10x more per token.

**AI_GATEWAY_API_KEY** env var — required on Vercel (auto-injected when AI Gateway is enabled in Vercel project settings).

**Confidence: HIGH** — official Vercel AI Gateway docs verified via WebFetch + Context7.

---

## 3. pgvector Hybrid Search

### Extension & Index

pgvector is already in the schema (`Unsupported("vector")`). The migration raw SQL just needs to be written.

**Recommended embedding dimensions: 1,536** (matches `text-embedding-3-small`).

**Migration SQL (create as a Prisma raw migration file):**

```sql
-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;      -- for robust full-text normalization

-- Add tsvector column for full-text search (if not already on Product table)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(tags, '') || ' ' ||
      coalesce(vendor, '') || ' ' ||
      coalesce(product_type, '')
    )
  ) STORED;

-- GIN index on tsvector
CREATE INDEX IF NOT EXISTS product_search_vector_gin
  ON "Product" USING gin(search_vector);

-- HNSW cosine index on embeddings (vector must be populated first, but index can be created empty)
-- Dimensions must match embedding model output (1536 for text-embedding-3-small)
ALTER TABLE "ProductEmbedding"
  ALTER COLUMN embedding TYPE vector(1536);

CREATE INDEX IF NOT EXISTS product_embedding_hnsw_cosine
  ON "ProductEmbedding" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**HNSW parameters:**
- `m = 16` — graph connectivity (higher = better recall, more memory; 16 is standard default)
- `ef_construction = 64` — build-time search width (higher = better recall at index build cost)
- At query time, set `SET hnsw.ef_search = 40;` for better recall (default 10 is too low)

### Hybrid Search Query (RRF)

```sql
-- $1: query embedding (vector(1536))
-- $2: full-text query string
-- $3: shop_id for multi-tenant scoping
-- $4: k (number of results)

WITH vector_ranked AS (
  SELECT
    pe.product_id,
    ROW_NUMBER() OVER (ORDER BY pe.embedding <=> $1) AS rank
  FROM "ProductEmbedding" pe
  JOIN "Product" p ON p.id = pe.product_id
  WHERE p.shop_id = $3
    AND 1 - (pe.embedding <=> $1) > 0.3   -- cosine similarity threshold
  LIMIT 50
),
text_ranked AS (
  SELECT
    p.id AS product_id,
    ROW_NUMBER() OVER (
      ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', $2)) DESC
    ) AS rank
  FROM "Product" p
  WHERE p.shop_id = $3
    AND p.search_vector @@ websearch_to_tsquery('english', $2)
  LIMIT 50
),
fused AS (
  SELECT product_id, SUM(1.0 / (60 + rank)) AS rrf_score
  FROM (
    SELECT product_id, rank FROM vector_ranked
    UNION ALL
    SELECT product_id, rank FROM text_ranked
  ) combined
  GROUP BY product_id
)
SELECT
  p.id, p.title, p.handle, p.price_min, p.vendor, p.product_type,
  f.rrf_score
FROM fused f
JOIN "Product" p ON p.id = f.product_id
ORDER BY f.rrf_score DESC
LIMIT $4;
```

Use `websearch_to_tsquery` (not `plainto_tsquery`) — handles quoted phrases, AND/OR operators, and negation from natural language queries.

RRF constant `K = 60` is the standard value from the original Cormack & Clarke paper; produces robust fusion without tuning.

**No new npm package.** Raw SQL executed via `prisma.$queryRaw` or `prisma.$executeRaw`.

**Confidence: HIGH** — SQL syntax verified against official pgvector docs and multiple 2026 production guides.

---

## 4. Background Sync Infrastructure

### Primary Recommendation: Inngest

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `inngest` | 4.4.0 (latest) | Durable step-function background jobs | Step memoization survives Vercel's 60s function timeout; idempotent retries out of the box; first-class Vercel marketplace integration; local dev server (`npx inngest-cli@latest dev`) works with Next.js dev server |

**Why Inngest over alternatives:**

- **vs Vercel Queues (if GA):** As of research date, Vercel Queues has not shipped GA — Inngest is the Vercel-endorsed partner in the marketplace. Avoid depending on unreleased infrastructure.
- **vs QStash (Upstash):** QStash is a simple HTTP delivery queue. It cannot resume a failed step without re-running the whole job from scratch. For a 5k-product sync in batches of 50, step memoization is essential — if batch 40 fails, Inngest retries only batch 40.
- **vs Trigger.dev:** Valid alternative with similar step semantics. Inngest has more active Vercel marketplace presence and a larger community in the Next.js ecosystem.
- **vs DB-backed cron worker:** Would require a separate polling loop, a `SyncRun` table, and manual retry logic. Inngest gives all that for free.

**Backup recommendation: QStash** — if Inngest pricing becomes a concern. Add a `SyncRun` DB table with `status`, `cursor`, `errors[]` columns and use QStash to deliver a "continue sync from cursor" message on each batch completion. More plumbing but zero new infrastructure.

### Install

```bash
bun add inngest
```

### Next.js App Router Setup

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'smartdiscovery-ai' });

// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { syncProductsFunction } from '@/lib/inngest/functions/sync-products';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction],
});

// lib/inngest/functions/sync-products.ts
export const syncProductsFunction = inngest.createFunction(
  { id: 'sync-products', retries: 3 },
  { event: 'shop/sync.requested' },
  async ({ event, step }) => {
    const { shopId } = event.data;

    const productCount = await step.run('fetch-product-count', async () => {
      // ... get total from Shopify
    });

    const BATCH_SIZE = 50;
    const batches = Math.ceil(productCount / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      await step.run(`sync-batch-${i}`, async () => {
        // fetch page i*BATCH_SIZE, upsert to DB, generate embeddings
      });
    }

    await step.run('send-completion-email', async () => {
      // send via Resend
    });
  }
);
```

Trigger from onboarding route:
```typescript
await inngest.send({ name: 'shop/sync.requested', data: { shopId } });
```

### SyncRun DB Model

Add to Prisma schema for polling/SSE status endpoint (separate from Inngest's own run tracking):

```prisma
model SyncRun {
  id             String   @id @default(cuid())
  shopId         String
  status         String   @default("pending") // pending | running | done | error
  totalCount     Int      @default(0)
  processedCount Int      @default(0)
  errors         Json     @default("[]")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

**Confidence: HIGH** — Inngest version verified via npm registry; Next.js App Router setup confirmed via official Inngest quick start docs.

---

## 5. Resend + React Email

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `resend` | 6.12.3 (latest) | Transactional email delivery | Same team as React Email; best DX for Next.js; generous free tier (3,000/month); official Next.js route handler example |
| `@react-email/components` | 1.0.12 (latest) | Email template primitives (Html, Head, Body, Section, Text, Button, etc.) | Composable; renders cross-client compatible HTML |
| `react-email` | 6.3.0 | Dev preview server (`email dev`) + CLI | Optional dev dependency — run `npx react-email dev` to preview templates locally |

### Install

```bash
bun add resend @react-email/components
bun add -d react-email
```

### Env Var

```
RESEND_API_KEY=re_...
```

### Usage Pattern

```typescript
// lib/email/send-sync-complete.ts
import { Resend } from 'resend';
import { SyncCompleteEmail } from '@/emails/sync-complete';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSyncCompleteEmail(opts: {
  to: string;
  shopName: string;
  productCount: number;
  errorCount: number;
}) {
  return resend.emails.send({
    from: 'SmartDiscovery <noreply@yourdomain.com>',
    to: opts.to,
    subject: `Your catalog is ready — ${opts.productCount} products synced`,
    react: SyncCompleteEmail(opts),
  });
}
```

```tsx
// emails/sync-complete.tsx
import { Html, Body, Section, Text, Button } from '@react-email/components';

export function SyncCompleteEmail({ shopName, productCount, errorCount }) {
  return (
    <Html>
      <Body>
        <Section>
          <Text>Your SmartDiscovery catalog sync for {shopName} is complete.</Text>
          <Text>{productCount} products indexed. {errorCount} errors.</Text>
          <Button href="https://admin.shopify.com">Open admin</Button>
        </Section>
      </Body>
    </Html>
  );
}
```

Shop owner email: fetch from Shopify Shop GraphQL query (`{ shop { email } }`) during sync setup.

**Confidence: HIGH** — versions verified via npm registry; React Email 6.0 released April 2026; Resend API stable.

---

## 6. Shopify Auth: Session Token vs App Proxy

No new packages needed. Both patterns are covered by the existing `@shopify/shopify-api` 12.x (latest: 13.0.0 — check upgrade path before using).

### Current version note

The lockfile has `@shopify/shopify-api` 12.3.0. npm registry latest is **13.0.0** — this is a major bump. Do not upgrade without reading the changelog first. The patterns documented below apply to 12.x (current).

### Session Token Bearer Auth (embedded admin API routes — already implemented)

Used on all `/api/shopify/*` routes called from the embedded admin iframe.

```typescript
// Existing pattern (app/api/shopify/sync/route.ts) — keep and extend
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');
const payload = await shopifyClient.session.decodeSessionToken(token);
// payload.dest = "https://<shop>.myshopify.com"
const shop = new URL(payload.dest).hostname;
const session = await shopifyClient.session.loadOfflineSession(shop);
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### App Proxy HMAC Verification (storefront routes)

Used on all `/api/storefront/*` routes forwarded by App Proxy. Uses `signature` param (not `hmac`).

```typescript
// app/api/storefront/[...path]/route.ts
import { shopifyClient } from '@/lib/shopify/client';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams);

  const isValid = await shopifyClient.utils.validateHmac(query, {
    signator: 'appProxy',
  });
  if (!isValid) return new Response('Unauthorized', { status: 401 });

  const shop = query.shop as string;
  const customerId = query.logged_in_customer_id ?? null; // null = anonymous
  // ... handle storefront request
}
```

**Key differences from webhook HMAC:**
- Query parameter name is `signature` (not `hmac` and not `X-Shopify-Hmac-SHA256` header)
- Sorted params are concatenated with NO separator (not `&`)
- Use `{ signator: 'appProxy' }` option to switch the library's verification mode

**Verification algorithm (for manual fallback if library has issues):**
1. Remove `signature` from query params
2. Sort remaining params alphabetically: `key=value` (multi-value: `key=v1,v2`)
3. Join all pairs with no delimiter: `"extra=1,2path_prefix=/apps/smartdiscoveryshop=..."  `
4. HMAC-SHA256 with `SHOPIFY_API_SECRET` as key
5. `crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))`

### Visitor Identity (storefront, no new package)

```typescript
// Signed cookie for anonymous visitors
// nanoid already in lockfile — use for visitor_id generation
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

function signVisitorId(id: string): string {
  const sig = createHmac('sha256', process.env.COOKIE_SECRET!).update(id).digest('hex');
  return `${id}.${sig}`;
}

function verifyVisitorId(signed: string): string | null {
  const [id, sig] = signed.split('.');
  const expected = createHmac('sha256', process.env.COOKIE_SECRET!).update(id).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}
```

**Confidence: HIGH** — `validateHmac` with `signator: 'appProxy'` confirmed in official `@shopify/shopify-app-js` docs via Context7.

---

## Summary: New Dependencies to Add

```bash
# Runtime
bun add @ai-sdk/gateway inngest resend @react-email/components

# Dev only
bun add -d react-email
```

Remove from runtime (or keep as devDep only): `@ai-sdk/google`

### No-install items

| Capability | Approach |
|-----------|----------|
| Theme App Extension | CLI scaffold (no npm dep); vanilla JS or offline esbuild bundle |
| pgvector hybrid search | Raw SQL in Prisma migrations + `prisma.$queryRaw` |
| App Proxy HMAC | `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` — existing dep |
| Visitor signed cookie | Node.js `crypto` built-in + `nanoid` (already in lockfile) |

---

## Alternatives Rejected

| Category | Rejected | Reason |
|----------|----------|--------|
| AI provider | Direct `@ai-sdk/google` in production | PROJECT.md: Vercel AI Gateway is sole runtime entry point |
| Embedding model | `google/gemini-embedding-2` | 10x cost vs text-embedding-3-small; multimodal not needed in V1 |
| Background jobs | Vercel Queues | Not GA as of research date |
| Background jobs | QStash | No step memoization — batch resume requires manual cursor logic |
| Background jobs | Plain DB-backed cron | Manual retry/status plumbing — Inngest provides all this for free |
| Email | Nodemailer / SendGrid | No React template support; worse DX; Resend has same-team integration with React Email |
| Full-text | `pg_trgm` trigram | Better for fuzzy typo matching; tsvector wins for natural-language queries (phrase-aware, language-stemmed) — can add `pg_trgm` as optional V2 layer |

---

## Env Vars to Add

| Variable | Purpose |
|----------|---------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (auto-injected in Vercel projects with AI Gateway enabled) |
| `RESEND_API_KEY` | Transactional email |
| `INNGEST_EVENT_KEY` | Inngest event signing key |
| `INNGEST_SIGNING_KEY` | Inngest request signing (Vercel integration auto-sets this) |
| `COOKIE_SECRET` | HMAC key for signing visitor_id cookies (32+ random bytes) |

---

## Sources

- Vercel AI Gateway models & providers: https://vercel.com/docs/ai-gateway/models-and-providers (last updated 2026-03-24)
- AI Gateway dynamic model discovery: https://vercel.com/docs/ai-gateway/models-and-providers#dynamic-model-discovery
- Vercel AI SDK embedMany: Context7 `/vercel/ai` — ai_6.0.0 docs
- text-embedding-3-small on AI Gateway: https://vercel.com/ai-gateway/models/text-embedding-3-small
- Gemini Embedding 2 on AI Gateway: https://vercel.com/ai-gateway/models/gemini-embedding-2
- Shopify TAE configuration: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
- Shopify TAE App Embed block sample: https://github.com/Shopify/theme-extension-getting-started (blocks/ directory)
- App Proxy authentication: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
- validateHmac with appProxy signator: Context7 `/shopify/shopify-app-js`
- pgvector HNSW hybrid search RRF: https://micelclaw.com/blog/hybrid-search-rrf/
- pgvector HNSW index: https://neon.com/blog/understanding-vector-search-and-hnsw-index-with-pgvector
- Inngest Next.js quick start: https://www.inngest.com/docs/getting-started/nextjs-quick-start
- Inngest idempotency guide: https://www.inngest.com/docs/guides/handling-idempotency
- Inngest npm version 4.4.0: https://www.npmjs.com/package/inngest
- Resend npm version 6.12.3: https://www.npmjs.com/package/resend
- React Email 6.0: https://resend.com/blog/react-email-6
- @react-email/components 1.0.12: https://www.npmjs.com/package/@react-email/components
- @ai-sdk/gateway 3.0.119: npm registry verified

---

*Stack research: 2026-05-22*
