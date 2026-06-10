---
phase: 04-searchservice-wire-chat
plan: 02
subsystem: search-and-chat-model
tags: [tdd, green-wave, hybrid-search, rrf, pgvector, tsvector, ai-gateway, contract-anchor]
dependency_graph:
  requires:
    - "EMB-05 RED scaffold (04-01 services/search/__tests__/SearchService.test.ts)"
    - "ADM-05 RED scaffold (04-01 services/chat/__tests__/getActiveChatModel.test.ts)"
    - "Phase 3 EmbeddingService.embed (frozen) + lib/db/hnsw.withHnswIterativeScan (frozen)"
  provides:
    - "EMB-05 implementation: hybridSearch(shop, query, opts) + RRF_K/BRANCH_LIMIT/RESULT_LIMIT constants"
    - "ADM-05 / D-09 implementation: getActiveChatModel(shop) Phase 7 body-only swap anchor"
  affects:
    - "04-03 (/api/chat rewrite imports hybridSearch + getActiveChatModel)"
    - "04-04 (/api/proxy/chat creation imports hybridSearch)"
    - "04-06 (banner template consumes getActiveChatModel().displayName; brand-name smoke verifies lex_ranked RRF contribution empirically)"
    - "Phase 7 (ADM-05 body-only swap — signature locked here)"
tech-stack:
  added: []
  patterns:
    - "Prisma tagged-template $queryRaw raw SQL with safe ${shop} / ${trimmed} bindings + numerics-only ::vector literal interpolation"
    - "withHnswIterativeScan(async tx => tx.$queryRaw...) callback form mandatory per D-03 / Pitfall 1"
    - "Branched SQL strategy: two parallel $queryRaw template literals (with/without price-filter CTE) chosen by hasPrice — avoids nested empty Prisma.sql fragment uncertainty"
    - "WITH ... AS Common Table Expressions composing vec_ranked + lex_ranked + fused for SQL-side Reciprocal Rank Fusion"
    - "Phase 7 contract anchor: shop-first async signature with `void shop;` placeholder + private DEFAULT_MODEL constant (call sites cannot bypass resolver)"
key-files:
  created:
    - services/search/SearchService.ts
    - services/chat/getActiveChatModel.ts
  modified: []
decisions:
  - "Chose two parallel $queryRaw template literals (hasPrice branch) over nested Prisma.sql fragment — sidesteps Assumption A10 (empty Prisma.sql template stability) without sacrificing test-side SQL skeleton assertions."
  - "Both retriever branches WHERE-filter on shop EXPLICITLY (D-03 defense-in-depth) — vec_ranked has 2 shop bindings (pe.shop + p.shop), lex_ranked has 1 (p.shop), outer hydration JOIN adds 1 more; price-filter CTE adds 1 more per branch when active. Tests assert shop appears in raw-query parameter values >= 4 times."
  - "ChatProduct.id is String(row.id) — Decimal-to-string Prisma raw-query serialization is the expected shape; MOCK_PRODUCTS used string IDs and 04-03 must not introduce a type-rename ripple."
  - "Empty-query short-circuit is the FIRST statement of hybridSearch (before embed call, before any DB call) — both a cost short-circuit and a correctness lock per T-04-03."
  - "Error path logs err.message ONLY with prefix `[SearchService] hybridSearch failed:` — never the query, never the shop name, never the full error object (T-04-04 / CLAUDE.md no-secrets-in-logs)."
  - "getActiveChatModel.ts is intentionally I/O-free in Phase 4 — no Prisma imports, no env reads. The async signature reserves Phase 7 freedom to do a DB read without altering call sites."
metrics:
  duration: ~15m
  completed: 2026-05-25
  files_created: 2
  files_modified: 0
  commits: 2
  tasks: 2
  tests_red_to_green: 15
---

# Phase 4 Plan 2: SearchService + getActiveChatModel Summary

Foundational data-access core for Phase 4: `hybridSearch(shop, query, opts)` runs SQL-side Reciprocal Rank Fusion over pgvector + tsvector branches, scoped per-shop with defense-in-depth filtering and an optional MIN(price) variants CTE. `getActiveChatModel(shop)` lands the Phase 7 body-only-swap contract anchor returning the hardcoded Gemini 2.5 Flash AI Gateway model. Both turn the 04-01 RED scaffolds (12 + 3 = 15 `it()` blocks) GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create services/search/SearchService.ts implementing hybridSearch with SQL-side RRF | `049dc05` | services/search/SearchService.ts |
| 2 | Create services/chat/getActiveChatModel.ts as the Phase 7 contract anchor | `eba01d4` | services/chat/getActiveChatModel.ts |

## File Line Counts

| File | Lines | Plan minimum |
| ---- | ----- | ------------ |
| `services/search/SearchService.ts` | 271 | >= 100 |
| `services/chat/getActiveChatModel.ts` | 54 | >= 20 |

## Exported Constants

| Export | Value | Source |
| ------ | ----- | ------ |
| `RRF_K` | `60` | D-02 |
| `BRANCH_LIMIT` | `50` | D-02 |
| `RESULT_LIMIT` | `10` | D-02 |

## Tests Going RED → GREEN

```
$ bunx vitest run services/search/__tests__/SearchService.test.ts \
    services/chat/__tests__/getActiveChatModel.test.ts

 Test Files  2 passed (2)
      Tests  15 passed (15)
```

- `services/search/__tests__/SearchService.test.ts` — 12/12 PASS (constants export, empty-string short-circuit, whitespace short-circuit, embed-call-with-trim, SQL skeleton + operators, D-03 shop-binding count, cross-shop isolation, price filter absent when bounds undefined, price filter present for priceMin, price filter present for priceMax, error swallow, ChatProduct projection with en-dash + null image).
- `services/chat/__tests__/getActiveChatModel.test.ts` — 3/3 PASS (default model object equality, shop-agnostic across two distinct shops, AI Gateway namespacing regex).

## Acceptance Gate Receipts

```bash
$ grep -c 'export async function hybridSearch' services/search/SearchService.ts
1
$ grep -c 'export const RRF_K = 60' services/search/SearchService.ts
1
$ grep -c 'export const BRANCH_LIMIT = 50' services/search/SearchService.ts
1
$ grep -c 'export const RESULT_LIMIT = 10' services/search/SearchService.ts
1
$ grep -c 'console.log' services/search/SearchService.ts          # security
0
$ grep -c '@ai-sdk/google' services/search/SearchService.ts       # AI Gateway only
0
$ grep -c '<#>' services/search/SearchService.ts                  # cosine, not inner-product
0

$ grep -c 'export async function getActiveChatModel' services/chat/getActiveChatModel.ts
1
$ grep -c 'export interface ActiveChatModel' services/chat/getActiveChatModel.ts
1
$ grep -c 'google/gemini-2.5-flash' services/chat/getActiveChatModel.ts
1
$ grep -c 'export.*DEFAULT_MODEL' services/chat/getActiveChatModel.ts   # private
0
$ grep -c 'process.env\|@/lib/db/client\|@prisma/client' services/chat/getActiveChatModel.ts
0
```

## SQL Skeleton (Shape A — D-01 / D-02 / D-03 / D-08)

```text
WITH vec_ranked AS (
  SELECT p.id,
         ROW_NUMBER() OVER (ORDER BY pe.embedding <=> ${vectorLiteral}::vector) AS rank
  FROM product_embeddings pe
  INNER JOIN products p ON p.shop = pe."productShop" AND p.id = pe."productId"
  [INNER JOIN variants CTE pf ...  -- only when hasPrice]
  WHERE pe.shop = ${shop} AND p.shop = ${shop} AND p.status = 'ACTIVE'
  ORDER BY pe.embedding <=> ${vectorLiteral}::vector
  LIMIT 50
),
lex_ranked AS (
  SELECT p.id,
         ROW_NUMBER() OVER (ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC) AS rank
  FROM products p
  [INNER JOIN variants CTE pf ...  -- only when hasPrice]
  WHERE p.shop = ${shop}
    AND p.status = 'ACTIVE'
    AND p."searchVector" @@ websearch_to_tsquery('english', ${trimmed})
  ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
  LIMIT 50
),
fused AS (
  SELECT id, SUM(1.0 / (60 + rank)) AS rrf_score
  FROM (
    SELECT id, rank FROM vec_ranked
    UNION ALL
    SELECT id, rank FROM lex_ranked
  ) combined
  GROUP BY id
  ORDER BY rrf_score DESC
  LIMIT 10
)
SELECT p.id, p.title, p.description, p.handle,
       p."priceMin", p."priceMax",
       p.tags, p.vendor, p."productType",
       (SELECT url FROM product_images
        WHERE "productShop" = p.shop AND "productId" = p.id
        ORDER BY position ASC LIMIT 1) AS image,
       f.rrf_score
FROM fused f
INNER JOIN products p ON p.shop = ${shop} AND p.id = f.id
ORDER BY f.rrf_score DESC
```

When `hasPrice` is true, the variants CTE is INNER JOINed into both `vec_ranked` and `lex_ranked` (D-08). Products with no variants are excluded under that branch — by design, since price-bounded queries cannot meaningfully include un-priced products.

## Deviations from Plan

The plan's <action> step 4 described a single `$queryRaw` template literal with a `priceJoin` Prisma.sql fragment interpolated at two CTE sites. **Implementation chose two parallel `$queryRaw` template literals** selected by `hasPrice` instead — exactly the fall-back the plan itself authorized ("if Assumption A10 fails (nested empty `Prisma.sql\`\`` not supported), fall back to two parallel `$queryRaw` template literals selected by `hasPrice`").

Rationale: the test scaffold inspects `queryRawMock.mock.calls[0][0]` as a `readonly string[]` (the tagged-template strings array) and concatenates with `'?'` to obtain `sqlSkeleton`. A nested `Prisma.sql` fragment is not flattened into that strings array — the test would never see "MIN(price)" inside the skeleton. The two-branch shape produces an unambiguous strings array per call: hasPrice=true → contains MIN(price) literally; hasPrice=false → does NOT contain MIN(price) literally. Both acceptance scenarios (`it('price filter omitted when ...')` and `it('price filter included when ...')`) verify against the joined strings array, and both pass.

No other deviations. The structural SQL skeleton (vec_ranked + lex_ranked + fused + outer hydration SELECT), the `<=>` cosine operator, the `websearch_to_tsquery + ts_rank_cd` lexical branch, the `LIMIT 50 / LIMIT 50 / LIMIT 10` cascade, the en-dash U+2013 price formatting, the empty-query short-circuit, the err.message-only catch — all land exactly as the plan specified.

## Threat Compliance

| Threat ID | Status | Evidence |
| --------- | ------ | -------- |
| T-04-01 (Tampering — SQL composition with user query) | mitigate ✅ | `query` flows only via `${trimmed}` Prisma tagged-template binding. `vectorLiteral` is a numerics-only string from `EmbeddingService.embed` (length pinned to 1536). No string concatenation of user content into SQL. |
| T-04-02 (Cross-shop info disclosure) | mitigate ✅ | Test `'shop appears at least twice in vec_ranked WHERE clause'` asserts shop appears ≥ 4 times in raw-query parameter values; passes. Test `'cross-shop isolation: shop value swaps cleanly between consecutive calls'` confirms shop-A does NOT appear after a shop-B call; passes. |
| T-04-03 (Empty-query centroid leak) | mitigate ✅ | `if (!trimmed) return [];` is the FIRST statement. Two test cases assert `embedMock` is NOT called for empty/whitespace input; both pass. |
| T-04-04 (Log PII / secret leak) | mitigate ✅ | Catch block uses `err.message` only with prefix `[SearchService] hybridSearch failed:`. No `console.log` anywhere in the file. The shop name, the query content, and the raw error object are never logged. |
| T-04-05 (Price filter bypass) | accept | Zod schema at the tool layer (04-03) is the validation layer; SearchService trusts typed args per CONTEXT.md anti-pattern lock. |
| T-04-06 (Long-running pgvector query) | accept | `withHnswIterativeScan` enforces `hnsw.iterative_scan = 'relaxed_order'`; Phase 3 Smoke 4 already proved HNSW Index Scan at 1500 rows. Branch limits 50+50 cap candidate pool regardless. |

## Known Stubs

None. Both files are production implementations. `getActiveChatModel` is intentionally a stub-shaped resolver per D-09 (Phase 7 body-only swap anchor); the body returns a hardcoded default but the contract — shop-first async signature, ActiveChatModel return type, private DEFAULT_MODEL constant — is the production interface that Phase 7 will preserve verbatim while swapping the body to a Prisma read.

## Threat Flags

None. No new attack surface beyond what the plan's `<threat_model>` already enumerated.

## Self-Check: PASSED

- `services/search/SearchService.ts` FOUND
- `services/chat/getActiveChatModel.ts` FOUND
- Commit `049dc05` FOUND in `git log` (Task 1)
- Commit `eba01d4` FOUND in `git log` (Task 2)
- `bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts` exits 0 with `2 passed (2) / Tests 15 passed (15)`
- `bunx eslint services/search/SearchService.ts services/chat/getActiveChatModel.ts` exits 0 (no warnings, no errors)
- `grep -c '<#>' services/search/SearchService.ts` returns 0 (cosine only, no inner-product)
- `grep -c 'console.log' services/search/SearchService.ts` returns 0 (security)
- `grep -c '@ai-sdk/google\|@ai-sdk/openai\|@ai-sdk/anthropic' services/search/SearchService.ts services/chat/getActiveChatModel.ts` returns 0 (AI Gateway routing)
- `grep -rn 'MOCK_PRODUCTS' services/search/ services/chat/` returns nothing (no mock dependency)
