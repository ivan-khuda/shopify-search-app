---
phase: 07-admin-settings-model-picker
plan: 03
subsystem: db-migrations
tags: [prisma, migration, pgvector, shop_settings, option-a]
requires: [07-02]
provides: [shop_settings table, prisma.shopSettings client accessor]
affects: [app/generated/prisma/, dev PostgreSQL]
tech-stack:
  added: []
  patterns: [non-destructive migration apply via prisma db execute + migrate resolve]
key-files:
  created:
    - prisma/migrations/20260527161654_add_shop_settings/migration.sql
  modified: []
decisions:
  - "Applied via Option A (non-destructive) because Prisma 7.3 introspection flags manual HNSW + GIN indexes (db/manual-indexes.sql) as schema drift, triggering a destructive reset prompt under `prisma migrate dev`. Used `prisma db execute` + `prisma migrate resolve --applied` to apply the DDL surgically and register history without resetting dev data."
metrics:
  duration: ~3min
  completed: 2026-05-27
---

# Phase 7 Plan 03: Apply ShopSettings Migration Summary

One-liner: Non-destructive forward-only migration creates `shop_settings` table; dev data and manual HNSW/GIN indexes preserved by bypassing Prisma 7's drift-triggered `migrate dev` reset prompt.

## What Was Built

A single forward-only migration directory committed to `prisma/migrations/`:

- **Folder:** `prisma/migrations/20260527161654_add_shop_settings/`
- **File:** `migration.sql`
- **Commit:** `558ff83`

The dev PostgreSQL now has a `shop_settings` table with three columns (`shop` PK, `activeChatModelId`, `updatedAt`) and zero rows (D-09 — never seed).

## Migration SQL Applied

```sql
-- CreateTable
CREATE TABLE "shop_settings" (
    "shop" TEXT NOT NULL,
    "activeChatModelId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("shop")
);
```

This is the exact text inside `prisma/migrations/20260527161654_add_shop_settings/migration.sql`. It is the canonical record in Prisma's migration history.

## Why Option A (Non-Destructive)

The first attempt at this plan ran `bunx prisma migrate dev --name add_shop_settings` and aborted on a drift-detection prompt. Prisma 7.3 tightened its introspection: it now sees the manual indexes in `db/manual-indexes.sql` (HNSW on `product_embeddings.embedding`, GIN on `products.searchVector`, plus the `searchVector` generated column itself) as schema drift, because Prisma cannot model `vector` or `tsvector` types.

The header of `db/manual-indexes.sql` documents exactly this lifecycle expectation:

> `prisma migrate dev` is SAFE for this script's outputs — Prisma does NOT drop these indexes on routine migrations because they reference types Prisma does not model.

That contract was written against pre-7.x Prisma. With Prisma 7.3, `migrate dev` interprets the same indexes as drift and asks to reset. The drift is a false positive — the indexes are intentionally outside Prisma's model.

Option A applies the new DDL through a path that does not invoke drift detection:

1. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` produced the raw diff (which included the false-positive `DROP INDEX` / `DROP COLUMN "searchVector"` lines).
2. The shop_settings `CREATE TABLE` block was extracted verbatim into a new migration directory with the project's `YYYYMMDDhhmmss_name` timestamp convention.
3. `prisma db execute --file …/migration.sql` applied the SQL transactionally without consulting migration history or running drift detection.
4. `prisma migrate resolve --applied 20260527161654_add_shop_settings` registered the migration in `_prisma_migrations` so future `prisma migrate` calls treat it as already-applied.
5. `prisma generate` regenerated the typed client; `app/generated/prisma/models/ShopSettings.ts` is now emitted (the directory is gitignored per `.gitignore`).
6. `bun db:indexes` re-applied the manual HNSW + GIN indexes (idempotent — all `CREATE INDEX IF NOT EXISTS`); printed `manual indexes applied`.

## Verification

- `bunx prisma migrate status` → "8 migrations found in prisma/migrations" and "Database schema is up to date!"
- `bunx vitest run lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` now fails with `Failed to resolve import "@/lib/db/repositories/ShopSettingsRepository"` — the right RED for Plan 05 to address, NOT a prisma-client error. Confirms `prisma.shopSettings` is live (the test file mocks `lib/db/client`'s `shopSettings.upsert`; the mock declaration resolves, so the failure is purely the missing repo module).
- `grep -rl "shopSettings"` in `app/generated/prisma/` resolves `models/ShopSettings.ts`, `internal/class.ts`, `internal/prismaNamespace.ts`.
- Manual indexes remain intact — `bun db:indexes` exited 0 with no errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Switched from `prisma migrate dev` to Option A path**

- **Found during:** Pre-execution (orchestrator-flagged before this agent ran)
- **Issue:** Prisma 7.3's `migrate dev` flags `db/manual-indexes.sql` outputs (HNSW + GIN + `searchVector` generated column) as schema drift and prompts to reset the dev database. Resetting would wipe local dev data and force a re-sync.
- **Fix:** Authorized by user as "Option A". Used `prisma db execute` to apply the DDL surgically, then `prisma migrate resolve --applied` to register history. No DB reset; manual indexes never touched.
- **Files modified:** `prisma/migrations/20260527161654_add_shop_settings/migration.sql` (new)
- **Commit:** `558ff83`

**2. [Rule 3 - Blocking Issue] Prisma 7 CLI flag renames**

- **Found during:** Task — `prisma migrate diff`
- **Issue:** Prisma 7 removed `--to-schema-datamodel` in favor of `--to-schema`, and removed `--schema` from `prisma db execute` (the CLI reads from `prisma.config.ts` automatically).
- **Fix:** Used the new flags. Diffed against `--from-config-datasource` (live DB) rather than `--from-migrations` (which requires a shadow DB URL not configured in this project).

**3. [Skipped] Second commit (`chore(07-03-02): regenerate prisma client + re-apply manual indexes`)**

- **Reason:** `app/generated/prisma/` is in `.gitignore` (verified). Re-running `bun db:indexes` is a pure DB-side idempotent operation with no file changes. Nothing to stage.

### Out of Scope (Logged, Not Fixed)

The `prisma migrate diff` output also contained `DROP INDEX "product_embeddings_embedding_hnsw_idx"`, `DROP INDEX "products_searchVector_gin_idx"`, and `ALTER TABLE "products" DROP COLUMN "searchVector"`. These are **false-positive drift detections** caused by Prisma 7's inability to model `vector` / `tsvector` types — the indexes and column are intentionally managed outside Prisma per `db/manual-indexes.sql` and the Phase 3 migration `20260525110001_add_embeddings_indexes`. They were **deliberately not** copied into the new migration file. No code or DB change required; the canonical documentation already exists in `db/manual-indexes.sql`'s header.

## Authentication Gates

None — local DB operations only, no Shopify/Vercel/AI Gateway calls.

## Known Stubs

None. The `shop_settings` table is empty by design (D-09); `getActiveChatModel` falls back to `DEFAULT_MODEL` until the first `/settings` Save creates a row (Plan 07).

## Wave 1 Status

**BLOCKING complete.** Wave 2 plans now unblocked:

- 07-04 (TBD — see ROADMAP)
- 07-05 — `ShopSettingsRepository` (RED test already exists and now fails for the expected reason)
- 07-06 — resolver body swap

## Self-Check: PASSED

- `prisma/migrations/20260527161654_add_shop_settings/migration.sql` — FOUND
- Commit `558ff83` — FOUND in `git log`
- `prisma migrate status` — "Database schema is up to date"
- `app/generated/prisma/models/ShopSettings.ts` — FOUND (gitignored, not committed by design)
