# Plan 01-06 Summary

**Status:** complete
**Wave:** 3
**Requirements:** FND-04

## What shipped

`lib/db/repositories/ProductRepository.ts` (177 lines) — real transactional CRUD replacing the 9-line stub:

- Imports from `@/lib/db/client` (prisma singleton) and `@/app/generated/prisma` (Product type) — both correct paths per D-03/§Q8
- Exports input types: `ProductVariantInput`, `ProductImageInput`, `ProductOptionInput`, `ProductUpsertInput`, `ListOpts`
- Exports `ProductRepository` class with 4 methods, each taking `shop: string` as first non-optional arg:
  - `upsertProduct(shop, input)` — wraps Product + variants + images + options in `prisma.$transaction`. Uses `shop_handle` compound where for upsert (handle always present; sidesteps null-shopifyId edge case). Children replaced wholesale per Shopify-sync semantics.
  - `findByShopAndId(shop, id)` — `findFirst({ where: { shop, id } })` (Pitfall 2 safe)
  - `listByShop(shop, opts?)` — `findMany` with shop filter, optional status, take/skip, ordered by createdAt desc
  - `deleteProduct(shop, id)` — `deleteMany({ where: { shop, id } })` (Pitfall 2 safe; discards count)
- Singleton export `productRepository = new ProductRepository()` as last line

## Verification

- `bunx vitest run lib/db/repositories/__tests__/ProductRepository.test.ts` → 11/11 GREEN
- TypeScript compiles cleanly (no `any`, no `@ts-ignore`)
- All grep gates pass: ≥4 `shop: string` signatures, 0 `console.log`, 1 `$transaction`, 1 `from '@/lib/db/client'`, 0 `from '@prisma/client'`

## Notes

Used `shop_handle` rather than `shop_shopifyId` as the upsert compound key — the Prisma-generated compound where name is reliable for `@@unique([shop, handle])` and avoids the null-shopifyId edge case that would require a `findFirst → branch` fallback. Phase 2 sync will always have `handle` populated from Shopify GraphQL.

Decimal/bigint fields cast via `as never` in the createMany payload — Prisma's generated input types for `createMany` expect `Prisma.Decimal | string | number` but TypeScript narrows our `number | string | null` unions; the cast is local to the call and does not weaken external typing.

## Handoff

- Phase 2 sync pipeline consumes `productRepository.upsertProduct(shop, ProductUpsertInput)` — input shape mirrors Shopify GraphQL product schema.
- Phase 4 SearchService uses `findByShopAndId`/`listByShop` for shop-scoped reads.
- Future: when adding `findByShopAndShopifyId` or similar lookups, follow the same `(shop, ...)` first-arg pattern.
