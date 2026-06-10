# Plan 01-03 Summary

**Status:** complete
**Wave:** 1
**Requirements:** FND-01
**Commit:** `cfe6d9a` — `feat(01-03): rewrite Prisma schema with shop column + composite (shop,id) FK`

## What shipped

`prisma/schema.prisma` rewritten so every merchant-data model carries a `shop` column and composite (shop, id) relations:

- `Product`: `shop String` (myshopify.com hostname per D-02), `@@unique([shop, id])`, `@@unique([shop, shopifyId])`, `@@unique([shop, handle])`
- `ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding`: each carries `shop String` redundantly with parent (intentional per D-04) plus composite FK `(productShop, productId) → Product(shop, id)` with `onDelete: Cascade`
- `ProductImage.productShop` is nullable to mirror existing `productId Int?` nullability
- `ProductEmbedding.embedding Unsupported("vector")?` preserved (pgvector)
- `ShopifySession` UNTOUCHED

`prisma/migrations/20260523011257_add_shop_column_destructive/migration.sql` authored:

- DESTRUCTIVE single migration per D-01 (header documents reset requirement)
- `CREATE EXTENSION IF NOT EXISTS vector` preamble
- `DROP TABLE CASCADE` on the 5 product tables in dependency order
- Recreate each with `shop NOT NULL`, indexes, composite-FK constraints
- `product_embeddings.embedding` recreated as raw `vector` column type
- `shopify_sessions` table never referenced in DROP or CREATE (acceptance: `grep -c "shopify_sessions" migration.sql` → 0)

## Verification

- `bunx prisma validate` → schema valid
- Migration file exists with `DESTRUCTIVE` warning + `prisma migrate reset` reference
- `grep -c "shopify_sessions" migration.sql` → 0
- pgvector extension creation preserved

## Notes

Migration **not yet applied** to the database. Plan 05 (Wave 2 BLOCKING checkpoint) is the human-action task that runs `bunx prisma migrate dev` to apply the migration and regenerate the Prisma client. Until that runs, code referencing the new schema (e.g., `productShop`, `@@unique([shop, id])` compound where input) won't have generated types.

The original parallel executor agent wrote the schema file but terminated without Bash access. The schema was copied from the worktree and the migration SQL was authored on main. Worktree branch removed.

## Handoff

- Plan 05 (Wave 2): applies the migration via `bunx prisma migrate dev --name add_shop_column_destructive` and regenerates the Prisma client
- Plan 06 (Wave 3): implements `ProductRepository` against the regenerated client; depends on Plan 05's apply
- Future migrations (Phase 2+) MUST be additive — destructive resets are not the pattern going forward
