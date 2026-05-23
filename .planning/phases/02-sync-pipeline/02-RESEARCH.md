# Phase 2: Sync Pipeline - Research

**Researched:** 2026-05-23
**Domain:** Inngest durable step functions, Shopify Admin GraphQL cursor pagination, webhook HMAC verification, Prisma additive migrations, Polaris web component progress UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single Inngest function (`shopify/product.sync` event); loops over cursor pagination; three `step.run` per batch with deterministic IDs `fetch-batch-${cursor || 'start'}`, `upsert-batch-${cursor || 'start'}`, `persist-cursor-${cursor || 'start'}`. Memoization survives Vercel timeouts.
- **D-02:** Batch size = 100 products per fetch/upsert.
- **D-03:** `SyncRun` Prisma model with `SyncState` enum (queued | running | succeeded | failed | partial). State transitions: queued→running when function begins, running→succeeded if zero errors, running→partial if some errors, running→failed if function exhausts retries.
- **D-04:** `totalCount` via single `products.totalCount` GraphQL call at function start; nullable in DB.
- **D-05:** Idempotency key = `sha256("${shop}|${Math.floor(Date.now() / 300_000)}")`. If active run exists return existing syncRunId; if terminal state return existing id too.
- **D-06:** Webhook handler is inline (no Inngest indirection): HMAC verify → dedup → `productRepository.upsertProduct` or `deleteProduct`.
- **D-07:** Dedup via `WebhookEvent { eventId String @id, shop String, topic String, receivedAt DateTime }`. Insert-and-catch-P2002.
- **D-08:** Conflict resolution by `product.updatedAt` — skip upsert if incoming is older than stored.
- **D-09:** `withShopifySession` on both sync POST and status GET.
- **D-10:** Webhook uses `shopifyClient.webhooks.validate({ rawBody, request })` (NOT `utils.validateHmac` — that is query-param HMAC only); shop from `X-Shopify-Shop-Domain` header.
- **D-11:** `lib/inngest/client.ts` exports `inngest`; function at `inngest/functions/sync-products.ts`; API at `app/api/inngest/route.ts`.
- **D-12:** Dev: `INNGEST_DEV=1` in `.env`, run `bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest`. Prod: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` via Vercel ↔ Inngest marketplace.
- **D-13:** `<s-progress-bar value={percent}>` + counter text + state badge; 2s polling constant.
- **D-14:** Completion: `<s-banner tone="success">` + "Open admin chat" CTA. Partial/failed: error count + Retry CTA.
- **D-15:** Per-product try/catch inside `upsert-batch` step; batch-level throw only if full batch fails; errors concat to `SyncRun.errors[]`.
- **D-16:** Webhook subscriptions declared in `shopify.app.toml`; registered by `bunx shopify app deploy`.

### Claude's Discretion

- Inngest function name (recommended: `shopify/product.sync` event, id `sync-products`)
- Whether to add `RetryConfig` to function (default 4 retries is fine for V1)
- Test mocking strategy: prefer `@inngest/test` (confirmed exists at 1.0.0)
- `SyncRun.errors[]` as `String[]` or `Json[]` — implementer chooses
- Whether webhook handler writes a `SyncRun` entry — V1 says no

### Deferred Ideas (OUT OF SCOPE)

- Bulk Operations API for initial sync
- Resend completion email (Phase 8)
- Sync history view in admin
- WebhookEvent table cleanup cron
- Adaptive client-side polling (exponential backoff)
- Fast-path `verifyToken` without DB hit
- SSE for real-time progress
- Per-product retry via `step.run` per product
- Webhook → Inngest indirection
- Webhook-triggered SyncRun audit row
- GraphQL query cost monitoring in SyncRun.errors

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYN-01 | `ShopifyProductService.fetchAllProducts` calls Shopify GraphQL with cursor pagination, returns title, description, tags, vendor, productType, status, images, variant prices | Q2: exact GraphQL query shape confirmed; `products(first:100, after:$cursor)` with nodes syntax; `productsCount` for total |
| SYN-02 | `mapToLocalProduct` deterministically maps Shopify → local Product + variants + images + options | Q2: field mapping confirmed; variant.price is `String` in REST payload but GraphQL returns string. `selectedOptions` on variant (not option1/2/3). For REST webhook payload: `options: [{name, values}]` on product root |
| SYN-03 | `productSync.ts` orchestrates idempotent batched upsert; one failure does not abort | D-15: per-product try/catch; batch-level throw only on 100% batch failure |
| SYN-04 | New `SyncRun` Prisma model with id, shop, state, processedCount, totalCount, errors, cursor, startedAt, finishedAt | D-03: exact schema with SyncState enum provided; confirmed Prisma 7.3 generates additive CREATE TABLE |
| SYN-05 | POST `/api/shopify/sync` creates SyncRun, enqueues Inngest, returns `{ syncRunId }`; never >serverless timeout | Q1: `inngest.send({name, data})` is synchronous dispatch; Inngest API call completes in ~100ms |
| SYN-06 | Inngest step-function processes in batches, persists cursor after each batch | D-01: three `step.run` per batch; cursor persisted in `persist-cursor-${cursor}` step |
| SYN-07 | GET `/api/shopify/sync/status?syncRunId=X` returns current SyncRun for requesting shop | Q10: exact response shape documented |
| SYN-08 | Duplicate sync requests de-duplicated via idempotency key `sha256(shop + 5-min-bucket)` | D-05: find-first-or-create pattern documented |
| SYN-09 | Onboarding page polls `/status` every 2s, renders progress bar + state labels | D-13: `<s-progress-bar value>` API; 5-state machine documented |
| SYN-10 | `/api/shopify/webhook` verifies HMAC, processes create/update/delete idempotently by X-Shopify-Event-Id | Q4: `shopifyClient.webhooks.validate({rawBody, request})` returns `{valid, topic, domain, webhookId}`; correct approach confirmed |
| SYN-11 | Webhook upserts use `product.updatedAt` for conflict resolution against concurrent sync | D-08; existing `ProductRepository.upsertProduct` needs conditional updatedAt guard added |
| ADM-01 | "Start sync" button posts to `/api/shopify/sync` and transitions to progress view on response | Onboarding page already has working fetch call; needs syncRunId state added |
| ADM-02 | Onboarding shows real-time progress bar driven by `/status` polling | D-13/D-14: full state machine + Polaris component API documented |

</phase_requirements>

---

## Summary

Phase 2 wires the stub sync pipeline into a durable Inngest step-function, adds three new Prisma models (`SyncRun`, `WebhookEvent`, `SyncState` enum), implements the full Shopify webhook handler with HMAC verification and dedup, and upgrades the onboarding UI from a fire-and-forget button to a live progress view. All 13 requirements (SYN-01..11 + ADM-01/02) are achievable without dependency blockers — `inngest` 4.4.0 is available, the GraphQL client pattern is confirmed in the installed `@shopify/shopify-api` 12.3.0, and Prisma 7.3 (installed) handles the additive `CREATE TABLE` migration cleanly.

The two highest-risk implementation areas are: (1) the HMAC verification path for webhooks — `shopifyClient.utils.validateHmac` is for query-param HMAC (OAuth/App Proxy) NOT webhooks; webhook verification must use `shopifyClient.webhooks.validate({ rawBody, request })` — using the wrong method will silently pass or fail in unexpected ways; and (2) the `step.run` deterministic ID contract — any change to the string used as a step ID invalidates Inngest's memoization and will cause replayed steps.

**Primary recommendation:** Install `inngest` 4.4.0 and `@inngest/test` 1.0.0, implement the three-step batch loop per D-01, use `shopifyClient.webhooks.validate` (not `utils.validateHmac`) for webhook HMAC, and add `updatedAtShopify` to `ProductUpsertInput` so the conditional-upsert guard in SYN-11 has a column to compare against.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sync trigger (POST /api/shopify/sync) | API / Backend | — | Session-token auth; creates DB row; enqueues Inngest event |
| Background product fetching & upsert | Inngest worker (detached) | API / Backend | Outlives HTTP timeout; step memoization is the core feature |
| Sync status polling (GET /status) | API / Backend | — | DB read scoped to session's shop; no client-side processing |
| Onboarding progress UI | Browser / Client | — | `useEffect` polling; state machine rendering; Polaris web components |
| Webhook HMAC verification + dedup | API / Backend | — | Raw body must be read before JSON.parse; no client involvement |
| Product upsert (from webhook) | API / Backend → Data layer | — | Direct repository call; no Inngest indirection in V1 |
| Idempotency key generation | API / Backend | — | sha256 computed at request time server-side; not client-supplied |

---

## Standard Stack

### Core (Phase 2 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `inngest` | 4.4.0 | Durable step-function background jobs | Memoized step state survives Vercel 60s timeout; locked D-01..D-12 |
| `@inngest/test` | 1.0.0 | Unit testing Inngest functions | Official Inngest test harness; `InngestTestEngine` executes steps inline |

[VERIFIED: npm registry — `inngest` at 4.4.0 (created 2022-04-28, last modified 2026-05-19), repository: github.com/inngest/inngest-js. `@inngest/test` at 1.0.0, same monorepo.]

No other new runtime dependencies. All other functionality uses packages already in `package.json`: `@shopify/shopify-api` 12.3.0 (webhook validation), Prisma 7.3.0 (new models), `nanoid`/Node.js `crypto` (idempotency key hashing).

### Installation

```bash
bun add inngest
bun add -d @inngest/test
```

### Env Vars to Add

```
INNGEST_EVENT_KEY=          # prod only — from Vercel ↔ Inngest marketplace integration
INNGEST_SIGNING_KEY=        # prod only — from Vercel ↔ Inngest marketplace integration
INNGEST_DEV=1               # local .env only — routes events to local dev server
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. Manual verification performed.

| Package | Registry | Age | Source Repo | Verification | Disposition |
|---------|----------|-----|-------------|--------------|-------------|
| `inngest` | npm | ~3 yrs (Apr 2022) | github.com/inngest/inngest-js | Official Inngest SDK; homepage inngest.com; last modified 2026-05-19 | Approved [VERIFIED: npm registry] |
| `@inngest/test` | npm | Known version (1.0.0) | Same monorepo as `inngest`; maintained by inngest-release-bot | Same org as `inngest`; no postinstall scripts | Approved [VERIFIED: npm registry] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck not installed; manual provenance check performed instead. Both packages are from the official Inngest organisation.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Onboarding page)
  │  POST /api/shopify/sync  (Bearer token)
  │  GET  /api/shopify/sync/status?syncRunId=X  (Bearer, every 2s)
  ▼
app/api/shopify/sync/route.ts         app/api/shopify/sync/status/route.ts
  withShopifySession wrapper             withShopifySession wrapper
  1. sha256 idempotency key              1. Parse syncRunId query param
  2. findFirst or createSyncRun          2. Load SyncRun by id WHERE shop matches
  3. inngest.send({name, data})          3. Return {state, processedCount, …}
  4. return { syncRunId }
              │
              │ event: shopify/product.sync
              ▼
app/api/inngest/route.ts  (GET/POST/PUT serve handler)
  Inngest Dev Server (local) or Inngest Cloud (prod)
              │
              ▼
inngest/functions/sync-products.ts
  step.run('fetch-total-count')  ← productsCount GraphQL query
  loop cursor pagination:
    step.run('fetch-batch-${cursor}')   ← products(first:100, after:cursor)
    step.run('upsert-batch-${cursor}')  ← productRepository.upsertProduct × 100
      per-product try/catch; batchErrors[]
    step.run('persist-cursor-${cursor}') ← prisma.syncRun.update({cursor, processedCount, errors})
  prisma.syncRun.update({state: succeeded|partial|failed, finishedAt})

Shopify webhooks
  │  POST /api/shopify/webhook  (no session token; HMAC header)
  ▼
app/api/shopify/webhook/route.ts
  1. rawBody = await req.text()          ← MUST be before JSON.parse
  2. shopifyClient.webhooks.validate({rawBody, request})
     → {valid, topic, domain, webhookId}
  3. eventId = req.headers.get('x-shopify-event-id')
  4. prisma.webhookEvent.create({eventId, shop, topic})  ← catch P2002 → 200 dedup
  5. JSON.parse(rawBody)
  6. compare payload.updated_at vs DB product.updatedAtShopify
  7. productRepository.upsertProduct / deleteProduct
  8. return 200
```

### Recommended Project Structure (Phase 2 additions)

```
app/api/
├── inngest/
│   └── route.ts                   # NEW: Inngest serve handler (GET/POST/PUT)
├── shopify/
│   ├── sync/
│   │   ├── route.ts               # REWRITE: was stub → now creates SyncRun + enqueues
│   │   └── status/
│   │       └── route.ts           # NEW: GET polling endpoint
│   └── webhook/
│       └── route.ts               # REWRITE: was stub → full HMAC+dedup+upsert
inngest/
└── functions/
    └── sync-products.ts           # NEW: Inngest step-function
lib/
└── inngest/
    └── client.ts                  # NEW: inngest singleton
services/
└── shopify/
    └── ShopifyProductService.ts   # REWRITE: stub → real GraphQL pagination + totalCount
prisma/
└── schema.prisma                  # ADD: SyncState enum, SyncRun, WebhookEvent models
app/(embedded)/
└── onboarding/
    └── page.tsx                   # EXTEND: add syncRunId state, polling effect, progress view
```

---

## Q1: Inngest 4.4 API Specifics

[VERIFIED: npm registry + official Inngest docs fetched 2026-05-23]

### Client creation

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'smartdiscovery-ai' });
```

### serve() handler — `inngest/next` import path

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { syncProductsFunction } from '@/inngest/functions/sync-products';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction],
});
```

### createFunction signature

```typescript
export const syncProductsFunction = inngest.createFunction(
  { id: 'sync-products', retries: 3 },          // config object
  { event: 'shopify/product.sync' },              // trigger
  async ({ event, step }) => {                    // handler
    const { syncRunId, shop } = event.data;
    // ...
  }
);
```

The `triggers` field in the config object is an alias for passing a trigger as a second argument. When using the two-argument form (config, trigger, handler) the `trigger` is the second positional arg — this is the form confirmed in the quick start docs.

### step.run(id, fn) contract

- **Signature:** `await step.run(stepId: string, fn: () => Promise<T>): Promise<T>`
- **Return value:** The JSON-serialized return value of `fn`. On subsequent replays of the function (after a Vercel timeout), Inngest returns the memoized value **without re-executing `fn`**. This is the core durability guarantee.
- **Error handling:** If `fn` throws, the step is retried independently up to the function's `retries` count. Each step has its own retry counter.
- **TypeScript:** Return type is inferred from `fn`'s return type.
- **Critical constraint:** The `stepId` string must be **deterministic and stable**. Changing a step ID invalidates memoization and will re-run that step from scratch on resume.

```typescript
// Three-step batch pattern (D-01)
const cursor = null; // first iteration; subsequent iterations use previous endCursor

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

### inngest.send() — event payload typing

```typescript
// Sending from the sync POST route:
await inngest.send({
  name: 'shopify/product.sync',
  data: { syncRunId: run.id, shop: shop },
});

// Optional: use Inngest event-level idempotency key (24-hour window).
// The app-level SyncRun idempotency key (D-05) is the primary guard;
// this is belt-and-suspenders:
await inngest.send({
  id: `sync-${shop}-${Math.floor(Date.now() / 300_000)}`,
  name: 'shopify/product.sync',
  data: { syncRunId: run.id, shop: shop },
});
```

For TypeScript event registry typing (Claude's Discretion):

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest';

type Events = {
  'shopify/product.sync': {
    data: { syncRunId: string; shop: string };
  };
};

export const inngest = new Inngest({ id: 'smartdiscovery-ai' });
// The Events generic is optional in 4.4 but recommended for type safety on event.data
```

---

## Q2: Shopify GraphQL Products Query (Admin API 2026-01)

[VERIFIED: official Shopify GraphQL docs fetched 2026-05-23]

### Product list with cursor pagination

```graphql
query GetProductsForSync($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    nodes {
      id
      title
      handle
      descriptionHtml
      vendor
      productType
      status
      tags
      updatedAt
      createdAt
      variants(first: 250) {
        nodes {
          id
          price
          compareAtPrice
          sku
          title
          inventoryQuantity
          availableForSale
          selectedOptions {
            name
            value
          }
        }
      }
      images(first: 10) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      options {
        id
        name
        values
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**Variables:** `{ "first": 100, "after": null }` (first page), then `{ "first": 100, "after": "<endCursor>" }`.

**Important field notes:**
- `id` is a GID string like `"gid://shopify/Product/1234567890"`. Extract the numeric ID with `id.split('/').pop()` if needed for `ProductUpsertInput.shopifyId` as BigInt.
- `variant.price` returns a **String** (decimal string like `"29.99"`) in both REST and GraphQL contexts in this API version. Parse with `parseFloat()` or `new Prisma.Decimal(price)`.
- `variant.selectedOptions` is an array of `{name: string, value: string}` — NOT the `option1/option2/option3` flat fields (those exist only as filter params). Map to `ProductUpsertInput.options` by grouping by name and collecting values.
- `product.options` is the top-level option definition (name + all possible values). Use these for `ProductOptionInput`.
- `images(first: 10)` — fetching 250 images per product per batch of 100 products = 25,000 image nodes. Cap at 10 to keep query cost manageable.

### Total count query

```graphql
query {
  productsCount {
    count
    precision
  }
}
```

Returns `{ count: Int!, precision: CountPrecision! }`. Use `count` for `SyncRun.totalCount`. `precision` will be `EXACT` for most stores; surface as-is (doesn't affect the UI since `totalCount` is displayed as denominator for processedCount).

### Making the GraphQL request via `@shopify/shopify-api` 12.3

```typescript
// services/shopify/ShopifyProductService.ts
import { shopifyClient } from '@/lib/shopify/client';
import type { Session } from '@shopify/shopify-api';

export async function fetchProductBatch(
  session: Session,
  cursor: string | null,
  batchSize: number
): Promise<{ products: ShopifyProductNode[]; endCursor: string | null; hasNextPage: boolean }> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request(PRODUCTS_QUERY, {
    variables: { first: batchSize, after: cursor },
  });
  // response.data.products.nodes, response.data.products.pageInfo
  return {
    products: response.data.products.nodes,
    endCursor: response.data.products.pageInfo.endCursor,
    hasNextPage: response.data.products.pageInfo.hasNextPage,
  };
}

export async function fetchTotalCount(session: Session): Promise<number | null> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request(`query { productsCount { count } }`);
  return response.data?.productsCount?.count ?? null;
}
```

The `GraphqlClientParams` interface is `{ session: Session; apiVersion?: ApiVersion }`. The `shopifyClient.clients.Graphql` constructor is `new shopifyClient.clients.Graphql({ session })`. No apiVersion override needed — the client was initialized with `ApiVersion.January26`.

---

## Q3: Shopify Webhook Payload Shapes

[CITED: shopify.dev/docs/apps/build/webhooks/delivery-structure — fetched 2026-05-23]

### Headers Shopify sends on every HTTPS webhook delivery

| Header | Value | Notes |
|--------|-------|-------|
| `X-Shopify-Topic` | e.g. `products/create` | Topic name |
| `X-Shopify-Shop-Domain` | e.g. `example.myshopify.com` | Shop identifier — use this, not the payload |
| `X-Shopify-Hmac-Sha256` | Base64-encoded HMAC-SHA256 | Computed over raw body using API secret |
| `X-Shopify-Webhook-Id` | Unique per delivery | Use for dedup of individual deliveries |
| `X-Shopify-Event-Id` | Shared across related deliveries | Correlates deliveries from same merchant action |
| `X-Shopify-Api-Version` | e.g. `2026-04` | API version that serialized the payload |
| `X-Shopify-Triggered-At` | ISO 8601 timestamp | When Shopify triggered the delivery |

**Treat header names as case-insensitive** (HTTP/2 lowercases them). `req.headers.get('x-shopify-event-id')` is correct.

Per the Shopify docs on deduplication: use `X-Shopify-Webhook-Id` to dedup individual deliveries. Use `X-Shopify-Event-Id` for audit/correlation. Since the app only has one subscription per topic, `X-Shopify-Webhook-Id` and `X-Shopify-Event-Id` will map 1:1 per event per topic. **D-07 uses `X-Shopify-Event-Id` as the `WebhookEvent.eventId`** — this is valid for V1 (one subscription per topic).

### Webhook payload fields needed

For `products/create` and `products/update`:
```json
{
  "id": 1234567890,
  "title": "...",
  "handle": "...",
  "body_html": "...",
  "vendor": "...",
  "product_type": "...",
  "status": "active",
  "tags": "tag1, tag2",
  "updated_at": "2026-05-23T10:00:00Z",
  "variants": [
    { "id": 11, "title": "Default Title", "price": "29.99", "sku": "...", "inventory_quantity": 5, "available": true }
  ],
  "images": [
    { "id": 22, "src": "https://...", "alt": "...", "width": 800, "height": 600, "position": 1 }
  ],
  "options": [
    { "id": 33, "name": "Title", "position": 1, "values": ["Default Title"] }
  ]
}
```

For `products/delete`:
```json
{ "id": 1234567890 }
```

**Mapping notes:**
- REST payload uses `body_html` (not `descriptionHtml`) and snake_case everywhere.
- `tags` in REST webhook is a comma-separated string (not array). Split with `product.tags.split(', ').filter(Boolean)`.
- `images[].src` in REST (not `url`). Map to `ProductImageInput.url`.
- `variants` do use `option1`, `option2`, `option3` as flat fields in the REST payload (unlike GraphQL). Map these when building `selectedOptions`.
- **`updated_at` is the Shopify-canonical timestamp for SYN-11 conflict resolution.** Store in DB and compare.

---

## Q4: shopifyClient.webhooks.validate — Correct API for Webhook HMAC

[VERIFIED: installed package source at `node_modules/@shopify/shopify-api` 12.3.0 — read 2026-05-23]

**CRITICAL:** `shopifyClient.utils.validateHmac` is for **OAuth callback / App Proxy** query-param HMAC only. It takes an `AuthQuery` object (query params). Do NOT use it for webhook HMAC verification.

For webhooks, use `shopifyClient.webhooks.validate`:

```typescript
// Exact function signature from lib/webhooks/validate.d.ts:
// validate({ rawBody, ...adapterArgs }): Promise<WebhookValidation>
//
// WebhookValidation is:
//   WebhookValidationValid:   { valid: true, webhookId, apiVersion, domain, hmac, topic }
//   WebhookValidationInvalid: { valid: false, reason: 'missing_body'|'invalid_hmac'|'missing_hmac'|'missing_headers' }
//   WebhookValidationMissingHeaders: { valid: false, reason: 'missing_headers', missingHeaders: string[] }

export async function POST(req: Request) {
  // STEP 1: Read raw body BEFORE JSON.parse
  const rawBody = await req.text();

  // STEP 2: Validate HMAC using the webhooks.validate API
  const validation = await shopifyClient.webhooks.validate({
    rawBody,
    rawRequest: req,          // adapterArgs — the Request object itself
  });

  if (!validation.valid) {
    return Response.json({ error: 'invalid_hmac' }, { status: 401 });
  }

  // validation.domain = "example.myshopify.com" (from X-Shopify-Shop-Domain)
  // validation.topic = "products/update"
  // validation.webhookId = "abc-123" (X-Shopify-Webhook-Id)
  const shop = validation.domain;
  const topic = validation.topic;

  // STEP 3: Dedup
  const eventId = req.headers.get('x-shopify-event-id')!;
  try {
    await prisma.webhookEvent.create({ data: { eventId, shop, topic } });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return Response.json({ ok: true }, { status: 200 }); // duplicate delivery
    }
    throw err;
  }

  // STEP 4: Parse after validation
  const payload = JSON.parse(rawBody);

  // STEP 5: Handle by topic
  // ...
}
```

**Why rawBody must precede JSON.parse:** `req.text()` and `req.json()` both consume the Request body stream. Once consumed, the stream is empty. The HMAC is computed over the raw bytes — parsing to JSON first discards the raw representation.

**The `validateHmacString` helper** (also on the package) is a lower-level primitive. It requires you to extract the `X-Shopify-Hmac-Sha256` header value yourself. Prefer `webhooks.validate` which handles header extraction internally.

---

## Q5: Inngest Local Dev Workflow

[VERIFIED: Inngest local-development docs fetched 2026-05-23]

### Two-process setup

**Terminal 1 — Next.js app:**
```bash
INNGEST_DEV=1 bun dev
```
Or add `INNGEST_DEV=1` to `.env` (never commit to git if it would affect prod — but for dev-only `.env` it is fine since Vercel env vars override).

**Terminal 2 — Inngest dev server:**
```bash
bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

The dev server runs at **http://localhost:8288**. It polls the app for registered functions and executes them locally when events are sent.

### Sending test events during development

From the dev server UI at http://localhost:8288: click "Test Event" → enter JSON payload.

From curl:
```bash
curl -X POST http://localhost:8288/e/test-key \
  -H "Content-Type: application/json" \
  -d '{"name":"shopify/product.sync","data":{"syncRunId":"clxxx","shop":"example.myshopify.com"}}'
```

From the app itself (any `inngest.send()` call with `INNGEST_DEV=1` set routes to the local dev server automatically).

### Production (Vercel ↔ Inngest marketplace)

1. Install the Inngest integration from the Vercel marketplace.
2. Vercel auto-sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` as environment variables.
3. On first deploy, Inngest registers the functions by calling `GET /api/inngest`.
4. No `INNGEST_DEV` env var in Vercel — its absence means production mode.

---

## Q6: Inngest Function Event Payload Typing

[ASSUMED — TypeScript best practice; consistent with Inngest 4.4 API]

The simplest V1 approach that works without an event type registry:

```typescript
// inngest/functions/sync-products.ts
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import { fetchProductBatch, fetchTotalCount } from '@/services/shopify/ShopifyProductService';
import { sessionStorage } from '@/lib/shopify/session-storage';
import { shopifyClient } from '@/lib/shopify/client';

export const syncProductsFunction = inngest.createFunction(
  { id: 'sync-products', retries: 3 },
  { event: 'shopify/product.sync' },
  async ({ event, step }) => {
    const { syncRunId, shop } = event.data as { syncRunId: string; shop: string };
    // ...
  }
);
```

For stronger typing (Claude's Discretion), add an Events type registry to the Inngest client:

```typescript
// lib/inngest/types.ts
export type SyncProductsEvent = {
  name: 'shopify/product.sync';
  data: { syncRunId: string; shop: string };
};

// lib/inngest/client.ts
import { Inngest } from 'inngest';
import type { SyncProductsEvent } from './types';

export const inngest = new Inngest<{ 'shopify/product.sync': SyncProductsEvent }>({
  id: 'smartdiscovery-ai',
});
// Now event.data.syncRunId and event.data.shop are typed without casting
```

---

## Q7: Prisma Additive Migration

[VERIFIED: Prisma 7.3.0 installed; additive migration behavior confirmed via official docs]

Prisma generates **additive-only** migrations when adding new models or enums to an existing schema with no changes to existing models. Phase 2 adds `SyncState` enum, `SyncRun` model, and `WebhookEvent` model — all new tables, no edits to existing tables.

Running `bunx prisma migrate dev --name add_sync_pipeline` will generate:

```sql
-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');

-- CreateTable
CREATE TABLE "sync_runs" (
    "id"             TEXT NOT NULL,
    "shop"           TEXT NOT NULL,
    "state"          "SyncState" NOT NULL DEFAULT 'queued',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount"     INTEGER,
    "errors"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cursor"         TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"     TIMESTAMP(3),
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "eventId"    TEXT NOT NULL,
    "shop"       TEXT NOT NULL,
    "topic"      TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_runs_idempotencyKey_key" ON "sync_runs"("idempotencyKey");
CREATE INDEX "sync_runs_shop_idx" ON "sync_runs"("shop");
CREATE INDEX "webhook_events_shop_idx" ON "webhook_events"("shop");
```

### Exact Prisma schema additions

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

**Note on `SyncRun.errors` type:** `String[]` (Prisma `text[]`) vs `Json[]`. `String[]` is simpler and the DB can append with `{ push: ['error text'] }`. `Json[]` requires `Prisma.JsonArray` typing. Recommendation: `String[]` with JSON-stringified error objects (`JSON.stringify({ shopifyId, message })`). The status endpoint can parse them client-side.

**Note on D-08 (updatedAt conflict resolution):** The existing `Product` model does not have a `updatedAtShopify` column. This MUST be added as part of Phase 2's schema migration:

```prisma
// ADD to existing Product model:
updatedAtShopify DateTime?   // Shopify's product.updatedAt; used for conditional upsert (SYN-11)
```

And `ProductUpsertInput` needs a corresponding field:
```typescript
updatedAtShopify?: Date | null;
```

The `upsertProduct` implementation must add a guard: if the existing product's `updatedAtShopify` is newer than the incoming value, skip the update. Use a raw `UPDATE ... WHERE updated_at_shopify < $incoming` or a Prisma `$transaction` with a pre-read check.

---

## Q8: GraphQL Query Cost and Throttling

[CITED: Shopify GraphQL Admin API docs + research/PITFALLS.md]

### Cost model

Shopify Admin GraphQL uses leaky-bucket rate limiting: 1000 cost points per 10 seconds (Shopify Plus: 2000/10s), restoring at 100/s. Each `products` query with `first: 100` and nested variants/images costs approximately:

- Base query: 1 point
- 100 products × 1 = 100 points
- 100 × 250 variants = 25,000 points — **this exceeds per-query limits**

**Shopify caps nested connections at their actual cost.** A `variants(first: 250)` nested in a `products(first: 100)` query does not actually return 25,000 nodes — it returns up to 250 variants per product, but the query itself is throttled by Shopify if the total query cost exceeds 1000 points.

**Practical recommendation for batch size 100 with variants:**
Use `variants(first: 10)` for the sync query — most products have ≤ 10 variants. If a product has more, the sync will capture the first 10; remaining variants are out of scope for V1 (no nested pagination on variants). The `options` field (top-level, not a connection) is not cost-counted.

```
products(first: 100) = 100 points
  + variants(first: 10) × 100 = 100 additional points
  + images(first: 10) × 100 = 100 additional points
Total: ~300 points per query — well within 1000/10s limit
```

### Throttle response handling

A throttled GraphQL response returns HTTP **200** with `errors` array containing `extensions.code === "THROTTLED"`. Do not treat 200 as success without checking `errors`.

```typescript
const response = await client.request(PRODUCTS_QUERY, { variables });
if (response.errors?.some(e => e.extensions?.code === 'THROTTLED')) {
  throw new Error('Shopify GraphQL throttled');
  // Inngest will retry this step with exponential backoff
}
```

Inngest's default exponential backoff (retry 1: 1s, retry 2: 4s, retry 3: 16s) handles transient throttling gracefully. Since each batch is a `step.run`, a throttled batch retries only that batch — not the entire function from scratch.

---

## Q9: Test Strategy

[VERIFIED: `@inngest/test` 1.0.0 registry + InngestTestEngine docs fetched 2026-05-23; existing test patterns from .planning/codebase/TESTING.md]

### Inngest function tests — `@inngest/test`

```typescript
// inngest/functions/__tests__/sync-products.test.ts
import { InngestTestEngine } from '@inngest/test';
import { syncProductsFunction } from '../sync-products';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db/client', () => ({ prisma: { syncRun: { update: vi.fn() } } }));
vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: { upsertProduct: vi.fn().mockResolvedValue({}) }
}));
vi.mock('@/services/shopify/ShopifyProductService', () => ({
  fetchProductBatch: vi.fn().mockResolvedValue({
    products: [{ id: 'gid://shopify/Product/1', title: 'Test', handle: 'test', updatedAt: '2026-01-01' }],
    endCursor: null,
    hasNextPage: false,
  }),
  fetchTotalCount: vi.fn().mockResolvedValue(1),
}));

describe('syncProductsFunction', () => {
  const t = new InngestTestEngine({ function: syncProductsFunction });

  it('processes a single batch and updates SyncRun to succeeded', async () => {
    const { result } = await t.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'run-1', shop: 'test.myshopify.com' } }],
    });
    // step.run callbacks execute inline — no Inngest dev server needed
    expect(prisma.syncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'succeeded' }) })
    );
  });
});
```

**Key behavior:** `InngestTestEngine.execute()` runs step callbacks inline (no memoization in test mode). Steps are executed in order, synchronously in test context. `ctx.step.run` is a spy function you can assert on.

### Fallback mock pattern (without `@inngest/test`)

If the team prefers not to install `@inngest/test`, stub `step` as a plain object:

```typescript
const mockStep = {
  run: vi.fn().mockImplementation((_id: string, fn: () => unknown) => fn()),
  sleep: vi.fn(),
  sendEvent: vi.fn(),
};
```

This invokes callbacks inline and allows testing the function body logic without the full Inngest runtime. `InngestTestEngine` is preferred because it handles step ordering and retry simulation.

### Webhook route tests

```typescript
// app/api/shopify/webhook/__tests__/route.test.ts
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
  productRepository: { upsertProduct: vi.fn() }
}));

it('returns 200 and upserts on valid products/update', async () => {
  const req = new Request('http://localhost/api/shopify/webhook', {
    method: 'POST',
    body: JSON.stringify({ id: 123, title: 'T', handle: 't', updated_at: '2026-01-01', tags: '', variants: [], images: [], options: [] }),
    headers: { 'x-shopify-event-id': 'evt-1', 'x-shopify-topic': 'products/update' },
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(productRepository.upsertProduct).toHaveBeenCalled();
});

it('returns 200 without upsert on duplicate event', async () => {
  vi.mocked(prisma.webhookEvent.create).mockRejectedValueOnce(
    Object.assign(new Error(), { code: 'P2002' })
  );
  // ...assert upsertProduct not called
});
```

### Sync POST route tests

The sync POST route is already wrapped with `withShopifySession`. Follow the same mock pattern as the existing `app/api/shopify/sync/__tests__/route.test.ts` (which has 6 GREEN tests). Add tests for:
- Idempotency: second call within 5-min window returns same `syncRunId`
- SyncRun in terminal state: returns 200 with existing id (not a new run)
- `inngest.send()` mock to verify event dispatch

### Status GET route tests

```typescript
vi.mock('@/lib/db/client', () => ({
  prisma: { syncRun: { findFirst: vi.fn().mockResolvedValue({ id: 'run-1', state: 'running', ... }) } }
}));

it('returns 404 when syncRunId not found for shop', async () => { ... });
it('returns SyncRun row when shop matches', async () => { ... });
it('returns 403 when syncRunId belongs to different shop', async () => { ... });
```

### Onboarding polling tests (component)

Extend `app/(embedded)/__tests__/onboarding.test.tsx` using `vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)`:

```typescript
it('starts polling after sync starts', async () => {
  vi.useFakeTimers();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ syncRunId: 'run-1' }) });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: 'running', processedCount: 10, totalCount: 100 }) });

  render(<OnboardingPage />);
  fireEvent.click(screen.getByTestId('start-sync'));
  await waitFor(() => expect(screen.queryByTestId('start-sync')).not.toBeInTheDocument());

  vi.advanceTimersByTime(2000);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/shopify/sync/status')
  ));
  vi.useRealTimers();
});
```

---

## Q10: Polling Endpoint Shape

[ASSUMED — follows existing error response conventions from Phase 1 + D-03 SyncRun model]

`GET /api/shopify/sync/status?syncRunId=<id>`

Auth: `withShopifySession` (Bearer token).

Query parameter: `syncRunId` (required).

```typescript
// Success response (200)
type SyncStatusResponse = {
  syncRunId: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';
  processedCount: number;
  totalCount: number | null;       // null until set by Inngest function start
  errors: string[];                // JSON-stringified {shopifyId, message} objects; empty array if none
  startedAt: string;               // ISO 8601
  finishedAt: string | null;       // ISO 8601 or null if not yet terminal
};

// Error responses (match existing pattern from lib/shopify/auth.ts):
// 400: { error: 'missing_sync_run_id' }
// 403: { error: 'wrong_shop' }        ← syncRunId found but belongs to different shop
// 404: { error: 'sync_run_not_found' }
```

Implementation sketch:

```typescript
// app/api/shopify/sync/status/route.ts
import { withShopifySession } from '@/lib/shopify/auth';
import { prisma } from '@/lib/db/client';
import { NextResponse } from 'next/server';

export const GET = withShopifySession(async ({ shop, req }) => {
  const url = new URL(req.url);
  const syncRunId = url.searchParams.get('syncRunId');
  if (!syncRunId) {
    return NextResponse.json({ error: 'missing_sync_run_id' }, { status: 400 });
  }

  const run = await prisma.syncRun.findFirst({ where: { id: syncRunId } });
  if (!run) {
    return NextResponse.json({ error: 'sync_run_not_found' }, { status: 404 });
  }
  if (run.shop !== shop) {
    return NextResponse.json({ error: 'wrong_shop' }, { status: 403 });
  }

  return NextResponse.json({
    syncRunId: run.id,
    state: run.state,
    processedCount: run.processedCount,
    totalCount: run.totalCount,
    errors: run.errors,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  });
});
```

**Excluded intentionally:** `cursor`, `idempotencyKey`, `accessToken`, session-related data. The response surface is minimal and non-sensitive.

---

## Q11: Onboarding State Machine

[VERIFIED: current onboarding/page.tsx read + Polaris web component docs]

### Current state

`app/(embedded)/onboarding/page.tsx` has `syncing: boolean` + `handleStartSync()` that POSTs to `/api/shopify/sync` with Bearer token and calls `shopify.toast.show`. The POST currently returns `{ success: true }` (Phase 1 stub).

### Phase 2 state machine

Replace `syncing: boolean` with `syncState`:

```typescript
type SyncUIState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'polling'; syncRunId: string; processedCount: number; totalCount: number | null; state: 'queued' | 'running' }
  | { phase: 'succeeded'; processedCount: number }
  | { phase: 'partial'; processedCount: number; errorCount: number }
  | { phase: 'failed'; errorCount: number };
```

Transitions:
1. `idle` → `starting`: user clicks "Start sync"
2. `starting` → `polling`: POST returns `{ syncRunId }`
3. `polling` → `polling`: status poll returns `queued` or `running` (update counts)
4. `polling` → `succeeded`/`partial`/`failed`: status poll returns terminal state
5. `succeeded`/`partial`/`failed` → `idle`: user clicks Retry (re-POST)

### `<s-progress-bar>` API

[ASSUMED — consistent with Shopify Polaris web components already in use in the project]

```tsx
// value is 0-100 (integer or float percentage)
<s-progress-bar value={totalCount ? Math.round((processedCount / totalCount) * 100) : 0} />
```

When `totalCount` is null, render `value={0}` with indeterminate appearance OR omit the value attribute to show indeterminate progress.

### Full component sketch (key additions)

```typescript
'use client';
import { useState, useEffect, useRef } from 'react';

export default function OnboardingPage() {
  const [syncState, setSyncState] = useState<SyncUIState>({ phase: 'idle' });
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start polling when we have a syncRunId
  useEffect(() => {
    if (syncState.phase !== 'polling') return;

    const poll = async () => {
      try {
        const token = await shopify.idToken();
        const res = await fetch(`/api/shopify/sync/status?syncRunId=${syncState.syncRunId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.state === 'queued' || data.state === 'running') {
          setSyncState(prev => prev.phase === 'polling'
            ? { ...prev, processedCount: data.processedCount, totalCount: data.totalCount, state: data.state }
            : prev
          );
        } else if (data.state === 'succeeded') {
          clearInterval(pollIntervalRef.current!);
          setSyncState({ phase: 'succeeded', processedCount: data.processedCount });
        } else if (data.state === 'partial') {
          clearInterval(pollIntervalRef.current!);
          setSyncState({ phase: 'partial', processedCount: data.processedCount, errorCount: data.errors.length });
        } else if (data.state === 'failed') {
          clearInterval(pollIntervalRef.current!);
          setSyncState({ phase: 'failed', errorCount: data.errors.length });
        }
      } catch { /* network error — silent, keep polling */ }
    };

    pollIntervalRef.current = setInterval(poll, 2000);
    poll(); // immediate first poll

    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [syncState.phase === 'polling' ? syncState.syncRunId : null]);

  async function handleStartSync() {
    if (syncState.phase === 'starting' || syncState.phase === 'polling') return;
    setSyncState({ phase: 'starting' });
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { syncRunId } = await res.json();
        setSyncState({ phase: 'polling', syncRunId, processedCount: 0, totalCount: null, state: 'queued' });
      } else {
        setSyncState({ phase: 'idle' });
        shopify.toast.show('Sync failed. Try again.', { isError: true });
      }
    } catch {
      setSyncState({ phase: 'idle' });
      shopify.toast.show('Sync failed. Try again.', { isError: true });
    }
  }

  // Render based on syncState.phase ...
}
```

### Rendering by state

```tsx
{syncState.phase === 'idle' || syncState.phase === 'starting' ? (
  <s-button
    data-testid="start-sync"
    variant="primary"
    onClick={handleStartSync}
    {...(syncState.phase === 'starting' ? { loading: '' } : {})}
  >
    Start sync
  </s-button>
) : syncState.phase === 'polling' ? (
  <>
    <s-progress-bar value={syncState.totalCount
      ? Math.round((syncState.processedCount / syncState.totalCount) * 100)
      : 0}
    />
    <s-text>
      {syncState.totalCount
        ? `${syncState.processedCount} / ${syncState.totalCount} products`
        : `${syncState.processedCount} products synced so far`}
    </s-text>
    <s-badge tone={syncState.state === 'queued' ? 'info' : 'attention'}>
      {syncState.state === 'queued' ? 'Queued' : 'Running'}
    </s-badge>
  </>
) : syncState.phase === 'succeeded' ? (
  <s-banner tone="success">
    Your store is ready — {syncState.processedCount} products synced
    <s-button variant="primary" url="/chat">Open admin chat</s-button>
  </s-banner>
) : syncState.phase === 'partial' ? (
  <s-banner tone="warning">
    {syncState.processedCount} products synced, {syncState.errorCount} failed
    <s-button onClick={handleStartSync}>Retry sync</s-button>
  </s-banner>
) : /* failed */ (
  <s-banner tone="critical">
    Sync failed ({syncState.errorCount} errors)
    <s-button onClick={handleStartSync}>Retry sync</s-button>
  </s-banner>
)}
```

---

## Q12: shopify.app.toml Webhook Subscriptions

[VERIFIED: Shopify CLI configuration docs fetched 2026-05-23 + existing shopify.app.toml read]

### Current shopify.app.toml state

The file at `/Users/ikhuda/sites/personal/shopify-search-app/shopify.app.toml` is **untracked** in git (shown in git status as `??`). It contains a real `client_id` and ngrok URL. It currently has:

```toml
[webhooks]
api_version = "2026-04"
# No [[webhooks.subscriptions]] blocks yet
```

### Phase 2 additions — exact TOML syntax

```toml
[webhooks]
api_version = "2026-04"

[[webhooks.subscriptions]]
topics = [ "products/create", "products/update", "products/delete" ]
uri = "/api/shopify/webhook"
```

The `uri` is a relative path — Shopify CLI prepends the `application_url` from the top-level field. This resolves to `https://<ngrok-url>/api/shopify/webhook` for dev and `https://<production-domain>/api/shopify/webhook` in prod.

**Topics are grouped in a single `[[webhooks.subscriptions]]` block** using an array — no need for one block per topic.

### Registration

```bash
bunx shopify app deploy
```

This command reads `shopify.app.toml`, diffs the declared subscriptions against currently registered ones in Shopify's partner dashboard, and creates/updates/deletes subscriptions accordingly.

**Manual step for Phase 2:** After implementing the webhook route, update `shopify.app.toml` to add the subscriptions block above, then run `bunx shopify app deploy`. Document in the phase SUMMARY.md.

### Git tracking recommendation

The file contains a real `client_id` which is not a secret (it's the app's public identifier in Shopify's partner dashboard), but the `application_url` is an ngrok URL that changes per dev session. Recommendation: **commit `shopify.app.toml` to git** with the following approach:

1. Replace the `application_url` with a placeholder or the Vercel production URL.
2. Add a comment noting that `application_url` must be updated locally for dev.
3. The `client_id` is safe to commit (it's visible in the Partner Dashboard publicly).

This makes the webhook subscription configuration version-controlled without requiring anyone to run `shopify app deploy` from memory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook HMAC verification | Manual `crypto.createHmac(...).update(rawBody).digest('base64')` + header compare | `shopifyClient.webhooks.validate({rawBody, rawRequest})` | Handles header extraction, base64 decode, timing-safe compare; returns typed result with shop/topic |
| Durable step memoization | DB-backed cursor polling + `after()` re-invoke | `step.run()` with deterministic IDs | Inngest handles memoization, retry isolation, timeout resume natively |
| Idempotency key storage | Custom table for dedup keys | `WebhookEvent @id` Prisma unique + catch P2002 | Postgres unique constraint + Prisma error code is atomic and requires zero extra logic |
| Sync status tracking | Custom Inngest run state polling | `prisma.syncRun` row updated from within `step.run` | Direct DB writes from Inngest worker steps are the standard pattern for progress that needs to outlive the Inngest runtime |
| Event-level dedup | Custom hash comparison on payload | `inngest.send({ id: ... })` for 24-hour event dedup | Built-in; free via Inngest platform |

---

## Common Pitfalls

### Pitfall 1: Using utils.validateHmac for Webhooks
**What goes wrong:** `shopifyClient.utils.validateHmac(query)` takes an `AuthQuery` (parsed query params object). Calling it with a raw body string or any non-query-param input will silently return false or throw. All webhook requests will be rejected as unauthorized.
**Why it happens:** Both methods validate HMAC but are designed for completely different inputs. `utils.validateHmac` is for OAuth callbacks and App Proxy (query param `hmac=...`). Webhooks deliver HMAC as `X-Shopify-Hmac-Sha256` header over a raw body.
**How to avoid:** Use `shopifyClient.webhooks.validate({ rawBody, rawRequest: req })` exclusively for webhook routes. See Q4.
**Warning signs:** All POST requests to `/api/shopify/webhook` return 401 even with correctly signed payloads from Shopify.

### Pitfall 2: Consuming req.json() Before HMAC Validation
**What goes wrong:** `await req.json()` consumes the Request body stream. A subsequent `await req.text()` or `await req.arrayBuffer()` returns empty — the HMAC validation receives an empty body and returns `missing_body` error. All valid webhooks are rejected.
**Why it happens:** Node.js/Web API Request body is a one-time-read stream.
**How to avoid:** Always `const rawBody = await req.text()` first. Then validate HMAC over `rawBody`. Then `JSON.parse(rawBody)` to access the payload. Never call `req.json()` in the webhook handler.
**Warning signs:** `validation.reason === 'missing_body'` on every request.

### Pitfall 3: Mutable step.run IDs
**What goes wrong:** Using a counter variable (`step.run('batch-${i}', ...)`) instead of the cursor value. If the cursor changes between retries (impossible by design, but also: if the ID format changes in code), Inngest cannot match the completed step to its memoized result and re-executes it. Products are upserted twice; processedCount overcounts.
**Why it happens:** D-01 mandates cursor-keyed IDs (`fetch-batch-${cursor || 'start'}`). Using the loop index `i` would work for single-run but fails when resuming from mid-batch after timeout (Inngest restarts the function and re-executes all steps until it finds one that wasn't previously completed).
**How to avoid:** Use `cursor || 'start'` as the step ID suffix. On the very first batch, `cursor` is `null` — use `'start'` as the suffix. On subsequent batches, use the `endCursor` value returned by the previous `fetch-batch` step.
**Warning signs:** `processedCount` doubles after a Vercel function restart. Inngest logs show step IDs that don't match any previously completed step.

### Pitfall 4: Missing updatedAtShopify Column for Conflict Resolution
**What goes wrong:** SYN-11 requires conflict resolution between concurrent webhook updates and manual sync. The `ProductRepository.upsertProduct` currently does a full upsert by `(shop, handle)`. If a webhook arrives with an older product state during a sync, the webhook will overwrite the fresher data (or vice versa).
**Why it happens:** The current `Product` schema has no `updatedAtShopify` column. Without a "freshness" timestamp, neither code path can detect staleness.
**How to avoid:** Phase 2 migration adds `updatedAtShopify DateTime?` to `Product`. `ProductUpsertInput` gains `updatedAtShopify?: Date | null`. The upsert implementation adds a conditional: if `existingProduct.updatedAtShopify && incoming.updatedAtShopify <= existingProduct.updatedAtShopify`, skip the update.
**Warning signs:** Product prices revert after manual sync overwrites recent webhook updates. Products appear to "bounce" between two states.

### Pitfall 5: Polling Loop Memory Leak on Completion
**What goes wrong:** The `useEffect` that starts the polling interval returns a cleanup function (`clearInterval`). If `syncState` transitions to a terminal state inside the interval callback (via `setSyncState`), the interval is cleared inside the callback — but the effect's own cleanup does NOT fire because `syncState.phase` hasn't changed from the perspective of the effect's dependency array (the effect only depends on `syncRunId`). The interval continues firing after state is terminal.
**Why it happens:** React's `useEffect` cleanup runs when dependencies change or component unmounts. The interval is cleared inside the callback; if that succeeds, no leak. But the cleanup function returned by the effect should also call `clearInterval` to handle the case where the component unmounts while polling.
**How to avoid:** Use `useRef` to store the interval ID. Always `clearInterval(pollIntervalRef.current)` both inside the terminal-state branch of the poll callback AND in the `useEffect` cleanup return function. The component sketch in Q11 uses this pattern correctly.
**Warning signs:** Network tab shows `/api/shopify/sync/status` requests continuing after the banner has rendered.

### Pitfall 6: Prisma P2002 Catch Must Be Type-Narrowed
**What goes wrong:** Catching all errors on `prisma.webhookEvent.create` and returning 200 masks real database errors (connection failure, schema mismatch). A DB connection error would silently return 200 to Shopify, dropping the event permanently.
**Why it happens:** `catch (err)` catches all thrown values; without type-narrowing, you can't distinguish Prisma unique violation from other errors.
**How to avoid:**
```typescript
import { Prisma } from '@/app/generated/prisma/client';

try {
  await prisma.webhookEvent.create({ data: { eventId, shop, topic } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return Response.json({ ok: true }); // duplicate delivery — safe to acknowledge
  }
  throw err; // re-throw other errors — Shopify will retry
}
```
**Warning signs:** webhook handler returns 200 even during DB outages; events are silently dropped.

---

## Code Examples

### Sync POST route (D-01, D-05, D-09)

```typescript
// app/api/shopify/sync/route.ts
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { withShopifySession } from '@/lib/shopify/auth';
import { prisma } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';

export const POST = withShopifySession(async ({ shop }) => {
  // D-05: 5-minute idempotency bucket
  const idempotencyKey = createHash('sha256')
    .update(`${shop}|${Math.floor(Date.now() / 300_000)}`)
    .digest('hex');

  // Find or create SyncRun
  const existing = await prisma.syncRun.findFirst({ where: { shop, idempotencyKey } });
  if (existing) {
    return NextResponse.json({ syncRunId: existing.id });
  }

  const run = await prisma.syncRun.create({
    data: { shop, idempotencyKey, state: 'queued', startedAt: new Date() },
  });

  await inngest.send({
    name: 'shopify/product.sync',
    data: { syncRunId: run.id, shop },
  });

  return NextResponse.json({ syncRunId: run.id });
});
```

### Inngest function skeleton (D-01, D-02, D-03, D-04, D-15)

```typescript
// inngest/functions/sync-products.ts
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import { fetchProductBatch, fetchTotalCount, mapToUpsertInput } from '@/services/shopify/ShopifyProductService';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export const syncProductsFunction = inngest.createFunction(
  { id: 'sync-products', retries: 3 },
  { event: 'shopify/product.sync' },
  async ({ event, step }) => {
    const { syncRunId, shop } = event.data as { syncRunId: string; shop: string };

    // Load session (offline session stored from OAuth)
    const sessionId = shopifyClient.session.getOfflineId(shop);
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) throw new Error(`No offline session for shop: ${shop}`);

    // Update state to running
    await prisma.syncRun.update({ where: { id: syncRunId }, data: { state: 'running' } });

    // D-04: Get total count before first batch
    const totalCount = await step.run('fetch-total-count', () => fetchTotalCount(session));
    if (totalCount !== null) {
      await prisma.syncRun.update({ where: { id: syncRunId }, data: { totalCount } });
    }

    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const cursorLabel = cursor ?? 'start';

      // D-01: Three deterministic steps per batch
      const batch = await step.run(`fetch-batch-${cursorLabel}`, () =>
        fetchProductBatch(session, cursor, 100)
      );

      const batchResult = await step.run(`upsert-batch-${cursorLabel}`, async () => {
        const errors: string[] = [];
        for (const product of batch.products) {
          try {
            await productRepository.upsertProduct(shop, mapToUpsertInput(product));
          } catch (err) {
            errors.push(JSON.stringify({ shopifyId: product.id, message: String(err) }));
          }
        }
        // D-15: throw only if entire batch failed
        if (errors.length === batch.products.length && batch.products.length > 0) {
          throw new Error(`Full batch failed at cursor ${cursorLabel}`);
        }
        return { errors };
      });

      await step.run(`persist-cursor-${cursorLabel}`, async () => {
        await prisma.syncRun.update({
          where: { id: syncRunId },
          data: {
            cursor: batch.endCursor,
            processedCount: { increment: batch.products.length - batchResult.errors.length },
            errors: { push: batchResult.errors },
          },
        });
      });

      cursor = batch.endCursor;
      hasNextPage = batch.hasNextPage;
    }

    // Final state update
    const run = await prisma.syncRun.findUniqueOrThrow({ where: { id: syncRunId } });
    const finalState = run.errors.length > 0 ? 'partial' : 'succeeded';
    await prisma.syncRun.update({
      where: { id: syncRunId },
      data: { state: finalState, finishedAt: new Date() },
    });
  }
);
```

### Webhook handler skeleton (D-06, D-07, D-08, D-10)

```typescript
// app/api/shopify/webhook/route.ts
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@/app/generated/prisma/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import { mapWebhookPayloadToUpsertInput } from '@/services/shopify/ShopifyProductService';

export async function POST(req: Request) {
  // D-10: Read raw body FIRST — must come before any JSON.parse
  const rawBody = await req.text();

  // D-10: Use webhooks.validate, not utils.validateHmac
  const validation = await shopifyClient.webhooks.validate({
    rawBody,
    rawRequest: req,
  });

  if (!validation.valid) {
    return Response.json({ error: 'invalid_hmac' }, { status: 401 });
  }

  const shop = validation.domain;
  const topic = validation.topic;
  const eventId = req.headers.get('x-shopify-event-id');

  if (!eventId) {
    return Response.json({ error: 'missing_event_id' }, { status: 400 });
  }

  // D-07: Dedup via WebhookEvent insert + P2002 catch
  try {
    await prisma.webhookEvent.create({ data: { eventId, shop, topic } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return Response.json({ ok: true }); // duplicate delivery
    }
    throw err;
  }

  const payload = JSON.parse(rawBody);

  if (topic === 'products/delete') {
    // payload is { id: number }
    const shopifyId = BigInt(payload.id);
    const product = await prisma.product.findFirst({ where: { shop, shopifyId } });
    if (product) {
      await productRepository.deleteProduct(shop, product.id);
    }
    return Response.json({ ok: true });
  }

  // products/create or products/update — D-08: conflict by updatedAt
  const mapped = mapWebhookPayloadToUpsertInput(payload);
  // mapped.updatedAtShopify is parsed from payload.updated_at
  const existing = await prisma.product.findFirst({ where: { shop, shopifyId: mapped.shopifyId } });
  if (existing?.updatedAtShopify && mapped.updatedAtShopify && existing.updatedAtShopify >= mapped.updatedAtShopify) {
    return Response.json({ ok: true }); // skip stale write
  }

  await productRepository.upsertProduct(shop, mapped);
  return Response.json({ ok: true });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/server after()` for background sync | Inngest step functions | PROJECT.md pre-decision | `after()` has no memoization — a Vercel timeout means restarting from product 1. Inngest resumes from last completed step |
| Manual HMAC with `crypto` | `shopifyClient.webhooks.validate()` | `@shopify/shopify-api` v9+ | Correct header parsing, timing-safe compare, typed response |
| `@shopify/shopify-api` v13 (npm latest) | v12.3.0 (installed) | v13 released (date unknown) | STATE.md notes v13 breaking changes not yet audited — do not upgrade in Phase 2 |
| `inngest` v3 API (createFunction with triggers in config) | v4.4 (same createFunction shape, triggers as 2nd arg) | v4 released 2023-2024 | The `{ id, triggers: { event } }` all-in-one-config form still works in v4; two-arg form `createFunction(config, trigger, handler)` is the recommended v4 pattern |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<s-progress-bar value={0-100}>` is the correct Polaris web component API for the embedded admin | Q11 Onboarding | Wrong attribute name; planner would need to find correct Polaris web component docs. Low risk — the pattern matches all other `s-*` component usage in the codebase. |
| A2 | `variant.price` in the GraphQL response is a decimal String (e.g., "29.99"), not a MoneyV2 object | Q2 | If it is MoneyV2, `mapToUpsertInput` must extract `.amount` field. Verify against actual GraphQL response shape before writing the mapper. |
| A3 | REST webhook `products/update` payload uses snake_case (`body_html`, `updated_at`, `images[].src`) | Q3 | If Shopify has moved to camelCase in 2026-04 webhooks, field access in `mapWebhookPayloadToUpsertInput` will fail silently (undefined). Log the raw body on first webhook receipt to confirm. |
| A4 | `shopifyClient.webhooks.validate` accepts `rawRequest: req` as the adapterArgs for the Next.js Web API `Request` object | Q4 | The adapterArgs interface expects an object compatible with the Web API adapter. If the installed v12.3 adapter doesn't accept raw `Request`, the call will throw. Fallback: use `validateHmacString(config, rawBody, hmacHeader, HashFormat.Base64)` directly. |
| A5 | Prisma 7.3 `syncRun.update` supports `errors: { push: [...] }` for `String[]` fields | Q7 | Standard Prisma array push operation; confirmed in Prisma 5+ docs. If not supported, use raw concat: `errors: [...existing.errors, ...newErrors]` with a pre-read step. |

---

## Open Questions

1. **Does `variant.price` return a String or MoneyV2 object in the GraphQL Admin API 2026-01?**
   - What we know: Shopify REST API returns price as a string. GraphQL docs show `price` as `Money!` type in some versions.
   - What's unclear: `Money` could be a scalar (string) or the `MoneyV2` object type `{amount, currencyCode}` depending on the API version.
   - Recommendation: In `ShopifyProductService.fetchProductBatch`, log `typeof product.variants.nodes[0].price` on first response and handle both. Write `mapToUpsertInput` to accept `string | { amount: string; currencyCode: string }` for safety.

2. **Does the Web API adapter in `@shopify/shopify-api` 12.3.0 support `rawRequest: Request` for `webhooks.validate`?**
   - What we know: The type signature is `validateFactory({ rawBody, ...adapterArgs })` where adapterArgs extends `AdapterArgs`. The Web API adapter is imported via `import '@shopify/shopify-api/adapters/web-api'` (already in client.ts).
   - What's unclear: Whether `adapterArgs` in the Web API context is `{ rawRequest: Request }` or something else.
   - Recommendation: Test with a unit test using a real `Request` object before shipping. If it fails, fall back to the lower-level `validateHmacString` approach with manual header extraction.

3. **Should `shopify.app.toml` be committed to git with a production URL or the current ngrok URL?**
   - What we know: The file is currently untracked. The ngrok URL changes per dev session.
   - Recommendation: Commit with the Vercel production URL as `application_url`. Each developer overrides locally. Document the pattern in SUMMARY.md.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / bun | All routes | ✓ | bun detected | — |
| PostgreSQL (localhost:5432) | Prisma migrations | ✓ (per Phase 1 SUMMARY) | Docker-compose | — |
| `inngest` package | D-01..D-12 | ✗ (not in package.json) | — | Must install: `bun add inngest` |
| `@inngest/test` package | Testing | ✗ (not in package.json) | — | Must install: `bun add -d @inngest/test` |
| Inngest CLI (`inngest-cli`) | Local dev server | ✗ (installed via bunx on-demand) | 4.4.0 | `bunx inngest-cli@latest dev` — no global install needed |
| `INNGEST_DEV=1` env var | Local dev routing | ✗ (not in .env) | — | Add to `.env` before `bun dev` |
| Shopify CLI (`shopify`) | Webhook registration (D-16) | Assumed present | 3.x | Manual webhook registration via Partner Dashboard |

**Missing dependencies with no fallback:**
- `inngest` package — must install before Phase 2 implementation begins (Wave 0 task)

**Missing dependencies with fallback:**
- Inngest CLI — `bunx inngest-cli@latest dev` works without global install
- Shopify CLI — webhook topics can be manually registered in Partner Dashboard if CLI is unavailable

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `bunx vitest run inngest/functions/__tests__/ app/api/shopify/sync/__tests__/ app/api/shopify/webhook/__tests__/` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYN-01 | `fetchProductBatch` returns product nodes with cursor | unit | `bunx vitest run services/shopify/__tests__/ShopifyProductService.test.ts` | ❌ Wave 0 |
| SYN-02 | `mapToUpsertInput` maps Shopify fields to `ProductUpsertInput` | unit | `bunx vitest run services/shopify/__tests__/ShopifyProductService.test.ts` | ❌ Wave 0 |
| SYN-03 | Per-product error doesn't abort batch; full-batch failure throws | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ❌ Wave 0 |
| SYN-04 | SyncRun Prisma model creates with SyncState enum | manual | `bunx prisma migrate status` | ❌ Wave 0 (migration) |
| SYN-05 | POST /api/shopify/sync returns `{ syncRunId }` in <2s | unit | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` | ✅ (needs extension) |
| SYN-06 | Inngest function processes batch, persists cursor | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ❌ Wave 0 |
| SYN-07 | GET /status returns SyncRun row scoped to shop | unit | `bunx vitest run app/api/shopify/sync/status/__tests__/route.test.ts` | ❌ Wave 0 |
| SYN-08 | Second POST returns same syncRunId within 5-min window | unit | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` | ✅ (needs test case) |
| SYN-09 | Onboarding polls and renders progress bar | component | `bunx vitest run app/(embedded)/__tests__/onboarding.test.tsx` | ✅ (needs extension) |
| SYN-10 | Webhook validates HMAC, deduplicates by eventId | unit | `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` | ❌ Wave 0 |
| SYN-11 | Stale webhook payload skipped when updatedAtShopify is older | unit | `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` | ❌ Wave 0 |
| ADM-01 | Start sync button transitions to progress view | component | `bunx vitest run app/(embedded)/__tests__/onboarding.test.tsx` | ✅ (needs extension) |
| ADM-02 | Progress bar renders processedCount/totalCount | component | `bunx vitest run app/(embedded)/__tests__/onboarding.test.tsx` | ✅ (needs extension) |

### Sampling Rate

- **Per task commit:** `bunx vitest run inngest/functions/__tests__/ app/api/shopify/sync/__tests__/ app/api/shopify/webhook/__tests__/`
- **Per wave merge:** `bun test` (full 58+ test suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `inngest/functions/__tests__/sync-products.test.ts` — covers SYN-03, SYN-06
- [ ] `app/api/shopify/sync/status/__tests__/route.test.ts` — covers SYN-07
- [ ] `app/api/shopify/webhook/__tests__/route.test.ts` — covers SYN-10, SYN-11
- [ ] `services/shopify/__tests__/ShopifyProductService.test.ts` — covers SYN-01, SYN-02
- [ ] Prisma migration file: `bunx prisma migrate dev --name add_sync_pipeline` — covers SYN-04
- [ ] Framework install: `bun add inngest` + `bun add -d @inngest/test` — prerequisite for all above

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `withShopifySession` on sync POST + status GET; webhook uses `shopifyClient.webhooks.validate` |
| V3 Session Management | yes (via Phase 1) | Offline session DB load on every request — no caching |
| V4 Access Control | yes | `SyncRun` scoped to shop; status GET returns 403 if shop mismatch |
| V5 Input Validation | yes | `syncRunId` validated as non-null string; webhook payload parsed only after HMAC |
| V6 Cryptography | yes | SHA-256 for idempotency key (Node.js `crypto`); HMAC-SHA256 via `shopifyClient.webhooks.validate` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook (no HMAC) | Spoofing | `shopifyClient.webhooks.validate` — reject before parsing payload |
| Cross-shop SyncRun access | Information Disclosure | Status GET: explicit `run.shop !== shop` check → 403 |
| Replay attack on webhook | Spoofing | WebhookEvent dedup by `X-Shopify-Event-Id` (P2002 catch) |
| Session token replay on sync | Spoofing | Phase 1's `withShopifySession` validates JWT TTL + offline session |
| Sync DoS via rapid POST | Denial of Service | 5-minute idempotency window limits to 1 active run per shop per 5 min |
| Token leakage in Inngest payload | Information Disclosure | Inngest event `data` payload contains only `{ syncRunId, shop }` — no access tokens |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@shopify/shopify-api/dist/ts/lib/webhooks/` — types.d.ts, validate.d.ts, index.d.ts — confirmed exact `webhooks.validate` API [VERIFIED: installed package source]
- `node_modules/@shopify/shopify-api/dist/ts/lib/utils/hmac-validator.d.ts` — confirmed `utils.validateHmac` is for `AuthQuery` (NOT webhook raw body) [VERIFIED: installed package source]
- `node_modules/@shopify/shopify-api/dist/ts/lib/clients/admin/graphql/client.d.ts` — confirmed `new shopifyClient.clients.Graphql({ session })` + `request()` method [VERIFIED: installed package source]
- Inngest Next.js quick start docs — client creation, serve handler, step.run, inngest.send [CITED: inngest.com/docs/getting-started/nextjs-quick-start]
- Inngest idempotency docs — `inngest.send({ id: ... })` for event-level dedup [CITED: inngest.com/docs/guides/handling-idempotency]
- Inngest createFunction reference — retries, concurrency, step.run signature [CITED: inngest.com/docs/reference/functions/create]
- Inngest local development — `bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest`, port 8288 [CITED: inngest.com/docs/local-development]
- `@inngest/test` README — InngestTestEngine.execute(), step inline execution in tests [CITED: github.com/inngest/inngest-js/tree/main/packages/test]
- Shopify webhook delivery structure — all HTTPS headers including X-Shopify-Shop-Domain, X-Shopify-Event-Id, X-Shopify-Webhook-Id [CITED: shopify.dev/docs/apps/build/webhooks/delivery-structure]
- Shopify webhook deduplication — X-Shopify-Webhook-Id vs X-Shopify-Event-Id [CITED: shopify.dev/docs/apps/build/webhooks/ignore-duplicates]
- Shopify CLI app.toml configuration — `[[webhooks.subscriptions]]` TOML syntax [CITED: shopify.dev/docs/apps/tools/cli/configuration]
- Shopify Admin GraphQL products query — `nodes{}` syntax, `pageInfo.endCursor`, `variants.selectedOptions` [CITED: shopify.dev/docs/api/admin-graphql/2026-01/queries/products]
- Shopify productsCount query — `{ count, precision }` shape [CITED: shopify.dev/docs/api/admin-graphql/2026-01/queries/productsCount]
- npm registry — `inngest` 4.4.0 (created 2022, modified 2026-05-19), `@inngest/test` 1.0.0 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Inngest 4.4.0 install + serve() pattern (phase 1 era research; consistent with current docs)
- `.planning/research/PITFALLS.md` — cursor-based resumption, conditional upsert, webhook dedup patterns
- `.planning/research/ARCHITECTURE.md` — SyncRun model shape, polling endpoint pattern

### Tertiary (LOW confidence)
- Shopify GraphQL variant `price` type (String vs MoneyV2) — [ASSUMED] based on REST API behavior; must verify against live response

---

## Metadata

**Confidence breakdown:**
- Inngest API (client, serve, step.run, send): HIGH — confirmed via official docs + npm registry
- Webhook HMAC API (webhooks.validate): HIGH — confirmed via installed package source
- Shopify GraphQL query shape: HIGH — confirmed via official docs
- Prisma schema / migration: HIGH — confirmed via installed package + official behavior
- Onboarding state machine: MEDIUM — component structure assumed; Polaris `s-progress-bar` API assumed
- webhook payload field names (snake_case vs camelCase): MEDIUM — assumed from historical REST behavior

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable APIs; Inngest and Shopify API versions pinned)
