-- db/manual-indexes.sql
--
-- Idempotent pgvector (HNSW) + tsvector (GIN) index creation. This file
-- lives OUTSIDE Prisma's migration history on purpose:
--
--   - Prisma cannot model `vector` indexes (issue #21850).
--   - Prisma cannot model `tsvector` columns without breaking the `search`
--     operator (bug #27186 in 6.7+) — see 03-RESEARCH.md "Anti-Patterns".
--
-- Lifecycle (D-06):
--   - `prisma migrate dev` is SAFE for this script's outputs — Prisma does
--     NOT drop these indexes on routine migrations because they reference
--     types Prisma does not model.
--   - `prisma migrate reset` DOES wipe these indexes. Re-run `bun db:indexes`
--     after every reset (03-RESEARCH.md Pitfall 4).
--   - This script is idempotent: every CREATE uses `IF NOT EXISTS` and
--     re-running it is a no-op (EMB-04).
--
-- Apply via:  `bun db:indexes`
--
-- Identifier names are stable: the Phase 3 verification gate
-- (plan 03-08) checks `pg_indexes.indexname` against these exact strings.

-- ============================================================
-- 1. pgvector extension (no-op if already installed)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. HNSW index on product_embeddings.embedding (D-05)
-- ============================================================
-- Opclass: vector_cosine_ops. NOT vector_l2_ops (semantic similarity is
-- cosine, not euclidean) and NOT the negative-inner-product opclass
-- (requires pre-normalised vectors; OpenAI text-embedding-3-small returns
-- unit-normalised vectors but the cosine opclass is the safer default and
-- matches 03-RESEARCH.md Pitfall guidance).
--
-- Params: m=16, ef_construction=64 (D-05). m controls graph connectivity at
-- build time; ef_construction controls build-time accuracy. These are the
-- pgvector defaults tuned for the 5k-product target.

CREATE INDEX IF NOT EXISTS "product_embeddings_embedding_hnsw_idx"
  ON product_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 3. GIN index on products.searchVector (D-04)
-- ============================================================
-- GIN is the standard opclass for tsvector full-text search columns.
-- The column itself is GENERATED ALWAYS AS STORED, defined in the
-- 20260525110001_add_embeddings_indexes migration.

CREATE INDEX IF NOT EXISTS "products_searchVector_gin_idx"
  ON products
  USING GIN ("searchVector");

-- ============================================================
-- 4. SavedProduct anon-only uniqueness (D-20)
-- ============================================================
-- Partial unique index covering anonymous-visitor saves: ensures a single
-- (shop, visitorId, productId) row exists while customerId IS NULL.
--
-- These indexes back the ON CONFLICT clauses in `/api/proxy/saved-products`
-- POST (D-20) and the visitor→customer merge transaction (D-11). Do NOT add
-- equivalent `@@unique` declarations in Prisma — Prisma cannot model partial
-- indexes.

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_anon_unique_idx"
  ON saved_products (shop, "visitorId", "productId")
  WHERE "customerId" IS NULL;

-- ============================================================
-- 5. SavedProduct customer-linked uniqueness (D-20)
-- ============================================================
-- Partial unique index covering customer-linked saves: ensures a single
-- (shop, customerId, productId) row exists once a customer has been merged
-- onto the save (customerId IS NOT NULL).

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_customer_unique_idx"
  ON saved_products (shop, "customerId", "productId")
  WHERE "customerId" IS NOT NULL;
