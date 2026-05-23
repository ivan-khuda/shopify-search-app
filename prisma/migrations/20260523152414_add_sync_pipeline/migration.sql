-- Migration: 20260523152414_add_sync_pipeline
--
-- ADDITIVE migration. Creates SyncState enum, sync_runs table, and
-- webhook_events table. Adds the optional updatedAtShopify column to the
-- existing products table. No existing tables are dropped. Safe to run on
-- any Phase 1+ database.
--
-- Errors[] convention: each entry is a JSON-encoded {shopifyId, message}
-- string (per Plan 02-02 documentation in D-15). Storing as TEXT[] keeps
-- the migration simple; richer typing can land in a later phase if needed.

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');

-- CreateTable
CREATE TABLE "sync_runs" (
  "id"             TEXT          NOT NULL,
  "shop"           TEXT          NOT NULL,
  "state"          "SyncState"   NOT NULL DEFAULT 'queued',
  "processedCount" INTEGER       NOT NULL DEFAULT 0,
  "totalCount"     INTEGER,
  "errors"         TEXT[]        DEFAULT ARRAY[]::TEXT[],
  "cursor"         TEXT,
  "idempotencyKey" TEXT          NOT NULL,
  "startedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"     TIMESTAMP(3),
  CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
  "eventId"    TEXT          NOT NULL,
  "shop"       TEXT          NOT NULL,
  "topic"      TEXT          NOT NULL,
  "receivedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("eventId")
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "updatedAtShopify" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sync_runs_idempotencyKey_key" ON "sync_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sync_runs_shop_idx" ON "sync_runs"("shop");

-- CreateIndex
CREATE INDEX "webhook_events_shop_idx" ON "webhook_events"("shop");
