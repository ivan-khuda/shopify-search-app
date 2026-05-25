# Phase 3: Embeddings + Search Indexes — Research

**Researched:** 2026-05-25
**Domain:** Embedding pipeline (Vercel AI Gateway), pgvector HNSW + tsvector indexes, Prisma 7 raw-SQL migration mechanics, Inngest step extension
**Confidence:** HIGH for AI Gateway API surface and pgvector mechanics; MEDIUM for Accelerate + `SET LOCAL` (verified by Prisma docs but no production smoke-test in this codebase); HIGH for everything that mirrors Phase 2 patterns already in tree.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Sync step location:** Add `embed-batch-${cursor || 'start'}` step BETWEEN existing `upsert-batch-${cursor}` and `persist-cursor-${cursor}` in `inngest/functions/sync-products.ts`. The per-batch loop becomes 4 steps: fetch → upsert → embed → persist-cursor. ADDITIVE edit to the file Phase 2 already shipped.
- **D-02 — Webhook re-embedding:** INLINE in `app/api/shopify/webhook/route.ts`. For `products/create|update`, after `productRepository.upsertProduct(...)`, call `EmbeddingService.embedAndStore(shop, product.id, buildSearchableText(mapped))` synchronously. For `products/delete`, no action — FK cascade on `ProductEmbedding.product` deletes the embedding row.
- **D-03 — Embed input text:** Concatenation of `title + description + tags + vendor + productType + options` in the labelled format from CONTEXT.md. Helper `buildSearchableText(product)` at `services/search/searchableText.ts` is single source of truth. No truncation in V1.
- **D-04 — tsvector composition:** Generated `STORED` column on `products` table; field set is `title (A) + tags+vendor+productType (B) + description (C)` via `setweight`. Options NOT included in tsvector (semantic embedding covers them).
- **D-05 — HNSW params:** `m=16, ef_construction=64` with `vector_cosine_ops` opclass.
- **D-06 — Manual SQL lifecycle:** `db/manual-indexes.sql` is idempotent via `CREATE INDEX IF NOT EXISTS`; applied via `bun db:indexes` package.json script. CLAUDE.md must be updated to document the two-step workflow (`bunx prisma migrate dev` then `bun db:indexes`).
- **D-07 — Batch size:** 100 inputs per AI Gateway call (matches Phase 2 sync batch size).
- **D-08 — Error policy:** Per-batch try/catch mirroring Phase 2 D-15. Full-batch failure throws → Inngest auto-retry (3 attempts via `retries: 3` already on syncProductsFunction). Partial-batch errors push `JSON.stringify({productId, message})` into `SyncRun.errors[]` without throwing.
- **D-09 — Service shape:** `services/embeddings/EmbeddingService.ts` exports `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `embed(text)`, `embedBatch(texts)`, `embedAndStore(shop, productId, text)`.
- **D-10 — Schema additions:** `ProductEmbedding.modelVersion String` (NOT NULL, no default), `ProductEmbedding.searchableText String @db.Text`, and `@@unique([shop, productShop, productId])`.
- **D-11 — Iterative scan helper:** `withHnswIterativeScan(callback)` helper wraps `prisma.$transaction` and issues `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` as first statement. Lives at `lib/db/hnsw.ts` (or `lib/db/client.ts`). Phase 4's SearchService is primary consumer; Phase 3 ships helper + smoke test.

### Claude's Discretion

- Whether `embedBatch` returns `(number[] | null)[]` or `{ ok, failed }` discriminated result (Planner picks after inspecting `ai` package response shape — this RESEARCH.md recommends the discriminated shape; see EMB-01 analysis below).
- Whether `db/manual-indexes.sql` repeats `CREATE EXTENSION IF NOT EXISTS vector` (harmless; recommend YES for self-containment).
- `EMBEDDING_DIMENSIONS` runtime assert vs Postgres CHECK constraint (recommend runtime assert in `embed()`).
- `buildSearchableText` whitespace trimming (recommend YES: `field?.trim() ?? ''`).
- `bun db:indexes` vs `bun run db:indexes` (planner picks; both work).

### Deferred Ideas (OUT OF SCOPE)

- Re-embed worker / model-upgrade CLI
- Multimodal embeddings (CLIP)
- Embedding-cost dashboard → Phase 8
- Truncation logic for >8192-token products
- CHECK constraint on `ProductEmbedding.embedding` dimensions
- Per-product `step.run` granularity
- Adaptive batch size based on rate-limit headers
- Redis embedding cache
- Vector-store provider abstraction (Pinecone/Weaviate)
- Embedding model A/B testing
- `searchableText` content-hash dedup

### CRITICAL: Out-of-Scope Phase 4 Items

These belong to Phase 4 — do NOT pull into Phase 3 plans under any circumstance:

- **EMB-05** `SearchService.hybridSearch` — Phase 3 ships the `withHnswIterativeScan` helper but does NOT build or wire SearchService. No RRF code in Phase 3.
- **EMB-07** Removing `MOCK_PRODUCTS` from `/api/chat` and `/api/proxy/chat` — Phase 3 does NOT touch any chat route. The chat route continues to use mock products until Phase 4.

The Phase 3 surface ships only infrastructure (service + schema + migration + indexes script + helper). The chat UI experience is unchanged after Phase 3.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMB-01 | `EmbeddingService.embed(text)` calls Vercel AI Gateway `openai/text-embedding-3-small`, returns 1536-dim vector | §EMB-01 — `embedMany` from `ai` v6 + `model: 'openai/text-embedding-3-small'` string syntax verified |
| EMB-02 | Embeddings batched during sync; one failed embedding does not abort run | §EMB-02 — try/catch around `embedMany` call + per-row upsert with errors[] persistence; Inngest step try/catch preserves run |
| EMB-03 | `ProductEmbedding.modelVersion` non-null, pinned full model ID (never alias) | §EMB-03 — OpenAI does NOT publish dated snapshots for embedding models; `openai/text-embedding-3-small` IS the most-specific pinned identifier |
| EMB-04 | Raw-SQL migration creates HNSW + tsvector GIN; idempotent script invulnerable to Prisma drift | §EMB-04 — Prisma cannot model `vector`/`tsvector` indexes; `IF NOT EXISTS` + `db/manual-indexes.sql` re-runnable after every Prisma migration |
| EMB-06 | Shop-scoped vector queries enable `hnsw.iterative_scan = 'relaxed_order'` per session | §EMB-06 — `prisma.$transaction(async (tx) => { await tx.$executeRaw\`SET LOCAL ...\` ... })` works through Accelerate transaction-mode pooler |

</phase_requirements>

## Summary

Phase 3 is a single-pass, well-scoped infrastructure change. Five requirements; all decisions locked in CONTEXT.md. The research here resolves four open questions:

1. **AI Gateway embedding API:** `embedMany` from `ai` v6.0.77 (already installed) accepts `model: 'openai/text-embedding-3-small'` as a string when the gateway provider is the default — no separate `@ai-sdk/gateway` import needed for the string form. Auth via `AI_GATEWAY_API_KEY` env var (must be added — not currently in `.env`).
2. **pgvector ≥ 0.8.0:** Released 2024-11-11; available on every major host (Neon, Supabase, AWS RDS, Vercel Postgres). Iterative scan is gated on this version.
3. **`SET LOCAL` + Accelerate:** Works inside `prisma.$transaction(callback)` because the callback form opens a real BEGIN/COMMIT envelope on a single Accelerate-pooled connection. The known footgun is the **array form** `$transaction([...])` — do NOT use it for this helper.
4. **Model "pinning":** OpenAI does NOT offer dated snapshots for embedding models (`text-embedding-3-small-2024-01-25` does not exist). The model name itself is the most-specific identifier available; CONTEXT.md's `EMBEDDING_MODEL = 'openai/text-embedding-3-small'` is correct per EMB-03 intent.

Two environment gaps the planner MUST address before the script is runnable:
- `psql` is **not installed** on the local dev machine (verified — `command -v psql` returns nothing).
- `AI_GATEWAY_API_KEY` is **not present** in `.env` (verified).

**Primary recommendation:** Build EmbeddingService around `embedMany` with discriminated `{ ok, failed }` result; gate `bun db:indexes` behind a psql check that prints a clear install hint; document `AI_GATEWAY_API_KEY` requirement in CLAUDE.md alongside the existing AI key list.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Embedding generation | Backend / Service | — | Pure server-side: secret AI Gateway key never leaves Node |
| Batched embedding during sync | Background Worker (Inngest) | Backend / Service | Inngest is the durable workflow runtime; EmbeddingService is its callee |
| Webhook re-embedding | Backend / API Route | Backend / Service | Synchronous per-product call; runs in the Vercel function that handles the webhook POST |
| HNSW + GIN index creation | Database / Storage | — | Pure DDL; lives in raw SQL outside Prisma's purview |
| tsvector generated column | Database / Storage | — | Postgres computes it on every UPDATE; no application-layer logic |
| `SET LOCAL hnsw.iterative_scan` | Backend / DB-helper | — | Per-transaction Postgres GUC setting; helper wraps `prisma.$transaction` |
| modelVersion column persistence | Backend / Service | Database / Storage | EmbeddingService writes the value; column constrains NOT NULL |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^6.0.77` (already installed) | `embedMany` / `embed` core API + bundled `gateway` export | Project constraint: AI Gateway is sole runtime entry point. `ai` v5.0.36+ bundles `gateway` provider so no separate install needed [VERIFIED: package.json + AI SDK docs] |
| pgvector | `>= 0.8.0` on target Postgres | `vector` column type + HNSW index + iterative scan GUC | Required for `hnsw.iterative_scan` per EMB-06. Released 2024-11-11 [CITED: postgresql.org/about/news/pgvector-080-released-2952/] |
| `@prisma/client` + `@prisma/adapter-pg` | `^7.3.0` (already installed) | `prisma.$transaction(callback)` + `$executeRaw` for `SET LOCAL` | Callback form gives single-connection guarantee through Accelerate transaction-mode pooler [VERIFIED: prisma docs + package.json] |
| Inngest | `^4.4.0` (already installed) | `step.run` adds embed-batch step to existing sync function | Per-step try/catch is the documented partial-failure pattern [VERIFIED: inngest.com/docs/guides/error-handling] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/gateway` | (optional, not needed) | Explicit gateway provider import | Only if you need `gateway.textEmbeddingModel('openai/...')` typed model objects. The string form `model: 'openai/text-embedding-3-small'` works without this import in v6 [VERIFIED: AI SDK v6 docs] |
| `psql` (CLI) | any | Runs `db/manual-indexes.sql` against database | Required for the `bun db:indexes` script. NOT installed locally [VERIFIED: `command -v psql` returns empty] — see Environment Availability §  |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `embedMany` (single AI Gateway call per batch) | `Promise.all([embed(x1), embed(x2), ...])` (100 parallel calls) | 100× HTTP overhead, easier to rate-limit; `embedMany` is the documented pattern [CITED: ai-sdk.dev/docs/ai-sdk-core/embeddings] |
| Generated tsvector column | Trigger-based tsvector | Trigger duplicates the column expression in two places, drifts over time. Generated column is the modern Postgres 12+ pattern [CITED: blogs on Prisma + tsvector] |
| `set_config('hnsw.iterative_scan', 'relaxed_order', true)` (function form) | `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` (statement form) | Functionally equivalent; statement form is more readable. Both transaction-scoped when used correctly [CITED: postgres docs] |
| HNSW with `m=16, ef_construction=64` (D-05) | IVFFlat, or HNSW with larger m/ef | Decision locked in CONTEXT.md; defaults are correct for 5k-vector V1 [CITED: pgvector docs + benchmarks] |
| psql for index application | Prisma `$executeRawUnsafe` from a Node script | Node script approach works but adds a script to wire up; psql is the established pattern in the existing `20260207111413_init` migration. Plan should pick whichever is easier given psql is missing locally |

**Installation (only the dependency change):**

```bash
# Nothing to install — all required packages already in package.json.
# Only env var to add:
echo "AI_GATEWAY_API_KEY=<vercel_gateway_key>" >> .env
```

**Version verification (done during this research):**

| Package / Tool | Verified Version | Where Verified |
|----------------|------------------|----------------|
| `ai` | 6.0.77 | package.json:19 [VERIFIED: file] |
| `@prisma/client` | 7.3.0 | package.json:14 [VERIFIED: file] |
| `inngest` | 4.4.0 | package.json:25 [VERIFIED: file] |
| pgvector availability | Confirmed on Neon, Supabase, AWS RDS, Azure, Google Cloud SQL [VERIFIED: vendor docs via WebSearch] | postgresql.org news + Supabase docs + AWS news |
| psql local | NOT INSTALLED [VERIFIED: `command -v psql` empty] | local shell |

## Package Legitimacy Audit

> Phase 3 installs NO new packages. All dependencies (`ai`, `@ai-sdk/google`, `@prisma/client`, `@prisma/adapter-pg`, `inngest`, `@inngest/test`) are already in package.json from earlier phases and were vetted then. slopcheck was not available in the research environment.

| Package | Registry | Already Installed? | Disposition |
|---------|----------|--------------------|-------------|
| `ai` | npm (v6.0.77) | YES — Phase 2 | Approved — no new install |
| `@prisma/client` | npm (v7.3.0) | YES — Phase 1 | Approved — no new install |
| `inngest` | npm (v4.4.0) | YES — Phase 2 | Approved — no new install |
| `@ai-sdk/gateway` | npm | NO — and not required | Skip — `ai` v5.0.36+ bundles `gateway` export |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new installs)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                                 ┌───────────────────────────┐
                                 │  Vercel AI Gateway        │
                                 │  openai/text-embedding-   │
                                 │  3-small (1536-dim)       │
                                 └─────────────▲─────────────┘
                                               │ HTTPS (AI_GATEWAY_API_KEY)
                                               │
                  ┌────────────────────────────┴────────────────────────────┐
                  │                                                          │
   embed-batch-${cursor} step                                   embedAndStore (1 product)
   (NEW in syncProductsFunction)                                (NEW in webhook handler)
                  │                                                          │
                  ▼                                                          ▼
   ┌──────────────────────────────────┐               ┌──────────────────────────────────┐
   │  EmbeddingService.embedBatch     │               │  EmbeddingService.embedAndStore  │
   │  (services/embeddings/)          │               │  (same module)                   │
   │  - embedMany() → number[][]      │               │  - embed() → number[]            │
   │  - returns { ok, failed }        │               │  - prisma.productEmbedding.upsert│
   └──────────────────┬───────────────┘               └──────────────────┬───────────────┘
                      │                                                   │
                      └──────────────────┬───────────────────────────────┘
                                         ▼
                              ┌─────────────────────────┐
                              │  Postgres + pgvector    │
                              │  ─ product_embeddings   │
                              │    (HNSW idx, modelVer, │
                              │     searchableText)     │
                              │  ─ products             │
                              │    (searchVector tsvec  │
                              │     GENERATED, GIN idx) │
                              └─────────────────────────┘
                                         ▲
                                         │  prisma.$transaction(async (tx) => {
                                         │    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
                                         │    ...                                   })
                                         │
                                  withHnswIterativeScan helper
                                  (lib/db/hnsw.ts — consumed by Phase 4 SearchService)

   buildSearchableText(product) is the single source of truth feeding:
   ┌─ embed-batch step (sync)
   ├─ embedAndStore (webhook)
   └─ ProductEmbedding.searchableText column (diagnostics)
```

### Recommended Project Structure

```
services/
├── embeddings/
│   └── EmbeddingService.ts        # NEW — embed, embedBatch, embedAndStore
└── search/
    └── searchableText.ts          # NEW — buildSearchableText(product)
lib/
└── db/
    ├── client.ts                  # existing prisma singleton
    └── hnsw.ts                    # NEW — withHnswIterativeScan helper
db/
└── manual-indexes.sql             # NEW — idempotent HNSW + GIN script
prisma/
├── schema.prisma                  # MODIFIED — add modelVersion, searchableText, @@unique
└── migrations/
    └── <ts>_add_embeddings_indexes/
        └── migration.sql          # NEW — additive raw SQL: ALTER TABLE + tsvector column
inngest/
└── functions/
    └── sync-products.ts           # MODIFIED — insert embed-batch step
app/
└── api/
    └── shopify/
        └── webhook/
            └── route.ts           # MODIFIED — call embedAndStore after upsert
package.json                       # MODIFIED — add "db:indexes" script
CLAUDE.md                          # MODIFIED — document two-step migration workflow + AI_GATEWAY_API_KEY
```

### Pattern 1: AI Gateway embedMany call (EMB-01)

**What:** Single AI Gateway HTTPS call for all 100 texts in a batch.
**When to use:** Every batch in sync, and (with `embed` not `embedMany`) every webhook re-embed.
**Code:**

```typescript
// services/embeddings/EmbeddingService.ts
// Source: ai-sdk.dev/docs/ai-sdk-core/embeddings + ai-sdk.dev/docs/reference/ai-sdk-core/embed-many

import { embed, embedMany } from 'ai';
import { prisma } from '@/lib/db/client';

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbedBatchResult {
  ok: Array<{ index: number; vector: number[] }>;
  failed: Array<{ index: number; message: string }>;
}

export async function embed(text: string): Promise<number[]> {
  const { embedding } = await (await import('ai')).embed({
    model: EMBEDDING_MODEL,
    value: text,
    maxRetries: 2,                     // Gateway-side retry; Inngest adds the outer retry
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<EmbedBatchResult> {
  // embedMany is atomic per AI Gateway call — either all texts return or the call throws.
  // We surface the discriminated shape so the caller can decide what to do with a hard failure.
  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: texts,
      maxRetries: 2,
    });
    return {
      ok: embeddings.map((vector, index) => ({ index, vector })),
      failed: [],
    };
  } catch (err) {
    // Full-batch failure — caller (Inngest step) decides whether to throw or proceed.
    return {
      ok: [],
      failed: texts.map((_, index) => ({
        index,
        message: err instanceof Error ? err.message : String(err),
      })),
    };
  }
}

export async function embedAndStore(
  shop: string,
  productId: number,
  text: string,
): Promise<void> {
  const vector = await embed(text);
  // pgvector input: the Postgres adapter accepts an array literal as text — but raw SQL is safest.
  await prisma.$executeRaw`
    INSERT INTO product_embeddings (shop, "productShop", "productId", content, embedding, "modelVersion", "searchableText", "createdAt")
    VALUES (${shop}, ${shop}, ${productId}, ${text}, ${`[${vector.join(',')}]`}::vector, ${EMBEDDING_MODEL}, ${text}, NOW())
    ON CONFLICT (shop, "productShop", "productId") DO UPDATE
    SET embedding = EXCLUDED.embedding,
        content = EXCLUDED.content,
        "modelVersion" = EXCLUDED."modelVersion",
        "searchableText" = EXCLUDED."searchableText"
  `;
}
```

**Why raw SQL for the upsert:** Prisma's typed client cannot generate inserts on `Unsupported("vector")` columns. `$executeRaw` is the only way. The composite unique `@@unique([shop, productShop, productId])` (D-10) is what makes `ON CONFLICT` work.

### Pattern 2: Iterative scan helper (EMB-06)

**What:** Wrap any pgvector query in a transaction that sets the iterative-scan GUC first.
**When to use:** Phase 4's SearchService.hybridSearch will call this for every vector query. Phase 3 ships only the helper + smoke test.

```typescript
// lib/db/hnsw.ts
// Source: pgvector 0.8 release notes + prisma 7 $transaction callback semantics

import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * Wraps a callback in a transaction with hnsw.iterative_scan='relaxed_order'.
 *
 * The Accelerate pooler returns connections at COMMIT, so the SET LOCAL only
 * lives for the duration of the transaction — exactly what we want.
 *
 * CRITICAL: use the callback form of $transaction, NOT the array form.
 * The array form does not open a single BEGIN/COMMIT envelope and the SET LOCAL
 * may execute on a different connection than the subsequent query.
 */
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
```

### Pattern 3: Embed step inside Inngest sync function (D-01, EMB-02)

**What:** Inject `embed-batch-${cursor}` between `upsert-batch` and `persist-cursor` in the existing batch loop.
**Where:** `inngest/functions/sync-products.ts:99–101` (between the existing `upsert-batch` return and the `persist-cursor` call).

```typescript
// inngest/functions/sync-products.ts — INSIDE the while(hasNextPage) loop, AFTER upsertErrors

const { errors: embedErrors }: { errors: UpsertError[] } = await step.run(
  `embed-batch-${cursorKey}`,
  async () => {
    const batchErrors: UpsertError[] = [];
    // Only embed the products that actually upserted successfully.
    const successfulShopifyIds = new Set(
      batch.products
        .map((n) => n.id)
        .filter((id) => !upsertErrors.find((e) => e.shopifyId === id)),
    );
    const productsToEmbed = batch.products.filter((n) => successfulShopifyIds.has(n.id));

    if (productsToEmbed.length === 0) return { errors: [] };

    const mapped = productsToEmbed.map((n) => mapToUpsertInput(n));
    const texts = mapped.map(buildSearchableText);

    const result = await embedBatch(texts);

    // Persist successes
    for (const { index, vector } of result.ok) {
      const m = mapped[index];
      try {
        // Look up local product id by handle (we just upserted it)
        const product = await prisma.product.findUnique({
          where: { shop_handle: { shop, handle: m.handle } },
          select: { id: true },
        });
        if (!product) {
          batchErrors.push({ shopifyId: productsToEmbed[index].id, message: 'Product not found after upsert' });
          continue;
        }
        await prisma.$executeRaw`
          INSERT INTO product_embeddings (shop, "productShop", "productId", content, embedding, "modelVersion", "searchableText", "createdAt")
          VALUES (${shop}, ${shop}, ${product.id}, ${texts[index]}, ${`[${vector.join(',')}]`}::vector, ${EMBEDDING_MODEL}, ${texts[index]}, NOW())
          ON CONFLICT (shop, "productShop", "productId") DO UPDATE
          SET embedding = EXCLUDED.embedding,
              content = EXCLUDED.content,
              "modelVersion" = EXCLUDED."modelVersion",
              "searchableText" = EXCLUDED."searchableText"
        `;
      } catch (err) {
        batchErrors.push({
          shopifyId: productsToEmbed[index].id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Record AI Gateway failures
    for (const { index, message } of result.failed) {
      batchErrors.push({ shopifyId: productsToEmbed[index].id, message });
    }

    // EMB-02: partial failure must NOT abort the run. Throw ONLY if every item failed.
    if (
      productsToEmbed.length > 0 &&
      batchErrors.length === productsToEmbed.length
    ) {
      throw new Error(`Full embed batch failed: ${batchErrors.map((e) => e.message).join(', ')}`);
    }

    return { errors: batchErrors };
  },
);

// THEN call the existing persist-cursor step, but ALSO push embed errors:
await step.run(`persist-cursor-${cursorKey}`, async () => {
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: {
      cursor: batch.endCursor,
      processedCount: { increment: batch.products.length - upsertErrors.length },
      errors: { push: [
        ...upsertErrors.map((e) => JSON.stringify(e)),
        ...embedErrors.map((e) => JSON.stringify({ ...e, stage: 'embed' })),
      ] },
    },
  });
  return { cursor: batch.endCursor };
});
```

**Key points:**
- Step ID is deterministic on `cursorKey` → Inngest memoizes across Vercel timeouts (same pattern as Phase 2 D-01).
- Throwing only when the WHOLE batch failed satisfies EMB-02; Inngest will then retry the step up to 3 times before the function fails.
- `embedErrors` are tagged with `stage: 'embed'` so post-mortem diagnostics can distinguish upsert from embed failures in `SyncRun.errors[]`.

### Pattern 4: Webhook re-embedding (D-02)

```typescript
// app/api/shopify/webhook/route.ts — INSIDE the `products/create | products/update` branch,
// AFTER the existing productRepository.upsertProduct call:

if (topic === 'products/create' || topic === 'products/update') {
  // ... existing stale-event guard + upsertProduct call ...

  const upserted = await productRepository.upsertProduct(shop, mapped);
  try {
    await embedAndStore(shop, upserted.id, buildSearchableText(mapped));
  } catch (err) {
    // Per Phase 2 webhook error precedent: log + return 200. Shopify retries on 5xx,
    // which we don't want for an embed failure (the product is already saved and a
    // later sync will catch it). Don't surface the embed failure to Shopify.
    console.error('[webhook] embed failed for', upserted.id, err);
  }
}
```

**Why log-and-200 (not 500):** The product upsert succeeded. Returning 500 makes Shopify retry the whole webhook, which would redo the upsert (idempotent, fine) and re-attempt the embed (good) — but it also blocks Shopify's webhook queue for this shop. The cleaner contract is "the product is in the DB; the embedding will reconcile on the next manual sync." Phase 8 can add a re-embed dead-letter queue.

### Anti-Patterns to Avoid

- **`prisma.$transaction([...arrayForm])` for the SET LOCAL helper:** The array form does NOT open a real Postgres transaction in a single connection envelope around the SET LOCAL [VERIFIED: prisma GitHub discussion]. Use the callback form ONLY.
- **Storing the AI SDK `result.providerMetadata.gateway.routing` string as `modelVersion`:** That field is for routing telemetry, not a pinned model identifier. Use the input model string `EMBEDDING_MODEL` constant — this is the value the call was made with, regardless of any internal routing.
- **Calling `embed()` 100 times in parallel** instead of `embedMany()`: blows past Vercel's per-instance HTTP socket budget and bypasses the Gateway's batch pricing optimization.
- **Adding the tsvector column via `Unsupported("tsvector")` in Prisma schema:** Prisma 6.7+ has a known bug (issue #27186) preventing the search operator on `Unsupported("tsvector")`. Keep the column entirely outside the Prisma schema — only the raw SQL migration knows about it. Query it via `$queryRaw` in Phase 4.
- **Running `prisma migrate reset` after applying manual-indexes.sql:** This wipes the database AND the manual indexes. Developers must re-run `bun db:indexes` after every reset. Document loudly in CLAUDE.md.
- **Using `<#>` (negative inner product) operator for cosine queries:** It requires normalized vectors and pgvector + OpenAI text-embedding-3-small does NOT normalize. Use `<=>` (cosine distance) as the safe operator [CITED: PITFALLS.md §Pitfall 2].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch embedding HTTP requests | Custom `Promise.all` over single-embedding calls | `embedMany` from `ai` package | Gateway-side batching, single HTTP roundtrip, future-proof for partial-failure semantics |
| Retry on rate limit | Custom exponential backoff loop in `embedBatch` | `maxRetries: 2` on embedMany + Inngest step retries (3) | Two layers of retry is enough; more is just amplification |
| tsvector recompute trigger | `CREATE TRIGGER ... FOR EACH ROW EXECUTE FUNCTION ...` | `GENERATED ALWAYS AS (...) STORED` column | Postgres 12+ generated columns are the modern replacement; one source of truth in the column definition |
| HNSW index management | Custom Node script that issues `CREATE INDEX` via Prisma client | `psql -f db/manual-indexes.sql` | psql is the canonical tool; matches existing migration pattern (`20260207111413_init` uses raw SQL too) |
| Pinned-model integrity check | Custom comparison code that diffs response model vs expected | Frozen `EMBEDDING_MODEL` constant + NOT NULL DB constraint | Compile-time + DB-time guarantee is stronger than runtime assertion |

**Key insight:** Phase 3 is mostly orchestration of already-established libraries. The only genuinely novel piece of code is `buildSearchableText` (~10 lines) and the iterative-scan helper (~8 lines). Everything else is wiring.

## Runtime State Inventory

> Phase 3 is additive (not a rename/refactor). No runtime state migration needed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `ProductEmbedding` rows exist in dev DBs from earlier scaffolding, but are stub data — none have `modelVersion` populated | None — schema migration adds the column as NOT NULL with no default; dev DBs need `prisma migrate reset` (deferred to Phase 1 destructive-migration precedent). Verify: production DB has zero `ProductEmbedding` rows because sync was never wired to embeddings (verified by reading existing `inngest/functions/sync-products.ts` — no embedding calls present). |
| Live service config | None — AI Gateway provider config is via env var, not stored in UI/DB | None |
| OS-registered state | None | None |
| Secrets/env vars | `AI_GATEWAY_API_KEY` does NOT exist in `.env` — must be added before `EmbeddingService.embed()` will work [VERIFIED: read `.env`] | Add to local `.env` AND to Vercel project env (manual step — planner should add a `checkpoint:human-verify` task) |
| Build artifacts | None | None |

**Important migration note for the planner:** Adding `modelVersion String` (NOT NULL, no default) to `ProductEmbedding` against a table that may have stub rows will fail Prisma's migration step. Two options:

1. **(Recommended for dev parity with Phase 1 precedent)** Phase 3's migration begins with `DELETE FROM product_embeddings;` because rows are dev-only and worthless without `modelVersion`. Document loudly.
2. (Alternative) Add the column nullable, backfill, then alter to NOT NULL — adds two migration files. Not recommended; this is dev-only data.

## Common Pitfalls

### Pitfall 1: `SET LOCAL` doesn't apply because `$transaction([])` array form was used

**What goes wrong:** `prisma.$transaction([prisma.$executeRaw\`SET LOCAL ...\`, prisma.$queryRaw\`SELECT ...\`])` — the SET LOCAL runs in one connection, the SELECT in another. iterative_scan is silently NOT set. Vector queries silently degrade at scale.
**Why it happens:** The array form does NOT wrap a single BEGIN/COMMIT envelope around the statements in a way that guarantees same-connection ordering for `SET LOCAL`. Documented Prisma GitHub limitation.
**How to avoid:** Always use the callback form `prisma.$transaction(async (tx) => { ... })`. Code-review rule: grep for `\$transaction\(\[` in any file touching `hnsw.iterative_scan` and reject.
**Warning signs:** `EXPLAIN ANALYZE` shows `Seq Scan` on `product_embeddings` even though the index exists.
**How Phase 3 mitigates:** Helper `withHnswIterativeScan` uses the callback form internally; consumers can't get this wrong if they go through the helper.

### Pitfall 2: AI Gateway model name silently mutates and corrupts the embedding space

**What goes wrong:** PITFALLS.md §Pitfall 4 — OpenAI doesn't offer dated snapshots for embedding models, so the "pinned ID" you store IS the most-specific name. If OpenAI silently rotates the model behind the same name, all existing embeddings become incomparable to new ones. Search quality degrades silently.
**Why it happens:** Embedding spaces are not interoperable across model versions; even silent backend changes can shift output distribution.
**How to avoid (Phase 3 surface):** Store `EMBEDDING_MODEL` constant in every row's `modelVersion`. This DOES NOT prevent the underlying model from drifting, but it gives a future-Phase migration the option to detect drift (compare stored `modelVersion` to current constant and trigger re-embed) and re-embed everything atomically.
**Warning signs:** Average top-K cosine similarity drops over time without code changes.
**How Phase 3 mitigates:** The NOT NULL `modelVersion` column is the lever for a future Phase-3.x re-embed worker (deferred).

### Pitfall 3: Webhook embed timeout exceeds Shopify's 5s budget

**What goes wrong:** Webhook re-embedding does an HTTPS call to the AI Gateway, which has its own latency (~300ms typical, occasionally 2-3s on slow days). If it stacks on top of HMAC validation + Prisma writes, total handler time can creep toward Shopify's 5s webhook timeout. Shopify retries the webhook, doubling our embedding cost.
**Why it happens:** Synchronous embedding in the webhook handler is what CONTEXT D-02 chose for simplicity; the alternative (fire Inngest event) was rejected to keep search results fresh.
**How to avoid:** Wrap the `embedAndStore` call in a `try/catch` and return 200 to Shopify EVEN ON EMBED FAILURE. The product is already upserted; the embed will reconcile on next manual sync. Log the failure but do not surface to Shopify.
**Warning signs:** Vercel function logs show `Webhook duration > 4s` for `/api/shopify/webhook`. Shopify Partner Dashboard shows webhook retries.
**How Phase 3 mitigates:** The webhook integration code (Pattern 4 above) explicitly catches and logs the embed failure without re-throwing.

### Pitfall 4: `db/manual-indexes.sql` not re-applied after `prisma migrate reset` in dev

**What goes wrong:** Developer runs `bunx prisma migrate reset` (legitimate Phase 1 + 2 workflow), forgets to run `bun db:indexes`. HNSW index is gone, search benchmarks show full table scans. Developer thinks the code is broken.
**Why it happens:** Two-step migration workflow is inherently fragile — easy to forget the second step.
**How to avoid:** (a) Document loudly in CLAUDE.md (already in D-06); (b) consider making `bun dev` print a warning if `product_embeddings_embedding_hnsw_idx` is missing; (c) Phase 3 verification gate should query `pg_indexes` to confirm both manual indexes exist.
**How Phase 3 mitigates:** Plan should add a CLAUDE.md update task + a "verify-indexes-exist" task in the verification gate.

### Pitfall 5: `psql` not on developer machine — `bun db:indexes` fails silently or noisily

**What goes wrong:** `command -v psql` returns empty on this machine. `bun db:indexes` would print "psql: command not found" and exit non-zero. Developer is blocked.
**Why it happens:** Mac users don't get psql with Postgres.app or Homebrew Postgres by default unless they explicitly install libpq.
**How to avoid:** The `db:indexes` script should pre-flight: if psql missing, print a clear install hint (`brew install libpq && brew link --force libpq`). Alternatively, write a small Node script that uses `pg` (already a transitive dep via `@prisma/adapter-pg`) to execute the SQL — works without psql.
**How Phase 3 mitigates:** Planner should choose between (a) psql + clear error message, or (b) Node script using `pg.Client`. The Node script is more portable; psql is more transparent. Recommend Node script for parity with the existing TypeScript-heavy workflow.

### Pitfall 6: `DATABASE_URL` is Accelerate, not Postgres — psql can't connect

**What goes wrong:** Production `DATABASE_URL` is `prisma+postgres://accelerate.prisma-data.net/?api_key=...` (verified in `.env` — currently commented out, but the production deployment uses this shape). psql cannot connect to Accelerate; the URL has no host/db/user/password.
**Why it happens:** Accelerate is an HTTP proxy in front of Postgres, not a Postgres-protocol endpoint.
**How to avoid:** Add a `DIRECT_URL` env var (the raw Postgres connection string, used by Prisma migrate and by `db:indexes`). Add documentation in CLAUDE.md.
**How Phase 3 mitigates:** Planner adds an env-var-docs task + the `db:indexes` script reads `DIRECT_URL` (or falls back to `DATABASE_URL` if it doesn't start with `prisma`).

### Pitfall 7: Iterative scan flag silently ignored on pre-0.8.0 Postgres

**What goes wrong:** Some self-hosted Postgres deployments still ship pgvector 0.7.x. `SET hnsw.iterative_scan = 'relaxed_order'` does NOT error — it just silently does nothing.
**How to avoid:** Verify pgvector version on every target environment at deploy time. Vercel Postgres, Supabase, Neon, AWS RDS all confirmed at 0.8.0+ (verified via vendor docs).
**How Phase 3 mitigates:** Add a one-time verification step in the plan: run `SELECT extversion FROM pg_extension WHERE extname='vector';` and assert `>= '0.8.0'`. This could live in the `db:indexes` script as a pre-flight check.

## Code Examples

### `buildSearchableText` (D-03)

```typescript
// services/search/searchableText.ts
// Source: D-03 in 03-CONTEXT.md

import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';

export function buildSearchableText(product: ProductUpsertInput): string {
  const lines = [
    `Title: ${product.title?.trim() ?? ''}`,
    `Description: ${product.description?.trim() ?? ''}`,
    `Tags: ${(product.tags ?? []).join(', ')}`,
    `Vendor: ${product.vendor?.trim() ?? ''}`,
    `Type: ${product.productType?.trim() ?? ''}`,
    `Options: ${(product.options ?? [])
      .map((o) => `${o.name} (${o.values.join('/')})`)
      .join(', ')}`,
  ];
  return lines.join('\n');
}
```

**Asymmetry note:** Per D-04, the tsvector column does NOT include `options`. The embedding INPUT includes them (covered by semantic search). This is intentional and the planner MUST document the asymmetry in code comments to prevent Phase 4 from accidentally diverging.

### Manual indexes SQL (D-04, D-05, D-06)

```sql
-- db/manual-indexes.sql
--
-- IDEMPOTENT pgvector + tsvector index script.
--
-- IMPORTANT: This file lives OUTSIDE Prisma's migration history because Prisma
-- cannot model `Unsupported("vector")` columns or their indexes (issue #21850).
-- A `prisma migrate dev` cycle DOES NOT drop these indexes (they're invisible to
-- Prisma's schema diff). HOWEVER, `prisma migrate reset` DOES wipe the database,
-- which destroys these indexes. After any reset, re-run `bun db:indexes`.
--
-- Apply via: `bun db:indexes` (package.json script).

-- Extension preamble — safe to re-run.
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index on product_embeddings.embedding (D-05).
-- m=16, ef_construction=64 are pgvector defaults; tuned for <100k vectors.
-- vector_cosine_ops uses cosine distance (`<=>` operator) — matches our
-- non-normalized OpenAI embeddings.
CREATE INDEX IF NOT EXISTS "product_embeddings_embedding_hnsw_idx"
  ON product_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index on the generated tsvector column on products (D-04).
-- The column itself is created in the Prisma migration (ALTER TABLE ... ADD COLUMN
-- "searchVector" tsvector GENERATED ALWAYS AS (...) STORED). This script just
-- ensures the index exists.
CREATE INDEX IF NOT EXISTS "products_searchVector_gin_idx"
  ON products
  USING GIN ("searchVector");
```

### Prisma migration (additive ALTER TABLE only)

```sql
-- prisma/migrations/<ts>_add_embeddings_indexes/migration.sql
-- Generated by: bunx prisma migrate dev --create-only --name add_embeddings_indexes
-- Then HAND-EDITED to add tsvector generated column + modelVersion + searchableText.

-- ProductEmbedding: add modelVersion (NOT NULL — wipe dev rows first, see notes) + searchableText + unique
DELETE FROM product_embeddings;  -- dev-only stub rows; production has none
ALTER TABLE product_embeddings ADD COLUMN "modelVersion" TEXT NOT NULL;
ALTER TABLE product_embeddings ADD COLUMN "searchableText" TEXT NOT NULL;
ALTER TABLE product_embeddings ADD CONSTRAINT "product_embeddings_shop_productShop_productId_key"
  UNIQUE (shop, "productShop", "productId");

-- Products: add searchVector generated column (D-04).
-- Postgres auto-recomputes this on every UPDATE — no application logic needed.
ALTER TABLE products ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(array_to_string(tags, ' '), '') || ' ' ||
      coalesce(vendor, '') || ' ' ||
      coalesce("productType", '')
    ), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
```

### `package.json` `db:indexes` script

Two implementation options for the planner — Node script is more portable:

```json
// Option A — psql (depends on psql installation):
"db:indexes": "psql \"${DIRECT_URL:-$DATABASE_URL}\" -f db/manual-indexes.sql"
```

```json
// Option B — Node script using the existing pg dep (no psql needed):
"db:indexes": "bunx tsx scripts/apply-manual-indexes.ts"
```

Companion Node script for Option B:

```typescript
// scripts/apply-manual-indexes.ts
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import 'dotenv/config';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url || url.startsWith('prisma')) {
  console.error('DIRECT_URL must be a postgresql:// URL (not Accelerate).');
  process.exit(1);
}
const sql = readFileSync('db/manual-indexes.sql', 'utf8');
const client = new Client({ connectionString: url });
await client.connect();
// Pre-flight: verify pgvector >= 0.8.0
const { rows } = await client.query(
  "SELECT extversion FROM pg_extension WHERE extname='vector'",
);
if (!rows[0] || rows[0].extversion < '0.8.0') {
  console.error(`pgvector ${rows[0]?.extversion ?? 'NOT INSTALLED'} — need >= 0.8.0`);
  process.exit(1);
}
await client.query(sql);
console.log('manual indexes applied');
await client.end();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat indexes | HNSW (default since pgvector 0.5) | 2023 | HNSW is the modern default; IVFFlat is legacy |
| Post-filter only (no iterative scan) | `hnsw.iterative_scan = 'relaxed_order'` | pgvector 0.8.0 (Nov 2024) | Iterative scan prevents silent HNSW bypass on filtered queries; mandatory for multi-tenant pgvector at scale |
| Trigger-recomputed tsvector column | Generated `STORED` tsvector column | Postgres 12+ | Single source of truth; no trigger drift |
| `gateway.textEmbeddingModel('openai/...')` typed object | `model: 'openai/text-embedding-3-small'` string | AI SDK v5.0.36+ / v6 | String form is simpler and works through the bundled `gateway` export — no explicit `@ai-sdk/gateway` install |
| `text-embedding-ada-002` (1536-dim, 2022) | `text-embedding-3-small` (1536-dim, Jan 2024) | 2024 | 3-small is cheaper and better-quality; same dimension — drop-in replacement |

**Deprecated/outdated to avoid:**
- `text-embedding-ada-002` — superseded by `text-embedding-3-small`; same dimension count
- Manually-named partial-failure callbacks in embedMany — the SDK doesn't expose them; use try/catch around the whole batch
- `prisma db pull` to sync the manual indexes back into the schema — this would add `Unsupported("vector")` index entries that subsequent migrations would try to recreate and fail. Don't run db pull after applying manual-indexes.sql.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel AI Gateway's gateway provider is the DEFAULT provider when you pass `model: 'openai/text-embedding-3-small'` as a string in AI SDK v6 — no explicit `gateway()` wrapper needed | EMB-01 pattern | [ASSUMED based on AI SDK docs page showing `model: 'openai/text-embedding-3-small'` directly]. If wrong, planner must add `import { gateway } from 'ai'; model: gateway.textEmbeddingModel('openai/...')`. Cost: 2 lines of code. |
| A2 | `embedMany` for AI Gateway is atomic — either all 100 texts return successfully or the call throws (no per-item partial success in the response) | EmbeddingService pattern | [ASSUMED — AI SDK docs do not describe per-item failure responses for embedMany]. If wrong, the discriminated `{ ok, failed }` shape still works; the `ok` array would just be smaller than input length. |
| A3 | Webhook + AI Gateway round trip total is ~300ms typical (CONTEXT D-02 latency claim) | Pitfall 3 | [ASSUMED]. If wrong (e.g., consistently 1-2s), webhook handler could time out at Shopify's 5s limit. Mitigation already in place: try/catch + log + 200. Worst case: embed is sometimes skipped and a future sync reconciles. |
| A4 | Existing `prisma+postgres://accelerate.prisma-data.net/` URL in production is a Prisma Accelerate URL; psql cannot connect to it | Pitfall 6 | [VERIFIED via reading `.env`]. Action: planner must add `DIRECT_URL` env var. |
| A5 | OpenAI does NOT publish dated snapshots for `text-embedding-3-small` and the model name itself is the most-specific identifier | EMB-03 | [VERIFIED via OpenAI community forum thread] — model not pinnable. Storing `'openai/text-embedding-3-small'` IS the correct "pinned" value per EMB-03 intent. |
| A6 | `prisma.$transaction(async (tx) => ...)` callback form opens a real BEGIN/COMMIT envelope on a SINGLE connection through Prisma Accelerate's transaction-mode pooler | EMB-06 | [VERIFIED via Prisma docs + Accelerate connection-pooling docs]. SET LOCAL applies for the duration of the transaction and is gone after COMMIT — exactly what we want. |
| A7 | The pgvector version on the project's target Postgres (currently local dev + a planned Neon/Vercel Postgres production) is >= 0.8.0 | Pitfall 7 | [VERIFIED via vendor docs for Neon, Supabase, AWS RDS, Vercel Postgres — all at 0.8.0+]. Add a pre-flight assertion in the `db:indexes` Node script. |

## Open Questions (RESOLVED)

1. **Q1: Which `db:indexes` implementation does the planner pick — psql or Node script?**
   - What we know: psql is not installed locally; Accelerate URLs don't work with psql in production; Node script needs `pg` package (already transitive via `@prisma/adapter-pg`).
   - What's unclear: Whether `pg` is directly importable without adding it to top-level `package.json` deps.
   - **RESOLVED:** Add `pg` to top-level deps + ship the Node script (Option B). Adopted in plan 03-05 Task 4 (`scripts/apply-manual-indexes.ts`). More portable, runnable in CI without extra setup, matches the project's TypeScript-everywhere ethos.

2. **Q2: Does the planner need a "wipe `product_embeddings` rows on migrate" task or can the additive migration assume zero rows?**
   - What we know: Production has never run an embedding write (sync function does no embedding pre-Phase 3). Dev rows may exist from earlier scaffolding.
   - What's unclear: Whether any developer has manually inserted embedding rows.
   - **RESOLVED:** Include `DELETE FROM product_embeddings;` at the top of the migration. Adopted in plan 03-05 Task 2. Cheaper than the nullable-then-NOT-NULL two-migration dance.

3. **Q3: What's the smoke-test for `withHnswIterativeScan`?**
   - What we know: We can't EXPLAIN ANALYZE without real data; we can't confirm the `SET LOCAL` value persists into the same transaction without observable effect.
   - What's unclear: How to verify the helper "works" without Phase 4's SearchService.
   - **RESOLVED:** Smoke test does `SELECT current_setting('hnsw.iterative_scan', true)` INSIDE the helper's callback and asserts the value equals `'relaxed_order'`. Adopted in plan 03-08 Smoke 3. Proves SET LOCAL ran in the same connection as the subsequent statement, which is the only guarantee Phase 3 needs to provide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ai` package (with bundled gateway) | EmbeddingService | ✓ | 6.0.77 | — |
| `@prisma/adapter-pg` (`pg` transitive) | Node script (Option B) | ✓ | 7.3.0 | — |
| `inngest` | sync function step extension | ✓ | 4.4.0 | — |
| `psql` CLI | db/manual-indexes.sql Option A | ✗ | — | Use Node script (Option B) |
| pgvector ≥ 0.8.0 | HNSW index + iterative_scan | ✓ on Neon/Supabase/AWS/Vercel Postgres (vendor-verified); UNKNOWN on local dev — must check via `SELECT extversion FROM pg_extension` | varies | None — block deploy if < 0.8.0 |
| `AI_GATEWAY_API_KEY` env var | All EmbeddingService calls | ✗ | — | None — EmbeddingService will throw at first call. Planner must add a setup task. |
| `DIRECT_URL` env var | Manual indexes script in production (Accelerate doesn't accept psql/pg) | UNKNOWN — local `.env` has only `DATABASE_URL` set to a direct postgres URL | — | Use `DATABASE_URL` when it starts with `postgresql://`; require `DIRECT_URL` otherwise |

**Missing dependencies with no fallback:**
- `AI_GATEWAY_API_KEY` — must be set in Vercel + local `.env` before any test exercising the EmbeddingService can pass. Planner should add a `checkpoint:human-verify` task at the start of the plan.

**Missing dependencies with fallback:**
- `psql` — Node script (Option B) sidesteps this entirely.
- `DIRECT_URL` — local dev's `DATABASE_URL` is already a direct postgres URL, so works without the new env var. Production deploy needs the var added.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 with jsdom environment |
| Config file | `vitest.config.ts` |
| Quick run command | `bunx vitest run <file>` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMB-01 | `embed(text)` returns 1536-length array | unit | `bunx vitest run services/embeddings/__tests__/EmbeddingService.test.ts` | ❌ Wave 0 |
| EMB-01 | `embedBatch(texts)` returns `{ok, failed}` with one entry per input | unit | (same file) | ❌ Wave 0 |
| EMB-01 | `embed(text)` throws on dimension mismatch | unit | (same file) | ❌ Wave 0 |
| EMB-02 | Inngest embed-batch step continues run when subset of items fail (full-batch failure throws, partial doesn't) | integration | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ✅ extend existing |
| EMB-02 | Embed errors are recorded in `SyncRun.errors[]` tagged with `stage:'embed'` | integration | (same file) | ✅ extend existing |
| EMB-03 | `modelVersion` column on inserted row equals `EMBEDDING_MODEL` constant | unit | `bunx vitest run services/embeddings/__tests__/EmbeddingService.test.ts` (mocked prisma) | ❌ Wave 0 |
| EMB-03 | TypeScript compile check: `EMBEDDING_MODEL` is `as const` | typecheck | `bunx tsc --noEmit` | ✅ existing |
| EMB-04 | `db/manual-indexes.sql` is idempotent — applying twice doesn't error | manual + script | `bun db:indexes && bun db:indexes` | ❌ verification gate |
| EMB-04 | After applying, both indexes exist (`product_embeddings_embedding_hnsw_idx`, `products_searchVector_gin_idx`) | integration | psql/pg query in verification step | ❌ verification gate |
| EMB-04 | tsvector generated column is populated after a row insert | integration | smoke test using Prisma `$queryRaw` | ❌ Wave 0 |
| EMB-06 | `withHnswIterativeScan(cb)` runs cb inside a transaction where `current_setting('hnsw.iterative_scan')` returns `'relaxed_order'` | unit | `bunx vitest run lib/db/__tests__/hnsw.test.ts` (with mocked prisma) — but value of GUC needs real DB; mark as integration | ❌ Wave 0 (integration variant) |
| Webhook | Webhook handler calls `embedAndStore` after upsert and returns 200 even if embed throws | integration | `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` (mocked embed) | ❌ extend or create Wave 0 |

### Sampling Rate

- **Per task commit:** `bunx vitest run <changed-test-file>` (sub-30s)
- **Per wave merge:** `bun test` (full suite)
- **Phase gate:** Full suite green + manual verification of indexes via `\d product_embeddings` + EXPLAIN ANALYZE smoke test

### Wave 0 Gaps

- [ ] `services/embeddings/__tests__/EmbeddingService.test.ts` — covers EMB-01, EMB-03 (mocked `embedMany` + mocked prisma)
- [ ] `services/search/__tests__/searchableText.test.ts` — covers `buildSearchableText` (pure function, easy)
- [ ] `lib/db/__tests__/hnsw.test.ts` — covers `withHnswIterativeScan` mocked-prisma assertions that the callback runs inside `$transaction` and that the SET LOCAL statement is issued first
- [ ] `app/api/shopify/webhook/__tests__/route.test.ts` — may not exist yet; extend or create to cover the new `embedAndStore` integration; mock EmbeddingService entirely
- [ ] Extend `inngest/functions/__tests__/sync-products.test.ts` — add mocks for `EmbeddingService.embedBatch` and assertions for the new step ID `embed-batch-${cursorKey}` and partial-failure behavior

### AI Gateway Mock Pattern

Phase 2 established `vi.hoisted(...)` + `vi.mock('@/...')` for module-level mocks. Apply the same pattern to mock `ai`:

```typescript
const { embedMock, embedManyMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  embedManyMock: vi.fn(),
}));

vi.mock('ai', () => ({
  embed: embedMock,
  embedMany: embedManyMock,
}));
```

Tests then set `embedManyMock.mockResolvedValueOnce({ embeddings: [[0, 1, ...]], usage: { tokens: 50 } })` or `.mockRejectedValueOnce(new Error('rate limit'))` for failure paths. This avoids hitting the real AI Gateway in tests.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (passive) | Shopify session-token Bearer auth on `/api/shopify/webhook` HMAC validation (Phase 2 D-10) — Phase 3 inherits, no new auth surface |
| V3 Session Management | no | No new sessions |
| V4 Access Control | yes | Every embedding write/read MUST filter by `shop` — multi-tenancy invariant from PROJECT.md. EmbeddingService.embedAndStore takes `shop` as first arg (mirrors Phase 1 D-03 repo pattern) |
| V5 Input Validation | yes | `buildSearchableText` accepts ProductUpsertInput (already validated upstream by Phase 2 mapToUpsertInput). Embed text input has no user-control path that hasn't already been sanitized |
| V6 Cryptography | no | No crypto operations in Phase 3 |
| V7 Error Handling | yes | Error messages persisted to `SyncRun.errors[]` MUST NOT include API keys or full payloads (use `err.message`, not the full err object). PROJECT.md constraint: "No secrets in logs anywhere" |
| V8 Data Protection | yes | `searchableText` column stores plaintext product description — same data already in `Product.description`, no new sensitivity. `embedding` is a derived numeric vector — not direct PII |
| V9 Communication | yes | `AI_GATEWAY_API_KEY` MUST be transmitted via env var, never committed. `.env` already in `.gitignore` — verify in plan |
| V13 API & Web Service | yes | Webhook addition (Pattern 4) — must NOT change HMAC validation, must NOT change 200 response contract |

### Known Threat Patterns for Embedding Pipeline

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AI Gateway key leaked in `SyncRun.errors[]` | Information Disclosure | Push `err.message` strings, never the full error object; review `errors[]` writers |
| Cross-tenant embedding leak via missing shop filter | Information Disclosure / Tampering | EmbeddingService.embedAndStore requires `shop` as first arg; all writes are scoped; same for the eventual SearchService read |
| Webhook replay → duplicate embed costs | Repudiation / Denial of Service (cost) | Existing WebhookEvent dedup table (Phase 2 D-10) — Phase 3 inherits free; no new code needed |
| Malicious product description with prompt-injection content | Injection (downstream) | NOT exploitable at Phase 3 — embed model only produces vectors. Becomes a Phase 4+ concern when descriptions reach the chat completion LLM |
| Quadratic embed cost from buggy sync loop | DoS (cost) | Hard cap is Phase 8 (CAP-01..03). For Phase 3, mitigate with EMB-02's per-batch error policy: a runaway loop still costs at most 50 calls × $0.001 = $0.05 per stuck sync |

## Recommended Task Breakdown Hints

> Final task breakdown is the planner's job. These hints surface natural boundaries discovered during research.

Natural ordering (each builds on the previous):

1. **Wave 0** — RED test scaffolds: EmbeddingService.test.ts, searchableText.test.ts, hnsw.test.ts. Set `AI_GATEWAY_API_KEY` placeholder + check-in.
2. `services/search/searchableText.ts` — pure function, fastest to implement and test.
3. `services/embeddings/EmbeddingService.ts` — embed, embedBatch (with `{ok, failed}` shape), embedAndStore. Constants `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS`.
4. Prisma schema edits — `ProductEmbedding.modelVersion`, `searchableText`, `@@unique`. Run `bunx prisma migrate dev --create-only --name add_embeddings_indexes`. Hand-edit the generated SQL to ADD the tsvector generated column ALTER TABLE.
5. **[BLOCKING]** Apply Prisma migration + regenerate client (mirrors Phase 1 Plan 05 and Phase 2 Plan 04 pattern).
6. `lib/db/hnsw.ts` — `withHnswIterativeScan` helper + smoke test (integration test using real Postgres).
7. `db/manual-indexes.sql` + `scripts/apply-manual-indexes.ts` + `package.json` `db:indexes` script.
8. Run `bun db:indexes` against dev DB — verify indexes exist.
9. Extend `inngest/functions/sync-products.ts` with `embed-batch-${cursor}` step. Extend its test file with the new step's coverage.
10. Extend `app/api/shopify/webhook/route.ts` with `embedAndStore` call after upsert. Cover with route test.
11. CLAUDE.md update — document `bun db:indexes`, `AI_GATEWAY_API_KEY`, `DIRECT_URL`.
12. Phase 3 verification gate — `bunx tsc --noEmit` + `bun test` + manual EXPLAIN ANALYZE smoke + ROADMAP/STATE update.

The `[BLOCKING]` step (5) is a hard sequencing constraint — Prisma client must be regenerated before any code that touches `productEmbedding.modelVersion` compiles. This pattern already used in Phase 1 Plan 05 and Phase 2 Plan 04.

## Sources

### Primary (HIGH confidence)

- AI SDK embedMany reference — https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many — exact function signature, response shape (embeddings, usage, providerMetadata, warnings)
- AI SDK Embeddings overview — https://ai-sdk.dev/docs/ai-sdk-core/embeddings — `model: 'openai/text-embedding-3-small'` string form, maxParallelCalls
- AI SDK Providers: AI Gateway — https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway — `AI_GATEWAY_API_KEY` env var default
- Vercel AI Gateway Embeddings docs — https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-compat/embeddings — provider metadata structure
- pgvector 0.8.0 release announcement — https://www.postgresql.org/about/news/pgvector-080-released-2952/ — released Nov 11, 2024; iterative scan feature
- Supabase pgvector HNSW docs — https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes — confirms iterative_scan availability
- AWS RDS pgvector 0.8.0 announcement — https://aws.amazon.com/about-aws/whats-new/2024/11/amazon-rds-for-postgresql-pgvector-080/
- Prisma transactions reference — https://www.prisma.io/docs/orm/prisma-client/queries/transactions — callback form $transaction
- Prisma Accelerate connection pooling — https://www.prisma.io/docs/accelerate/connection-pooling — transaction-mode pooler semantics
- Inngest error handling guide — https://www.inngest.com/docs/guides/error-handling — try/catch around step.run, NonRetriableError
- Prisma + tsvector + pgvector blog — https://medium.com/@chauhananubhav16/bulletproof-full-text-search-fts-in-prisma-with-postgresql-tsvector-without-migration-drift-c421f63aaab3 — generated column pattern + Prisma drift avoidance
- Prisma GitHub issue #27186 — `Unsupported("TSVECTOR")` search operator unavailable — confirms tsvector must stay outside Prisma schema
- OpenAI community thread on text-embedding-3-small version pinning — https://community.openai.com/t/has-text-embedding-3-small-changed/1378078 — confirms no dated snapshots exist

### Secondary (MEDIUM confidence)

- pgvector HNSW benchmarks (instaclustr / Aurora) — confirms 5-30s build time on 5k vectors with m=16 is reasonable
- pgPedia set_config docs — third arg `is_local` semantics
- Prisma GitHub discussion #21580 — single-connection guarantee in $transaction callback form

### Tertiary (LOW confidence — verified against codebase, not external)

- `.env` file inspection — DATABASE_URL shape, AI_GATEWAY_API_KEY absence — VERIFIED via direct read
- `command -v psql` empty — VERIFIED via shell
- All package versions — VERIFIED via package.json direct read

## Metadata

**Confidence breakdown:**

- AI Gateway API surface (EMB-01): HIGH — confirmed against `ai` v6 official docs + AI SDK Gateway provider docs
- pgvector availability + version (EMB-04): HIGH — confirmed against vendor announcement pages for Neon/Supabase/AWS/Azure/GCP
- `SET LOCAL` + Accelerate (EMB-06): MEDIUM — Prisma docs + Accelerate connection-pooling docs say the callback form is single-connection and transaction-mode poolers commit-bound the connection; no integration smoke test done in this research session — Phase 3 must include one
- Model pinning interpretation (EMB-03): HIGH — OpenAI community confirms no dated snapshots for embedding models; CONTEXT.md decision is correct
- Inngest step extension (D-01, EMB-02): HIGH — pattern is identical to Phase 2 D-15 + tests exist in tree
- Webhook pattern (D-02): HIGH — leverages Phase 2 webhook infrastructure verbatim
- Test infrastructure: HIGH — Vitest + vi.hoisted pattern proven in Phase 2 sync-products.test.ts

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (30 days for stable infra; if pgvector ≥ 0.9 ships in that window, re-verify HNSW defaults and iterative_scan syntax)
