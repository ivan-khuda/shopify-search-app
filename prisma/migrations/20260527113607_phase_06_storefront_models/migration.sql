-- Migration: phase-06 storefront persistence models
--
-- ADDITIVE migration. Creates Conversation, SavedProduct, and
-- VisitorCustomerLink tables plus their secondary indexes. No data drops.
--
-- The auto-generated `ALTER TABLE products DROP COLUMN searchVector` was
-- removed from this file. `searchVector` is a hand-maintained tsvector
-- GENERATED column declared in 20260525110001_add_embeddings_indexes —
-- Prisma cannot model `tsvector` columns (bug #27186) so it appears as
-- unknown drift on every `migrate dev`. Keeping that column is required
-- by db/manual-indexes.sql (GIN index) and the hybrid search path.
--
-- Partial unique indexes for saved_products (saved_products_anon_unique_idx,
-- saved_products_customer_unique_idx) live in db/manual-indexes.sql per
-- D-20 — Prisma cannot model partial indexes.

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "customerId" TEXT,
    "title" VARCHAR(60) NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_products" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_customer_links" (
    "shop" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_customer_links_pkey" PRIMARY KEY ("shop","visitorId","customerId")
);

-- CreateIndex
CREATE INDEX "conversations_shop_idx" ON "conversations"("shop");

-- CreateIndex
CREATE INDEX "conversations_shop_visitorId_lastMessageAt_idx" ON "conversations"("shop", "visitorId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "conversations_shop_customerId_lastMessageAt_idx" ON "conversations"("shop", "customerId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "saved_products_shop_idx" ON "saved_products"("shop");

-- CreateIndex
CREATE INDEX "saved_products_shop_visitorId_idx" ON "saved_products"("shop", "visitorId");

-- CreateIndex
CREATE INDEX "saved_products_shop_customerId_idx" ON "saved_products"("shop", "customerId");

-- CreateIndex
CREATE INDEX "visitor_customer_links_shop_visitorId_idx" ON "visitor_customer_links"("shop", "visitorId");

-- CreateIndex
CREATE INDEX "visitor_customer_links_shop_customerId_idx" ON "visitor_customer_links"("shop", "customerId");
