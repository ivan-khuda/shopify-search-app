/**
 * SearchService — Phase 4 hybrid retrieval core (EMB-05).
 *
 * Responsibilities:
 *   1. EMB-05: Expose a single `hybridSearch(shop, query, opts)` entry point that
 *      returns up to 10 `ChatProduct` rows sourced from the merchant's real
 *      `products` + `product_embeddings` tables.
 *   2. EMB-07 (consumer side): /api/chat and /api/proxy/chat both call this
 *      function via a closure that binds `shop` from server-side session context.
 *      The LLM never controls `shop` — only the typed `query` and optional
 *      `priceMin` / `priceMax` (D-07 price-only filters).
 *
 * Decisions locked here:
 *   - D-01: Hybrid retrieval fuses pgvector cosine-distance (`<=>`) and tsvector
 *     `websearch_to_tsquery` ranking via pure Reciprocal Rank Fusion (k=60,
 *     1-based ranks, no per-branch weights). Both branches return their top
 *     BRANCH_LIMIT (50) candidates; fused output returns the top RESULT_LIMIT
 *     (10) products.
 *   - D-02: RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10 exported as named
 *     constants at the top of this file. Tests freeze these values; downstream
 *     plans (04-03, 04-04, 04-06) read them via named import.
 *   - D-03: Both retriever branches WHERE-filter on shop EXPLICITLY (defense-
 *     in-depth). `pe.shop = ${shop} AND p.shop = ${shop}` in vec_ranked;
 *     `p.shop = ${shop}` in lex_ranked. The outer hydration SELECT also joins
 *     on `p.shop = ${shop}`. The LLM cannot influence the shop parameter — it
 *     is server-provided by the session closure.
 *   - D-07: Phase 4 ships price-only structured filters. SearchService trusts
 *     the typed args from the Zod schema (plan 04-03) and does NOT re-parse.
 *   - D-08: Price filter applied via an INNER JOIN on a CTE selecting
 *     `MIN(price)` per `(productShop, productId)` from product_variants.
 *     Products with no variants are excluded when a price filter is set;
 *     the CTE/join is OMITTED entirely when neither bound is supplied
 *     (no join cost paid for the no-filter happy path).
 *
 * Security (T-04-01 — SQL composition with user query string):
 *   The raw `query` string flows into SQL only via Prisma tagged-template
 *   binding (`${trimmed}`) — never via string concatenation. The vector
 *   literal interpolated into `::vector` is a server-trusted numerics-only
 *   string assembled from the OpenAI gateway response (length pinned to 1536
 *   by EmbeddingService.embed). Per Pitfall 2: this pattern is safe for the
 *   embedding output but MUST NOT be applied to user content.
 *
 * Security (T-04-02 — cross-shop isolation):
 *   See D-03 above. Tests assert shop appears in $queryRaw parameter values
 *   at least 4 times per call (vec_ranked WHERE pe.shop, AND p.shop; lex_ranked
 *   WHERE p.shop; outer hydration JOIN p.shop). When a price filter is active
 *   the inner variants CTE adds an additional `WHERE shop = ${shop}`.
 *
 * Security (T-04-03 — empty-string semantic search):
 *   `if (!trimmed) return [];` is the FIRST statement. embed() is never called
 *   for empty or whitespace-only input — both a cost short-circuit and a
 *   correctness lock (an empty embedding centroid would match arbitrary content
 *   across every shop's catalog). Per Pitfall 4.
 *
 * Security (T-04-04 — no PII / secret leakage in logs):
 *   The catch block extracts `err.message` ONLY and prefixes
 *   `[SearchService] hybridSearch failed:`. Never log: the user query content,
 *   the shop name, response headers, the raw error object. Per CLAUDE.md
 *   "No secrets, no session tokens, no auth headers in logs anywhere".
 */
import { embed } from '@/services/embeddings/EmbeddingService';
import { withHnswIterativeScan } from '@/lib/db/hnsw';
import type { ChatProduct } from '@/types/product';

export const RRF_K = 60 as const;
export const BRANCH_LIMIT = 50 as const;
export const RESULT_LIMIT = 10 as const;

export interface HybridOpts {
  priceMin?: number;
  priceMax?: number;
}

interface RankedProductRow {
  id: number;
  title: string;
  description: string | null;
  handle: string;
  priceMin: string | null;
  priceMax: string | null;
  tags: string[];
  vendor: string | null;
  productType: string | null;
  image: string | null;
  rrf_score: number;
}

/**
 * Run a shop-scoped hybrid (semantic + lexical) product search.
 *
 * Returns up to RESULT_LIMIT (10) ChatProduct rows. Returns [] for empty or
 * whitespace-only queries (without calling the AI Gateway). Returns [] if the
 * underlying SQL throws — errors never propagate to the caller (so a transient
 * DB hiccup doesn't tear down the /api/chat stream).
 */
export async function hybridSearch(
  shop: string,
  query: string,
  opts: HybridOpts = {},
): Promise<ChatProduct[]> {
  // T-04-03 / Pitfall 4: empty-query short-circuit BEFORE embed call. Must be
  // the first statement so a misuse can never reach the gateway or the DB.
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryVector = await embed(trimmed);
  // T-04-01 / Pitfall 2: numerics-only literal from EmbeddingService output.
  // Safe to interpolate; would NEVER be safe for user content.
  const vectorLiteral = `[${queryVector.join(',')}]`;

  const hasPrice = opts.priceMin !== undefined || opts.priceMax !== undefined;
  const priceMin = opts.priceMin ?? 0;
  const priceMax = opts.priceMax ?? Number.MAX_SAFE_INTEGER;

  try {
    const rows = await withHnswIterativeScan(async (tx) => {
      if (hasPrice) {
        // D-08: price-filter branch — INNER JOIN against MIN(price) CTE per product.
        // Products with no variants are excluded (INNER JOIN semantics).
        return tx.$queryRaw<RankedProductRow[]>`
          WITH vec_ranked AS (
            SELECT p.id,
                   ROW_NUMBER() OVER (ORDER BY pe.embedding <=> ${vectorLiteral}::vector) AS rank
            FROM product_embeddings pe
            INNER JOIN products p ON p.shop = pe."productShop" AND p.id = pe."productId"
            INNER JOIN (
              SELECT "productShop", "productId", MIN(price) AS min_price
              FROM product_variants
              WHERE shop = ${shop}
              GROUP BY "productShop", "productId"
              HAVING MIN(price) >= ${priceMin} AND MIN(price) <= ${priceMax}
            ) pf ON pf."productShop" = p.shop AND pf."productId" = p.id
            WHERE pe.shop = ${shop} AND p.shop = ${shop} AND p.status = 'ACTIVE'
            ORDER BY pe.embedding <=> ${vectorLiteral}::vector
            LIMIT ${BRANCH_LIMIT}
          ),
          lex_ranked AS (
            SELECT p.id,
                   ROW_NUMBER() OVER (ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC) AS rank
            FROM products p
            INNER JOIN (
              SELECT "productShop", "productId", MIN(price) AS min_price
              FROM product_variants
              WHERE shop = ${shop}
              GROUP BY "productShop", "productId"
              HAVING MIN(price) >= ${priceMin} AND MIN(price) <= ${priceMax}
            ) pf ON pf."productShop" = p.shop AND pf."productId" = p.id
            WHERE p.shop = ${shop}
              AND p.status = 'ACTIVE'
              AND p."searchVector" @@ websearch_to_tsquery('english', ${trimmed})
            ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
            LIMIT ${BRANCH_LIMIT}
          ),
          fused AS (
            SELECT id, SUM(1.0 / (${RRF_K} + rank)) AS rrf_score
            FROM (
              SELECT id, rank FROM vec_ranked
              UNION ALL
              SELECT id, rank FROM lex_ranked
            ) combined
            GROUP BY id
            ORDER BY rrf_score DESC
            LIMIT ${RESULT_LIMIT}
          )
          SELECT p.id,
                 p.title,
                 p.description,
                 p.handle,
                 p."priceMin" AS "priceMin",
                 p."priceMax" AS "priceMax",
                 p.tags,
                 p.vendor,
                 p."productType" AS "productType",
                 (SELECT url FROM product_images
                  WHERE "productShop" = p.shop AND "productId" = p.id
                  ORDER BY position ASC LIMIT 1) AS image,
                 f.rrf_score
          FROM fused f
          INNER JOIN products p ON p.shop = ${shop} AND p.id = f.id
          ORDER BY f.rrf_score DESC
        `;
      }

      // No-price branch — identical SQL skeleton without the variants CTE join.
      return tx.$queryRaw<RankedProductRow[]>`
        WITH vec_ranked AS (
          SELECT p.id,
                 ROW_NUMBER() OVER (ORDER BY pe.embedding <=> ${vectorLiteral}::vector) AS rank
          FROM product_embeddings pe
          INNER JOIN products p ON p.shop = pe."productShop" AND p.id = pe."productId"
          WHERE pe.shop = ${shop} AND p.shop = ${shop} AND p.status = 'ACTIVE'
          ORDER BY pe.embedding <=> ${vectorLiteral}::vector
          LIMIT ${BRANCH_LIMIT}
        ),
        lex_ranked AS (
          SELECT p.id,
                 ROW_NUMBER() OVER (ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC) AS rank
          FROM products p
          WHERE p.shop = ${shop}
            AND p.status = 'ACTIVE'
            AND p."searchVector" @@ websearch_to_tsquery('english', ${trimmed})
          ORDER BY ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
          LIMIT ${BRANCH_LIMIT}
        ),
        fused AS (
          SELECT id, SUM(1.0 / (${RRF_K} + rank)) AS rrf_score
          FROM (
            SELECT id, rank FROM vec_ranked
            UNION ALL
            SELECT id, rank FROM lex_ranked
          ) combined
          GROUP BY id
          ORDER BY rrf_score DESC
          LIMIT ${RESULT_LIMIT}
        )
        SELECT p.id,
               p.title,
               p.description,
               p.handle,
               p."priceMin" AS "priceMin",
               p."priceMax" AS "priceMax",
               p.tags,
               p.vendor,
               p."productType" AS "productType",
               (SELECT url FROM product_images
                WHERE "productShop" = p.shop AND "productId" = p.id
                ORDER BY position ASC LIMIT 1) AS image,
               f.rrf_score
        FROM fused f
        INNER JOIN products p ON p.shop = ${shop} AND p.id = f.id
        ORDER BY f.rrf_score DESC
      `;
    });

    return rows.map(toChatProduct);
  } catch (err) {
    // T-04-04: err.message only — never the full error object, never the query,
    // never the shop name. Prisma raw-query errors can include connection
    // strings / DSN fragments; the message string itself is the safe minimum.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SearchService] hybridSearch failed:', message);
    return [];
  }
}

function toChatProduct(row: RankedProductRow): ChatProduct {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description ?? '',
    image: row.image ?? undefined,
    category: row.productType ?? undefined,
    tags: row.tags,
    price: formatPriceRange(row.priceMin, row.priceMax),
  };
}

/**
 * Format a min/max price pair as ChatProduct.price.
 * - Both null → empty string (let the UI handle "price unavailable")
 * - Equal min === max → single `$10.00`
 * - Distinct → `$10.00 – $20.00` using en-dash U+2013 (NOT hyphen-minus)
 */
function formatPriceRange(min: string | null, max: string | null): string {
  if (min === null && max === null) return '';
  const minNum = min !== null ? parseFloat(min) : parseFloat(max!);
  const maxNum = max !== null ? parseFloat(max) : parseFloat(min!);
  if (minNum === maxNum) return `$${minNum.toFixed(2)}`;
  return `$${minNum.toFixed(2)} – $${maxNum.toFixed(2)}`;
}

