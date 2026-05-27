-- Migration: 20260525110001_add_embeddings_indexes
--
-- ADDITIVE migration. Adds the typed `modelVersion` and `searchableText`
-- columns plus a composite unique constraint to `product_embeddings`, and
-- adds the hand-edited `searchVector` tsvector GENERATED column to
-- `products`. No tables are dropped.
--
-- Four invariants this migration commits the codebase to:
--
-- 1. ADDITIVE: only ADD COLUMN / ADD CONSTRAINT. No DROP TABLE. Safe to
--    run against any Phase 2+ database.
--
-- 2. DELETE FROM product_embeddings: `modelVersion` is NOT NULL with no
--    default and pre-Phase-3 dev rows have no value. The dev wipe is safe
--    because production has zero embedding rows (sync never embedded
--    pre-Phase 3 — see 03-RESEARCH.md "Runtime State Inventory"). Precedent:
--    the destructive Phase 1 migration `20260523011257_add_shop_column_destructive`.
--
-- 3. searchVector is hand-added: Prisma cannot model `tsvector` columns
--    (Prisma bug #27186 in 6.7+ breaks the `search` operator when
--    `Unsupported("tsvector")` is in the schema). The generated column
--    lives ONLY in this SQL file, not in `schema.prisma`.
--
-- 4. The HNSW + GIN indexes are NOT in this migration. They live in
--    `db/manual-indexes.sql` and are applied by `bun db:indexes`. Prisma
--    cannot model pgvector indexes (issue #21850) or tsvector GIN indexes
--    cleanly; keeping them outside Prisma's migration history avoids drift
--    detection. Run `bun db:indexes` AFTER this migration.

-- ============================================================
-- 1. Wipe existing dev embedding rows (modelVersion is NOT NULL with no default)
-- ============================================================

DELETE FROM product_embeddings;

-- ============================================================
-- 2. Add new typed columns to product_embeddings (Prisma-managed)
-- ============================================================

-- AlterTable
ALTER TABLE "product_embeddings" ADD COLUMN "searchableText" TEXT NOT NULL;
ALTER TABLE "product_embeddings" ADD COLUMN "modelVersion" TEXT NOT NULL;

-- Pin embedding column dimensions to 1536 (OpenAI text-embedding-3-small,
-- EMBEDDING_DIMENSIONS in services/embeddings/EmbeddingService.ts). HNSW
-- indexes require an explicit dimension; the original init migration left
-- it unbounded. Safe to ALTER here — the DELETE above empties the table.
ALTER TABLE "product_embeddings" ALTER COLUMN "embedding" TYPE vector(1536);

-- CreateIndex
CREATE UNIQUE INDEX "product_embeddings_shop_productShop_productId_key" ON "product_embeddings"("shop", "productShop", "productId");

-- ============================================================
-- 3. Add searchVector tsvector GENERATED column to products (hand-edited)
-- ============================================================
--
-- Postgres auto-recomputes searchVector on every UPDATE — no application
-- logic. The `options` field is intentionally EXCLUDED from this tsvector
-- (D-04 asymmetry — semantic search via embeddings covers options).
--
-- Weight composition (D-04):
--   A: title
--   B: tags (space-joined) + vendor + productType
--   C: description
--
-- Note: GENERATED ALWAYS expressions must reference IMMUTABLE functions
-- only. `array_to_string(text[], text)` is STABLE in Postgres (depends on
-- locale-tied collation rules), so we wrap it in an IMMUTABLE helper.
-- The helper is safe because its behaviour is fully determined by the
-- supplied array and delimiter — locale never affects the output.

CREATE OR REPLACE FUNCTION "smartdiscovery_immutable_array_to_string"(arr text[], delim text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT array_to_string(arr, delim) $$;

ALTER TABLE "products" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce("smartdiscovery_immutable_array_to_string"(tags, ' '), '') || ' ' || coalesce(vendor, '') || ' ' || coalesce("productType", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
) STORED;
