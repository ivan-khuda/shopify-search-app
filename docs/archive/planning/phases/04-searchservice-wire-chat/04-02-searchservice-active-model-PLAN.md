---
phase: 04-searchservice-wire-chat
plan: 02
type: execute
wave: 2
depends_on:
  - 04-01
files_modified:
  - services/search/SearchService.ts
  - services/chat/getActiveChatModel.ts
autonomous: true
requirements:
  - EMB-05
  - ADM-05
must_haves:
  truths:
    - "Calling SearchService.hybridSearch(shop, query) returns up to 10 ChatProduct objects sourced from the merchant's real products + product_embeddings tables, scoped to that shop"
    - "D-01: Hybrid retrieval fuses pgvector cosine-distance ranking and tsvector websearch_to_tsquery ranking using pure RRF (k=60, 1-based ranks, no weights) into a single ranked result list"
    - "D-02: SearchService exports RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10 as named constants at the top of the file (each retriever returns top 50 candidates before fusion; final result list returns top 10 products)"
    - "Both retriever branches WHERE-filter on shop explicitly (defense-in-depth per D-03); the LLM cannot influence the shop parameter"
    - "Empty / whitespace-only queries return [] without calling AI Gateway (cost + correctness short-circuit)"
    - "D-07: Phase 4 ships price-only structured filters (no tags/vendor/inStock/size/color) — the LLM extracts priceMin/priceMax via the Zod schema only; SearchService trusts the typed args and does not re-parse"
    - "D-08: SearchService applies the price filter via a CTE joining product_variants and filtering on MIN(variants.price) per product; products with no variants are excluded when a price filter is set; the CTE/join is skipped entirely when no price filter is supplied (no join cost paid)"
    - "A query whose terms match only the lexical branch (no semantic match, e.g., a brand SKU or exact-token search) returns at least one product via the RRF `lex_ranked` branch — empirical verification deferred to Plan 04-06 brand-name smoke (ROADMAP Phase 4 success criterion #4). This truth proves BM25/tsvector contributes to RRF; pure vector retrieval would not necessarily surface brand-token-only queries."
    - "getActiveChatModel(shop) returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' } for any shop in Phase 4 (Phase 7 will swap the body to read ShopSettings)"
    - "The unit-test suite from 04-01 turns GREEN for SearchService and getActiveChatModel"
  artifacts:
    - path: "services/search/SearchService.ts"
      provides: "hybridSearch(shop, query, opts) entry point + RRF_K, BRANCH_LIMIT, RESULT_LIMIT named exports"
      exports: ["hybridSearch", "RRF_K", "BRANCH_LIMIT", "RESULT_LIMIT"]
      contains: "export async function hybridSearch"
      min_lines: 100
    - path: "services/chat/getActiveChatModel.ts"
      provides: "Phase 4 stub for active model (Phase 7 body-only swap target)"
      exports: ["getActiveChatModel", "ActiveChatModel"]
      contains: "google/gemini-2.5-flash"
      min_lines: 20
  key_links:
    - from: "services/search/SearchService.ts"
      to: "services/embeddings/EmbeddingService.ts"
      via: "import { embed } from '@/services/embeddings/EmbeddingService'"
      pattern: "from '@/services/embeddings/EmbeddingService'"
    - from: "services/search/SearchService.ts"
      to: "lib/db/hnsw.ts"
      via: "import { withHnswIterativeScan } from '@/lib/db/hnsw'"
      pattern: "from '@/lib/db/hnsw'"
    - from: "services/search/SearchService.ts"
      to: "PostgreSQL pgvector + tsvector"
      via: "tx.$queryRaw with vec_ranked + lex_ranked + fused CTEs"
      pattern: "WITH vec_ranked AS"
---

<objective>
Land the two foundational services Phase 4 depends on: `SearchService.hybridSearch(shop, query, opts)` (EMB-05) and `getActiveChatModel(shop)` (ADM-05 / D-09). Both are parallel-safe within this plan because they touch disjoint files and have zero cross-dependency. They turn the 04-01 RED tests for `services/search/` and `services/chat/` GREEN. They unblock plans 04-03 (tool execute closure) and 04-04 (proxy stub) which both import `hybridSearch`.

Purpose: This is the data-access core of the phase. Every later wave assumes `hybridSearch` exists and behaves per the EMB-05 contract. The shop-first signature and the explicit double-WHERE shop filter are the multi-tenancy guarantee that PROJECT.md locks at the database layer.

Output:
1. `services/search/SearchService.ts` — full hybrid retrieval implementation using SQL-side RRF (Shape A per RESEARCH.md Open Question 1), explicit shop scoping, optional price-filter CTE, empty-query short-circuit, projection of `RankedProductRow` → `ChatProduct`.
2. `services/chat/getActiveChatModel.ts` — Phase 7 contract-anchor stub returning the hardcoded Gemini 2.5 Flash AI Gateway model.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md
@.planning/phases/04-searchservice-wire-chat/04-RESEARCH.md
@.planning/phases/04-searchservice-wire-chat/04-PATTERNS.md
@services/embeddings/EmbeddingService.ts
@services/search/searchableText.ts
@lib/db/hnsw.ts
@lib/db/repositories/ProductRepository.ts
@prisma/schema.prisma
@types/product.ts

<interfaces>
<!-- Existing exports the new services consume. Sourced from Phase 3 outputs + Prisma schema. -->

From services/embeddings/EmbeddingService.ts (Phase 3 — DO NOT MODIFY):
```typescript
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;
export async function embed(text: string): Promise<number[]>;
// Throws if dimensions !== 1536 (guard built in; do not re-wrap)
```

From lib/db/hnsw.ts (Phase 3 — DO NOT MODIFY):
```typescript
import type { Prisma } from '@/app/generated/prisma/client';
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T>;
// Sets SET LOCAL hnsw.iterative_scan = 'relaxed_order' for the transaction.
```

From prisma/schema.prisma (Phase 1–3 — DO NOT MODIFY):
- Table `products`: columns (shop text, id int, title text, description text?, handle text, status text — 'ACTIVE'/'ARCHIVED'/'DRAFT', priceMin Decimal?, priceMax Decimal?, tags text[], vendor text?, productType text?, searchVector tsvector — generated column with GIN index)
- Table `product_embeddings`: columns (shop text, productShop text, productId int, content text, embedding vector(1536), modelVersion text)
- Table `product_variants`: columns (shop text, productShop text, productId int, id int, price Decimal)
- Table `product_images`: columns (shop text, productShop text, productId int, url text, position int)

From types/product.ts:
```typescript
export interface ChatProduct {
  id: string;
  title: string;
  price: string;
  description: string;
  image?: string;
  category?: string;
  tags?: string[];
}
```

From services/search/searchableText.ts (Phase 3 — CONSULTED, NOT CALLED at query time):
```typescript
// Document this asymmetry but do not invoke at query time:
// The tsvector column (db.manual-indexes.sql) is composed without `options`.
// Embeddings include `options`. SearchService consults this only to understand
// the asymmetry; query-time call is just the user's natural-language string.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create services/search/SearchService.ts implementing hybridSearch with SQL-side RRF</name>
  <files>services/search/SearchService.ts</files>
  <read_first>
    - services/embeddings/EmbeddingService.ts (canonical: imports of `embedSdk` from 'ai', module-level frozen constants, vector-literal cast `${vectorLiteral}::vector`, error-message-only catch block, shop-scoping via `${shop}` parameter in $executeRaw)
    - lib/db/hnsw.ts (mandatory wrapper — withHnswIterativeScan callback signature and the SET LOCAL semantics)
    - services/search/searchableText.ts (read the asymmetry doc-block at lines 3-22; replicate the lock-block tone in SearchService.ts header)
    - lib/db/repositories/ProductRepository.ts (shop-first method signature pattern at lines 167-173)
    - prisma/schema.prisma (lines 1-90 — confirm column names: shop, productShop, productId, searchVector, status, priceMin, priceMax, tags, vendor, productType; product_images.position; product_variants.price)
    - services/search/__tests__/SearchService.test.ts (the RED scaffold from 04-01 — this file IS the executable spec; every assertion in it must pass after this task)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax / Code Excerpts" §3 (the full SQL shape) and §4 (RankedProductRow → ChatProduct projection) and §"Pitfalls" Pitfall 2 (vector literal SQL injection — server-trusted numerics only), Pitfall 4 (empty-query short-circuit before embed), Pitfall 3 (HNSW selectivity at small N — tests mock, do not EXPLAIN)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §Decisions D-01 (pure RRF k=60), D-02 (50+50→10 constants), D-03 (single withHnswIterativeScan transaction, both branches WHERE shop = $1), D-07 (price-only structured filters), D-08 (MIN(variants.price) CTE)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"services/search/SearchService.ts" + §"Shared Patterns / Shop-scoping via raw SQL with explicit ${shop} parameter" + §"Shared Patterns / Error handling — no token/secret leakage to logs"
  </read_first>
  <behavior>
    - hybridSearch('shop.myshopify.com', '', opts={}) returns [] without calling embed
    - hybridSearch('shop.myshopify.com', '   \n\t', opts={}) returns []
    - hybridSearch('shop.myshopify.com', 'shoes') calls EmbeddingService.embed exactly once with 'shoes' (trimmed)
    - hybridSearch wraps the query in withHnswIterativeScan callback (mandatory per D-03)
    - $queryRaw SQL contains: WITH vec_ranked AS / lex_ranked AS / fused AS, the cosine distance op `<=>`, `::vector` cast, `websearch_to_tsquery('english', ...)`, `ts_rank_cd`, `p.status = 'ACTIVE'`, and explicit `pe.shop = $shop AND p.shop = $shop` in vec_ranked, `p.shop = $shop` in lex_ranked
    - The `lex_ranked` CTE alone (independent of vector branch contribution) is structurally capable of producing a candidate that survives RRF fusion: e.g., a brand-name or SKU query whose tokens hit `searchVector` via `websearch_to_tsquery` but whose embedding is dissimilar will still appear in the fused output by virtue of the lexical-branch rank. This structural property is what ROADMAP Phase 4 SC #4 (Plan 04-06 brand-name smoke) verifies empirically against a live catalog.
    - SQL does NOT contain the inner-product `<#>` operator (cosine, not inner-product)
    - When opts.priceMin and opts.priceMax are both undefined, the SQL does NOT include a join on product_variants / MIN(price)
    - When either priceMin OR priceMax is provided, the SQL includes the price-filter CTE/join referencing product_variants, MIN(price), GROUP BY, and HAVING with the supplied bounds (defaults 0 and Number.MAX_SAFE_INTEGER for the missing side)
    - Result is projected via toChatProduct: id is String(row.id), image is undefined when row.image is null, price is `$${min} – $${max}` with en-dash U+2013 when min !== max (single value `$${n.toFixed(2)}` when equal, empty string when both null)
    - When $queryRaw throws, the function returns [] (no propagation, no secret in log — only err.message is logged)
    - Exports: hybridSearch, RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10
  </behavior>
  <action>
    Create `services/search/SearchService.ts` per D-01..D-08, EMB-05, PATTERNS map. Implementation choices:

    File header — JSDoc block mirroring EmbeddingService.ts lines 1-23. Cite EMB-05, EMB-07 (the consumer side), D-01..D-08. Include explicit notes:
    - Multi-tenancy: WHERE shop = $1 enforced in BOTH retriever branches (D-03 defense-in-depth). LLM never controls shop.
    - Security (T-04-01 from threat model): query string passed through Prisma tagged-template binding; vector literal is server-trusted numerics only (re-uses EmbeddingService.embed output); no string concatenation of user query into SQL.
    - No-secrets-in-logs: catch block logs only err.message (CLAUDE.md security constraint).

    Imports (in this exact order):
    - `import { Prisma } from '@/app/generated/prisma/client';`
    - `import { embed } from '@/services/embeddings/EmbeddingService';`
    - `import { withHnswIterativeScan } from '@/lib/db/hnsw';`
    - `import type { ChatProduct } from '@/types/product';`

    Module-level frozen constants (after imports, with `as const`):
    - `export const RRF_K = 60 as const;`
    - `export const BRANCH_LIMIT = 50 as const;`
    - `export const RESULT_LIMIT = 10 as const;`

    Internal type:
    - `interface HybridOpts { priceMin?: number; priceMax?: number; }`
    - `interface RankedProductRow { id: number; title: string; description: string | null; handle: string; priceMin: string | null; priceMax: string | null; tags: string[]; vendor: string | null; productType: string | null; image: string | null; rrf_score: number; }` (Decimal serialized as string from Prisma raw queries)

    Function `hybridSearch(shop: string, query: string, opts: HybridOpts = {}): Promise<ChatProduct[]>`:

    Step 1 — Short-circuit empty/whitespace queries: `const trimmed = query.trim(); if (!trimmed) return [];` (FIRST statement; before embed call, before any DB call — Pitfall 4 lock).

    Step 2 — Get the query vector: `const queryVector = await embed(trimmed);` and assemble `const vectorLiteral = \`[${queryVector.join(',')}]\`;`. Per Pitfall 2: numerics-only is safe; never apply this pattern to a user string.

    Step 3 — Compute price-filter parameters: `const hasPrice = opts.priceMin !== undefined || opts.priceMax !== undefined;`. When `hasPrice`: `const priceMin = opts.priceMin ?? 0; const priceMax = opts.priceMax ?? Number.MAX_SAFE_INTEGER;`.

    Step 4 — Compose the optional price-join SQL fragment as a Prisma.sql template literal: when `hasPrice` it is the `INNER JOIN ( SELECT "productShop", "productId", MIN(price) AS min_price FROM product_variants WHERE shop = ${shop} GROUP BY "productShop", "productId" HAVING MIN(price) >= ${priceMin} AND MIN(price) <= ${priceMax} ) pf ON pf."productShop" = p.shop AND pf."productId" = p.id`. When `!hasPrice`: `Prisma.sql\`\`` (empty fragment). Note: if Assumption A10 fails (nested empty `Prisma.sql\`\`` not supported), fall back to two parallel `$queryRaw` template literals selected by `hasPrice` (one with priceJoin, one without) — both compile-tested.

    Step 5 — Execute the hybrid query inside `withHnswIterativeScan(async (tx) => { return tx.$queryRaw<RankedProductRow[]>\`...\`; })`. SQL skeleton (verbatim structure per RESEARCH.md §3 Shape A):
    - `WITH vec_ranked AS ( SELECT p.id, ROW_NUMBER() OVER (ORDER BY pe.embedding <=> ${vectorLiteral}::vector) AS rank FROM product_embeddings pe INNER JOIN products p ON p.shop = pe."productShop" AND p.id = pe."productId" ${priceJoin} WHERE pe.shop = ${shop} AND p.shop = ${shop} AND p.status = 'ACTIVE' ORDER BY pe.embedding <=> ${vectorLiteral}::vector LIMIT ${BRANCH_LIMIT} )`
    - `, lex_ranked AS ( SELECT p.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC) AS rank FROM products p ${priceJoin} WHERE p.shop = ${shop} AND p.status = 'ACTIVE' AND p."searchVector" @@ websearch_to_tsquery('english', ${trimmed}) ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC LIMIT ${BRANCH_LIMIT} )`
    - `, fused AS ( SELECT id, SUM(1.0 / (${RRF_K} + rank)) AS rrf_score FROM ( SELECT id, rank FROM vec_ranked UNION ALL SELECT id, rank FROM lex_ranked ) combined GROUP BY id ORDER BY rrf_score DESC LIMIT ${RESULT_LIMIT} )`
    - Outer SELECT joining fused to products to hydrate the row shape, with a correlated subquery for the first image: `SELECT p.id, p.title, p.description, p.handle, p."priceMin" AS "priceMin", p."priceMax" AS "priceMax", p.tags, p.vendor, p."productType" AS "productType", (SELECT url FROM product_images WHERE "productShop" = p.shop AND "productId" = p.id ORDER BY position ASC LIMIT 1) AS image, f.rrf_score FROM fused f INNER JOIN products p ON p.shop = ${shop} AND p.id = f.id ORDER BY f.rrf_score DESC`

    Step 6 — Wrap the query in a try/catch. On catch: extract `const message = err instanceof Error ? err.message : String(err);` then `console.error('[SearchService] hybridSearch failed:', message);` then `return [];`. NEVER log the full err object, headers, the user's query, or the shop name (per CLAUDE.md "No secrets, no session tokens, no auth headers in logs"). The user query is treated as PII per RESEARCH.md security row "Logging user messages (PII risk)".

    Step 7 — Project rows to ChatProduct via private helpers:
    - `function toChatProduct(row: RankedProductRow): ChatProduct` → returns `{ id: String(row.id), title: row.title, description: row.description ?? '', image: row.image ?? undefined, category: row.productType ?? undefined, tags: row.tags, price: formatPriceRange(row.priceMin, row.priceMax) }`
    - `function formatPriceRange(min: string | null, max: string | null): string` → if both null, return ''; parse both as floats; if min === max numerically, return `$${parseFloat(min!).toFixed(2)}`; otherwise return `$${parseFloat(min!).toFixed(2)} – $${parseFloat(max!).toFixed(2)}` using the en-dash character U+2013 (` – `, NOT a hyphen `-`).

    Type Note: pin `ChatProduct.id` to string per RESEARCH.md §4 Note ("MOCK_PRODUCTS used string IDs; do not introduce a type-rename ripple in Phase 4"). The Decimal-to-string serialization from Prisma raw queries is the expected shape.

    Return: `rows.map(toChatProduct)` from the successful path.

    All assertions in `services/search/__tests__/SearchService.test.ts` (the RED scaffold) must pass after this task lands.
  </action>
  <verify>
    <automated>bunx vitest run services/search/__tests__/SearchService.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File services/search/SearchService.ts EXISTS
    - Command `grep -c "export async function hybridSearch" services/search/SearchService.ts` returns 1
    - Command `grep -c "export const RRF_K = 60" services/search/SearchService.ts` returns 1
    - Command `grep -c "export const BRANCH_LIMIT = 50" services/search/SearchService.ts` returns 1
    - Command `grep -c "export const RESULT_LIMIT = 10" services/search/SearchService.ts` returns 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "import { embed } from '@/services/embeddings/EmbeddingService'"` returns 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "withHnswIterativeScan"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "WITH vec_ranked AS"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "lex_ranked AS"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "fused AS"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "websearch_to_tsquery"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "ts_rank_cd"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "p.status = 'ACTIVE'"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "::vector"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "<=>"` returns at least 1
    - Command `grep -v '^//\|^[[:space:]]*\*\|^[[:space:]]*//' services/search/SearchService.ts | grep -c "<#>"` returns 0 (must NOT contain inner-product op)
    - Running `bunx vitest run services/search/__tests__/SearchService.test.ts` exits 0 with all 12+ assertions passing
    - Running `bun lint` exits 0 (no ESLint errors in the new file)
    - Running `bunx tsc --noEmit` exits 0 (TypeScript strict mode passes)
    - File length: `wc -l services/search/SearchService.ts` reports >= 100 lines (header doc + imports + types + function body + helpers)
    - File MUST NOT contain `console.log` (security: no secrets in logs); `console.error` is allowed in the catch block but only for `err.message`
    - File MUST NOT import `@ai-sdk/google` (AI Gateway routing rule from CLAUDE.md; embedding goes through EmbeddingService not direct provider SDK)
  </acceptance_criteria>
  <done>SearchService.ts compiles under TS strict, ESLint passes, the 04-01 RED test scaffold for SearchService now exits 0 on `bunx vitest run`, and the file's gate counters (above) all pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create services/chat/getActiveChatModel.ts as the Phase 7 contract anchor</name>
  <files>services/chat/getActiveChatModel.ts</files>
  <read_first>
    - services/search/searchableText.ts (the "ASYMMETRY" lock-block at lines 3-22 — replicate the same lock-block tone for "Phase 7 will replace the body")
    - services/embeddings/EmbeddingService.ts lines 27-28 (the `as const` frozen constant pattern for EMBEDDING_MODEL)
    - services/chat/__tests__/getActiveChatModel.test.ts (the RED scaffold from 04-01 — this file IS the spec)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §Decisions D-09 (exact return shape, Phase 7 body-only-swap contract)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax" §5 (full file template)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"services/chat/getActiveChatModel.ts"
  </read_first>
  <behavior>
    - getActiveChatModel('any-shop.myshopify.com') returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }
    - getActiveChatModel('shop-a.myshopify.com') and getActiveChatModel('shop-b.myshopify.com') return objects that .toEqual each other (Phase 4 is shop-agnostic)
    - The returned `id` matches /^[a-z-]+\/[a-z0-9.-]+$/ (AI Gateway provider/model namespaced format)
    - Function signature is `async function getActiveChatModel(shop: string): Promise<ActiveChatModel>` — the shop param is accepted and ignored in Phase 4 (Phase 7 contract anchor)
  </behavior>
  <action>
    Create `services/chat/getActiveChatModel.ts` per D-09. Exact file shape:

    Header JSDoc lock-block mirroring services/search/searchableText.ts asymmetry block. Content (paraphrased):
    - Title: "Phase 4 contract anchor (D-09)"
    - Body: explains that Phase 4 returns a hardcoded default. Phase 7 will replace the BODY to read ShopSettings.activeChatModel from the database. The shop-first signature IS the contract today — callers in Phase 4 already pass `shop` so Phase 7 is a body-only swap.
    - Rule: "DO NOT inline the model id at call sites. Always route through this helper." (so call sites in /api/chat/route.ts and app/(embedded)/chat/page.tsx import from here).

    Exports:
    - `export interface ActiveChatModel { id: string; displayName: string; }`
    - Define a frozen module-level constant: `const DEFAULT_MODEL: ActiveChatModel = { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' };` (NOT exported — call through `getActiveChatModel` only).

    Function:
    - `export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> { void shop; return DEFAULT_MODEL; }`
    - The `void shop;` line is intentional: signals to TypeScript and any reader that Phase 4 ignores the param (Phase 7 will use it). Suppresses unused-variable lint warning.

    No imports. No I/O. No DB. No env-var reads. This file is intentionally synchronous-looking (returns a Promise via `async`) so the Phase 7 swap can do a Prisma read without changing the signature.

    Note on character encoding: the displayName uses ASCII "Gemini 2.5 Flash" — no special glyphs. The banner template that consumes this value will add the em-dash and middle-dot in plan 04-06.

    All assertions in `services/chat/__tests__/getActiveChatModel.test.ts` must pass.
  </action>
  <verify>
    <automated>bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File services/chat/getActiveChatModel.ts EXISTS
    - Command `grep -c "export async function getActiveChatModel" services/chat/getActiveChatModel.ts` returns 1
    - Command `grep -c "export interface ActiveChatModel" services/chat/getActiveChatModel.ts` returns 1
    - Command `grep -c "google/gemini-2.5-flash" services/chat/getActiveChatModel.ts` returns 1
    - Command `grep -c "Gemini 2.5 Flash" services/chat/getActiveChatModel.ts` returns 1
    - Command `grep -c "Phase 7" services/chat/getActiveChatModel.ts` returns at least 1 (the lock-block doc references the Phase 7 body-only swap)
    - File contains exactly one occurrence of the hardcoded model id literal (no duplicate or env-var alternative).
    - File MUST NOT import `process.env`, `@/lib/db/client`, `@prisma/client`, or any DB module (Phase 4 stub is intentionally I/O-free).
    - File MUST NOT export `DEFAULT_MODEL` (must be a private constant so call sites cannot bypass `getActiveChatModel`).
    - Running `bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts` exits 0 with all 3 assertions passing.
    - Running `bun lint` exits 0 (no ESLint errors).
    - Running `bunx tsc --noEmit` exits 0.
    - File length: `wc -l services/chat/getActiveChatModel.ts` reports >= 20 lines (header + interface + constant + function).
  </acceptance_criteria>
  <done>getActiveChatModel.ts compiles, the 04-01 RED test scaffold for getActiveChatModel exits 0, and Phase 7 has a body-only swap contract anchor.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM tool-call args → SearchService.hybridSearch | tool args are attacker-controllable; Zod schema in /api/chat constrains types and lengths, but hybridSearch must not trust string content for SQL composition |
| `shop` parameter → SearchService SQL | `shop` is server-provided via withShopifySession closure (NOT LLM-controlled); but if the closure is broken, a malformed shop would still flow into raw SQL |
| Database connection → external (Postgres / Prisma Accelerate) | error messages may contain connection details; must not leak via console.error |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | `hybridSearch` SQL composition with user query string | mitigate | User query is passed only through Prisma tagged-template binding (`${trimmed}`). Vector literal is a server-generated numerics-only string from `EmbeddingService.embed` (server-trusted). No string concatenation of user content into SQL. Per Pitfall 2. |
| T-04-02 | Information Disclosure | Cross-shop data leak in hybridSearch | mitigate | Both retriever branches explicitly include `WHERE pe.shop = ${shop} AND p.shop = ${shop}` (vec_ranked) and `WHERE p.shop = ${shop}` (lex_ranked) — D-03 defense-in-depth. The outer hydration SELECT also joins on `p.shop = ${shop} AND p.id = f.id`. SearchService test scaffold asserts shop appears in parameter values >= 4 times across both branches. |
| T-04-03 | Information Disclosure | Empty-string query embedded via AI Gateway returns centroid vector matching every shop's content | mitigate | `if (!trimmed) return [];` is the first statement; embed is never called for empty/whitespace input. Per Pitfall 4. |
| T-04-04 | Information Disclosure | Error logging leaks user query or shop name | mitigate | Catch block extracts `err.message` ONLY. No logging of: query content, shop name, headers, error object. console.error prefix is `[SearchService] hybridSearch failed:` followed by err.message. |
| T-04-05 | Tampering | Price filter bypass via negative or NaN values | accept | Zod schema at the tool layer (plan 04-03) validates priceMin/priceMax as `z.number().optional()`. SearchService trusts the typed args per CONTEXT.md anti-pattern lock ("validate at the Zod schema layer; do NOT also re-parse"). |
| T-04-06 | Denial of Service | Long-running pgvector query under HNSW bypass | accept | `withHnswIterativeScan` sets `hnsw.iterative_scan = 'relaxed_order'` per session — Phase 3 Smoke 4 proves HNSW Index Scan at 1500 rows. Below ~1000 rows the planner correctly Seq Scans (not a bug, per Pitfall 3). Branch limits 50+50 cap candidate pool. |
</threat_model>

<verification>
After both tasks complete:
1. `bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts` exits 0 with all assertions passing.
2. `bun lint` exits 0.
3. `bunx tsc --noEmit` exits 0.
4. `grep -rn "MOCK_PRODUCTS\|buildMockResults" services/search/ services/chat/` returns nothing (these services have no mock-product dependency).
5. `grep -rn "@ai-sdk/google\|@ai-sdk/openai\|@ai-sdk/anthropic" services/search/SearchService.ts services/chat/getActiveChatModel.ts` returns nothing (AI Gateway only; no provider SDKs).
</verification>

<success_criteria>
- services/search/SearchService.ts exists, compiles, exports hybridSearch + 3 constants
- services/chat/getActiveChatModel.ts exists, compiles, exports getActiveChatModel + ActiveChatModel type
- 04-01 RED tests for these two files now GREEN
- Both files pass `bun lint` and `bunx tsc --noEmit`
- The `lex_ranked` CTE structurally supports brand/SKU-only matches contributing to RRF fusion (verified empirically downstream in Plan 04-06 brand-name smoke; W8 fix anchors this truth in the foundation plan)
- Threat model items T-04-01..T-04-04 are addressed at the source level
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-02-SUMMARY.md` when done. Summary includes: line counts for both new files, the exact RRF/branch/result constants exported, confirmation that both 04-01 sub-suites went GREEN, and any deviations from the planned SQL skeleton (none expected).
</output>
</content>
