-- Migration: 20260523011257_add_shop_column_destructive
--
-- DESTRUCTIVE migration. This DROPs every product-data table and recreates
-- them with the `shop` column NOT NULL and composite (shop, id) relations
-- between Product and its children (D-01, D-02, D-04 in
-- .planning/phases/01-foundation/01-CONTEXT.md).
--
-- Why destructive: Phase 1 has no production product data; sync is stubbed.
-- A nullable -> backfill -> NOT NULL migration adds complexity for no benefit.
-- Developer environments must run `bunx prisma migrate reset` to absorb this.
--
-- This migration does NOT touch the Shopify session table — OAuth sessions
-- already exist in dev databases and must survive the reset.

-- ============================================================
-- 1. Extension preamble (pgvector must exist before recreating product_embeddings)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. Drop product tables in dependency order (CASCADE handles FKs)
-- ============================================================

DROP TABLE IF EXISTS "product_embeddings" CASCADE;
DROP TABLE IF EXISTS "product_options"    CASCADE;
DROP TABLE IF EXISTS "product_images"     CASCADE;
DROP TABLE IF EXISTS "product_variants"   CASCADE;
DROP TABLE IF EXISTS "products"           CASCADE;

-- ============================================================
-- 3. Recreate `products` with shop + composite-unique key
-- ============================================================

CREATE TABLE "products" (
  "id"                  SERIAL          NOT NULL,
  "shop"                TEXT            NOT NULL,
  "shopifyId"           BIGINT,
  "title"               TEXT            NOT NULL,
  "handle"              TEXT            NOT NULL,
  "description"         TEXT,
  "descriptionHtml"     TEXT,
  "vendor"              TEXT,
  "productType"         TEXT,
  "status"              TEXT            NOT NULL DEFAULT 'ACTIVE',
  "tags"                TEXT[],
  "publishedAt"         TIMESTAMP(3),
  "priceMin"            DECIMAL(10, 2),
  "priceMax"            DECIMAL(10, 2),
  "compareAtPriceMin"   DECIMAL(10, 2),
  "compareAtPriceMax"   DECIMAL(10, 2),
  "createdAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)    NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_shop_id_key"        ON "products"("shop", "id");
CREATE UNIQUE INDEX "products_shop_shopifyId_key" ON "products"("shop", "shopifyId");
CREATE UNIQUE INDEX "products_shop_handle_key"    ON "products"("shop", "handle");
CREATE INDEX        "products_shop_idx"           ON "products"("shop");
CREATE INDEX        "products_shop_shopifyId_idx" ON "products"("shop", "shopifyId");
CREATE INDEX        "products_status_idx"         ON "products"("status");
CREATE INDEX        "products_vendor_idx"         ON "products"("vendor");
CREATE INDEX        "products_productType_idx"    ON "products"("productType");

-- ============================================================
-- 4. Recreate `product_variants` with composite FK -> products(shop, id)
-- ============================================================

CREATE TABLE "product_variants" (
  "id"                  SERIAL          NOT NULL,
  "shop"                TEXT            NOT NULL,
  "productShop"         TEXT            NOT NULL,
  "productId"           INTEGER         NOT NULL,
  "shopifyId"           BIGINT,
  "title"               TEXT            NOT NULL,
  "sku"                 TEXT,
  "barcode"             TEXT,
  "price"               DECIMAL(10, 2)  NOT NULL,
  "compareAtPrice"      DECIMAL(10, 2),
  "position"            INTEGER         NOT NULL DEFAULT 1,
  "inventoryQuantity"   INTEGER,
  "inventoryPolicy"     TEXT            NOT NULL DEFAULT 'DENY',
  "availableForSale"    BOOLEAN         NOT NULL DEFAULT true,
  "requiresShipping"    BOOLEAN         NOT NULL DEFAULT true,
  "taxable"             BOOLEAN         NOT NULL DEFAULT true,
  "weight"              DECIMAL(10, 2),
  "weightUnit"          TEXT,
  "option1"             TEXT,
  "option2"             TEXT,
  "option3"             TEXT,
  "createdAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)    NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_productShop_productId_fkey"
    FOREIGN KEY ("productShop", "productId") REFERENCES "products"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_variants_shop_idx"                   ON "product_variants"("shop");
CREATE INDEX "product_variants_productShop_productId_idx"  ON "product_variants"("productShop", "productId");
CREATE INDEX "product_variants_shop_shopifyId_idx"         ON "product_variants"("shop", "shopifyId");
CREATE INDEX "product_variants_sku_idx"                    ON "product_variants"("sku");
CREATE INDEX "product_variants_availableForSale_idx"       ON "product_variants"("availableForSale");

-- ============================================================
-- 5. Recreate `product_images` with composite FK -> products(shop, id) + variant FK
-- ============================================================

CREATE TABLE "product_images" (
  "id"            SERIAL          NOT NULL,
  "shop"          TEXT            NOT NULL,
  "productShop"   TEXT,
  "shopifyId"     BIGINT,
  "productId"     INTEGER,
  "variantId"     INTEGER,
  "url"           TEXT            NOT NULL,
  "altText"       TEXT,
  "width"         INTEGER,
  "height"        INTEGER,
  "position"      INTEGER         NOT NULL DEFAULT 1,
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_productShop_productId_fkey"
    FOREIGN KEY ("productShop", "productId") REFERENCES "products"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_images_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_images_shop_idx"                   ON "product_images"("shop");
CREATE INDEX "product_images_productShop_productId_idx"  ON "product_images"("productShop", "productId");
CREATE INDEX "product_images_variantId_idx"              ON "product_images"("variantId");
CREATE INDEX "product_images_shop_shopifyId_idx"         ON "product_images"("shop", "shopifyId");

-- ============================================================
-- 6. Recreate `product_options` with composite FK -> products(shop, id)
-- ============================================================

CREATE TABLE "product_options" (
  "id"            SERIAL          NOT NULL,
  "shop"          TEXT            NOT NULL,
  "productShop"   TEXT            NOT NULL,
  "shopifyId"     BIGINT,
  "productId"     INTEGER         NOT NULL,
  "name"          TEXT            NOT NULL,
  "position"      INTEGER         NOT NULL,
  "values"        TEXT[],
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_options_productShop_productId_fkey"
    FOREIGN KEY ("productShop", "productId") REFERENCES "products"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_options_shop_idx"                   ON "product_options"("shop");
CREATE INDEX "product_options_productShop_productId_idx"  ON "product_options"("productShop", "productId");
CREATE INDEX "product_options_shop_shopifyId_idx"         ON "product_options"("shop", "shopifyId");

-- ============================================================
-- 7. Recreate `product_embeddings` with composite FK + pgvector column
--    (pgvector column is raw SQL because Prisma can't generate it)
-- ============================================================

CREATE TABLE "product_embeddings" (
  "id"            SERIAL          NOT NULL,
  "shop"          TEXT            NOT NULL,
  "productShop"   TEXT            NOT NULL,
  "productId"     INTEGER         NOT NULL,
  "content"       TEXT            NOT NULL,
  "embedding"     vector,
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_embeddings_productShop_productId_fkey"
    FOREIGN KEY ("productShop", "productId") REFERENCES "products"("shop", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_embeddings_shop_idx"                   ON "product_embeddings"("shop");
CREATE INDEX "product_embeddings_productShop_productId_idx" ON "product_embeddings"("productShop", "productId");
