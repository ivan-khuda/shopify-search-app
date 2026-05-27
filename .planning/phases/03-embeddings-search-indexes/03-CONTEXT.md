# Phase 3: Embeddings + Search Indexes - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the embedding generation pipeline and database indexes that make hybrid retrieval possible. Phase 3 ships:

1. `EmbeddingService.embed(text)` / `EmbeddingService.embedBatch(texts)` calling Vercel AI Gateway `openai/text-embedding-3-small`
2. A new Inngest step inside Phase 2's `syncProductsFunction` that generates embeddings for each batch
3. Webhook handler addition: synchronous re-embedding after product upsert
4. Prisma schema additions: `ProductEmbedding.modelVersion` (NOT NULL), Product searchable `tsvector` generated column
5. `prisma/migrations/<ts>_add_embeddings_indexes/migration.sql` — additive
6. `db/manual-indexes.sql` — idempotent HNSW + GIN index script (Prisma cannot generate these)
7. `bun db:indexes` package.json script that applies `db/manual-indexes.sql` via `psql`
8. Per-session `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` mechanism (helper to be consumed by Phase 4's SearchService)

5 requirements: EMB-01, EMB-02, EMB-03, EMB-04, EMB-06. EMB-05 (SearchService) and EMB-07 (MOCK_PRODUCTS removal) belong to Phase 4 — do NOT pull them in.

Phase 3 ships **no user-visible UI**. The merchant sees no new flow; they observe a slightly slower sync (embedding API calls add ~200-500ms per 100-product batch) and rows in `product_embeddings` after sync completes.

</domain>

<decisions>
## Implementation Decisions

### Embedding Generation Location (during sync)

- **D-01:** Extend Phase 2's `syncProductsFunction` with a NEW step `embed-batch-${cursor}` placed BETWEEN `upsert-batch-${cursor}` and `persist-cursor-${cursor}` in the existing 3-step batch loop. The function becomes a 4-step-per-batch workflow: `fetch-batch` → `upsert-batch` → `embed-batch` → `persist-cursor`. Each step keeps its deterministic `${cursor || 'start'}` ID so memoization across Vercel timeouts still works. Plan 03's task list will modify `inngest/functions/sync-products.ts` (Phase 2 output) — this is an ADDITIVE change to that file, not a rewrite.
- **D-02:** Webhook re-embedding is INLINE in `/api/shopify/webhook/route.ts`. After `productRepository.upsertProduct(shop, mapped)` for `products/create|update`, the handler calls `EmbeddingService.embedAndStore(shop, product.id, buildSearchableText(mapped))`. This is synchronous (one product per webhook, ~300ms total — well within Shopify's 5s timeout). For `products/delete`, no embedding work needed — the FK cascade from Product to ProductEmbedding deletes the row.

### Searchable Text Composition

- **D-03:** Embed text is a structured concatenation of `title + description + tags + vendor + productType + options`. Format:

  ```
  Title: {title}
  Description: {description}
  Tags: {tags.join(', ')}
  Vendor: {vendor}
  Type: {productType}
  Options: {options.map(o => `${o.name} (${o.values.join('/')})`).join(', ')}
  ```

  Helper `buildSearchableText(product: ProductLike): string` lives in `services/search/searchableText.ts` (new file). Both the sync embed step AND the webhook re-embedding call this helper — single source of truth for what gets embedded.

  `text-embedding-3-small` has 8192 token max input; 99% of Shopify products fit comfortably. If a product's description is unusually long (rare), the call still succeeds; if it truncates the rare overflow product's description by a few words, search quality remains acceptable. No truncation logic needed in V1.

- **D-04:** The `tsvector` generated column uses the same field set as the embedding, but with `setweight` to give title higher rank than description:

  ```sql
  searchVector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags,' '),'') || ' ' ||
                                       coalesce(vendor,'') || ' ' ||
                                       coalesce("productType",'')), 'B') ||
    setweight(to_tsvector('english', coalesce(description,'')), 'C')
  ) STORED
  ```

  Phase 4's `SearchService.hybridSearch` ranks via `ts_rank_cd` over this column. Postgres auto-updates the generated column on every UPDATE — no app-layer logic needed.

  `options` aren't included in the tsvector — they're embedded for semantic search but not full-text searched. Reason: option names ("Size", "Color") are uniformly common across products; their values ("Red", "Large") leak across many products and don't help BM25 ranking. Semantic search captures their meaning via the embedding.

### HNSW + Manual SQL Lifecycle

- **D-05:** HNSW index on `product_embeddings.embedding` uses pgvector defaults: `WITH (m=16, ef_construction=64)` with `vector_cosine_ops` opclass. These defaults are tuned for catalogs under 100k vectors and our 5k V1 target sits comfortably under that. ef_construction=64 builds the index in ~5-30s on the V1 catalog size; m=16 keeps the index memory footprint ~32MB per 5k rows.

- **D-06:** Manual SQL script lives at `db/manual-indexes.sql`. Idempotent shape using `IF NOT EXISTS`:

  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE INDEX IF NOT EXISTS "product_embeddings_embedding_hnsw_idx"
    ON product_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  CREATE INDEX IF NOT EXISTS "products_searchVector_gin_idx"
    ON products USING GIN ("searchVector");
  ```

  Trigger: `bun db:indexes` package.json script that runs `psql "$DATABASE_URL" -f db/manual-indexes.sql`. The developer's workflow becomes:

  ```bash
  bunx prisma migrate dev   # applies Prisma migrations
  bun db:indexes            # applies pgvector-specific indexes Prisma can't generate
  ```

  CLAUDE.md is updated to document this two-step requirement alongside the existing Prisma commands.

  No postinstall hook (the script would fail on CI/Vercel builds where DATABASE_URL points at a non-readable instance). No Inngest cron (overkill for an idempotent index-create).

  CRITICAL Pitfall mitigation: per `research/PITFALLS.md` "Prisma drops HNSW indexes" — Prisma's drift detection sees indexes it didn't create and adds them to the next migration's planned changes. The fix: include `db/manual-indexes.sql` execution in CI/post-migrate workflow, AND add a comment block at the top of the script explaining why these indexes live outside Prisma's ownership.

### Embedding Batching + Error Policy

- **D-07:** Embedding batch size = **100 inputs per Vercel AI Gateway call**, matching Phase 2's sync batch size (D-02). The `embed-batch-${cursor}` step receives a 100-product batch from `upsert-batch`, builds 100 searchable strings, and calls `EmbeddingService.embedBatch(texts)` → a single AI Gateway request with `inputs: string[]`. 5k catalog = ~50 batches = 50 AI Gateway calls = ~$0.05 per full sync at text-embedding-3-small pricing ($0.02/M tokens, ~50 tokens average per concatenated product).

- **D-08:** Per-batch try/catch policy (mirrors Phase 2 D-15). The `embed-batch` step body:
  1. Builds searchable text for each product in the upserted batch
  2. Calls `EmbeddingService.embedBatch(texts)` inside a try/catch
  3. On full-batch failure (network error, rate limit, gateway 5xx): throws → Inngest auto-retries the step. After 3 retries exhausted, the failure propagates to `onFailure` which marks `SyncRun.state='failed'`.
  4. On partial success (Vercel AI Gateway returns mixed results in the response — `text-embedding-3-small` actually doesn't do partial response per call, but if a future model does): persists successes via `prisma.productEmbedding.upsert` for each, writes failed productIds to `SyncRun.errors[]` as `JSON.stringify({productId, message})`. Returns without throwing.
  5. The store step uses `upsert` (not `create`) keyed on `(shop, productShop, productId)` — re-embedding the same product overwrites rather than duplicating.

  Inngest auto-retry handles transient rate limits; we don't add a custom exponential-backoff loop inside the step (D-15 in Phase 2 made the same choice and it works).

### Embedding Service Interface

- **D-09:** New file `services/embeddings/EmbeddingService.ts` exports:

  ```ts
  export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
  export const EMBEDDING_DIMENSIONS = 1536;

  export async function embed(text: string): Promise<number[]>;
  export async function embedBatch(texts: string[]): Promise<number[][]>;
  export async function embedAndStore(
    shop: string,
    productId: number,
    text: string,
  ): Promise<void>;  // wraps embed + prisma.productEmbedding.upsert
  ```

  Uses Vercel AI Gateway via `import { embed, embedMany } from 'ai'` and `import { gateway } from '@ai-sdk/gateway'`. Plan 03 confirms the exact 4.x syntax via Context7 (already used in Phase 2 research).

  `EMBEDDING_MODEL` is a frozen constant so the version is pinned to `openai/text-embedding-3-small` (full alias-free model ID per EMB-03). Future model upgrades = explicit code change + re-embed migration + bumped constant value.

### ProductEmbedding Schema Addition

- **D-10:** `ProductEmbedding` model gains:
  - `modelVersion String` — NOT NULL, no default. Future model upgrades require a backfill migration before the column can store the new value.
  - `searchableText String @db.Text` — the exact text that was embedded. Diagnostics + future re-embeds can compare current `buildSearchableText` output against stored value to detect "needs re-embedding" without doing the actual embed call.

  Schema also gains `@@unique([shop, productShop, productId])` so `productRepository`-style upserts work cleanly. Plan 03's migration is ADDITIVE (no DROP) — `shop`, `productShop`, `productId` were already in the model from Phase 1.

### iterative_scan Mechanism

- **D-11:** `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` is applied per-query via a `withHnswIterativeScan(callback)` helper exported from `lib/db/client.ts` (or a new `lib/db/hnsw.ts`). The helper wraps the callback in `prisma.$transaction` and issues `await tx.$executeRaw\`SET LOCAL hnsw.iterative_scan = 'relaxed_order'\`` as the first statement.

  This is consumed by Phase 4's `SearchService.hybridSearch`. Phase 3 ships the helper + a smoke test confirming the `SET LOCAL` lands in the same transaction as the subsequent query.

  Per RESEARCH.md PITFALLS: without this flag, when `WHERE shop = $1` reduces selectivity enough that PostgreSQL's planner thinks a seq scan beats HNSW, HNSW is silently bypassed — the search returns correct results but is 10-100x slower at scale. Phase 4's tests will EXPLAIN ANALYZE a real query to verify HNSW is used.

### Claude's Discretion

- Whether `EmbeddingService.embedBatch` returns `(number[] | null)[]` (per-input null on partial failure) or a `{ ok: { idx: number, vector: number[] }[], failed: { idx: number, message: string }[] }` discriminated result. Plan 03's planner picks the cleaner shape after inspecting the `ai` package's actual response.
- Whether the manual-indexes.sql script also includes the `CREATE EXTENSION IF NOT EXISTS vector` line (already present from Phase 1's destructive migration; including it is idempotent harmless).
- Whether to add an `EMBEDDING_DIMENSIONS` schema check (CHECK constraint on column length) — defensive but rarely worth the migration cost.
- Whether the `searchableText` helper trims leading/trailing whitespace per field (`title?.trim() ?? ''`) — likely yes, but format details are implementer's call.
- Whether `bun db:indexes` is `bun run db:indexes` (npm-script call) or a direct binary. Both work; package.json convention rules.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — V1 scope, "Vercel AI Gateway is the sole runtime entry point for chat completions and embeddings" constraint, multi-tenancy locks
- `.planning/REQUIREMENTS.md` — EMB-01..04 + EMB-06 are this phase's formal requirements
- `.planning/ROADMAP.md` §"Phase 3: Embeddings + Search Indexes" — phase goal, 4 success criteria, depends_on: Phase 2

### Research (Phase 1 era + Phase 2 refinements)
- `.planning/research/STACK.md` — `openai/text-embedding-3-small` 1536-dim + cost; pgvector HNSW + tsvector RRF pattern; `@ai-sdk/gateway` usage
- `.planning/research/ARCHITECTURE.md` §"Embedding pipeline" + §"Hybrid search service" — modelVersion column, batched gen, iterative_scan flag
- `.planning/research/PITFALLS.md` §"pgvector pitfalls" — HNSW silent-bypass on shop-filter; Prisma drops HNSW indexes; embedding model version drift; `hnsw.iterative_scan` per-session activation

### Phase 1 Outputs (load-bearing handoffs)
- `.planning/phases/01-foundation/01-CONTEXT.md` §"D-03" — repository methods take `shop` first (`EmbeddingService.embedAndStore` follows this contract)
- `prisma/schema.prisma` — `ProductEmbedding` model already has `shop`, `productShop`, `productId`, `content`, `embedding Unsupported("vector")?`. Phase 3 adds columns; no recreate.

### Phase 2 Outputs (load-bearing handoffs)
- `.planning/phases/02-sync-pipeline/02-CONTEXT.md` §"D-01" — Inngest 3-step batch loop (Phase 3 extends to 4 steps); §"D-15" — error-policy precedent
- `.planning/phases/02-sync-pipeline/02-RESEARCH.md` §"Q1 RESOLVED" — Inngest createFunction 2-arg signature; `InngestTestEngine.execute` semantics
- `inngest/functions/sync-products.ts` (Phase 2 Plan 06) — the file Phase 3 EXTENDS with a fourth step inside the batch loop
- `app/api/shopify/webhook/route.ts` (Phase 2 Plan 09) — the file Phase 3 EXTENDS with `embedAndStore` call after upsert
- `lib/db/client.ts` (Phase 1, Phase 2 Prisma 7 adapter-pg wiring) — Phase 3's `withHnswIterativeScan` helper consumes `prisma.$transaction` from this client
- `services/shopify/ShopifyProductService.ts` (Phase 2 Plan 05) — `mapToUpsertInput` output shape feeds into `buildSearchableText`

### External Docs (verify via Context7 during plan-phase)
- Vercel AI SDK 6.x `embed`/`embedMany` from `ai` package — exact signatures (returns `{ embedding }` or `{ embeddings }`) and how `@ai-sdk/gateway` plugs in as the provider
- pgvector docs: HNSW index options + `hnsw.iterative_scan` runtime setting (introduced in pgvector 0.8)
- PostgreSQL tsvector + setweight + ts_rank_cd reference
- Prisma 7 generated tsvector column support (alternative: raw SQL ALTER TABLE)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inngest/functions/sync-products.ts` — Phase 3 inserts a step here; the existing 3-step loop pattern is the template.
- `app/api/shopify/webhook/route.ts` — Phase 3 adds 2 lines after `upsertProduct` to call `embedAndStore`.
- `lib/db/client.ts` `prisma` singleton — `withHnswIterativeScan` helper wraps `prisma.$transaction`.
- `services/shopify/ShopifyProductService.ts:mapToUpsertInput` — output shape feeds `buildSearchableText`.
- `productRepository.upsertProduct`'s composite (shop, id) FK pattern — `ProductEmbedding.upsert` reuses this multi-tenant guarantee.
- Phase 2's Vitest mock pattern (`vi.hoisted` + class-mock for GraphQL constructor) — same pattern for Vercel AI SDK mock in Phase 3 tests.

### Established Patterns
- Singleton client exports (`prisma`, `shopifyClient`, `inngest`) — `EmbeddingService` exports plain async functions instead (no statefulness needed beyond the gateway client).
- Per-product try/catch + `SyncRun.errors[]` push (Phase 2 D-15) — Phase 3 reuses exactly.
- Step IDs deterministic by cursor (Phase 2 D-01) — Phase 3's new step ID `embed-batch-${cursor || 'start'}` follows the same pattern.
- `bunx tsc --noEmit` for Phase X surface verification — ambient `shopify` and unrelated `reasoning.tsx` errors documented as out-of-scope.

### Integration Points
- `prisma.productEmbedding.upsert` — new write path. The upsert keys on `(shop, productShop, productId)` composite unique.
- `EmbeddingService.embedAndStore` — webhook → embedding pipeline.
- `db/manual-indexes.sql` + `bun db:indexes` — index materialization layer; CLAUDE.md update.
- `withHnswIterativeScan` helper — Phase 4 SearchService is the primary consumer.
- `EMBEDDING_MODEL` + `EMBEDDING_DIMENSIONS` constants — Phase 4 SearchService reads these for query vector size validation.

</code_context>

<specifics>
## Specific Ideas

- The 4-step Inngest pattern (fetch / upsert / embed / persist-cursor) doubles step.run calls per batch (40 → 50 step calls per 5k catalog). Still well below Inngest free-tier quotas (50k step.run/month).
- `EMBEDDING_MODEL = 'openai/text-embedding-3-small'` is the literal value stored in `ProductEmbedding.modelVersion` for every row. Future model upgrades change this constant AND require a backfill migration (out of scope V1).
- The `searchableText` field in `ProductEmbedding` is for diagnostics: tomorrow's developer can grep "what did we actually embed?" without rebuilding the input.
- Generated `tsvector` column is faster than runtime `to_tsvector` because Postgres precomputes it on every UPDATE. The slight write-time cost (~50µs per product) is dwarfed by the read-time savings.
- `bun db:indexes` is a thin wrapper around `psql "$DATABASE_URL" -f db/manual-indexes.sql`. No JS, no `prisma`, no bundler — just psql + SQL. Keeps the index layer transparent for debugging.

</specifics>

<deferred>
## Deferred Ideas

- **Re-embed worker** — Phase 3 doesn't ship a "re-embed all products" CLI. It's deferred to a Phase 3.x admin action (or a Phase 5+ "model upgrade" Inngest cron) when a new embedding model is adopted.
- **Multimodal embeddings (text + image via CLIP)** — globally Out of Scope per PROJECT.md; revisit when targeting fashion vertical.
- **Embedding-cost dashboard** — observability into per-shop token spend; Phase 8's Hard Cap milestone is the natural home.
- **Truncation logic for products with >8192-token descriptions** — rare edge case; revisit if a real catalog trips it.
- **CHECK constraint on `ProductEmbedding.embedding` dimensions** — defensive but adds migration cost; runtime assertion via `assert(vec.length === 1536)` in service is enough V1.
- **Per-product `step.run` for max retry control** — overkill for 5k SKU; batch-level (D-08) is sufficient.
- **Adaptive batch size based on Vercel AI Gateway rate-limit headers** — V1 sticks with constant 100; revisit on profiling.
- **Pre-warmed embeddings cache (Redis)** — repeated queries don't re-embed identical text. V1 doesn't have a query-cache layer; revisit at scale.
- **Vector store provider abstraction** — Pinecone/Weaviate adapter behind `EmbeddingService` interface. Out of scope; pgvector + HNSW is the locked V1 path.
- **Embedding model A/B testing** — comparing different models on the same catalog. V1 ships one model; A/B is V2+.
- **`searchableText` content-hash dedup** — skip embedding when text hasn't changed (e.g., webhook update with only price changed). Plausible perf win but adds hash-column complexity. Revisit if webhook embed cost becomes meaningful.

</deferred>

---

*Phase: 3-Embeddings + Search Indexes*
*Context gathered: 2026-05-25*
