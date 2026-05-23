# Plan 02-05 Summary

**Status:** complete
**Wave:** 3
**Requirements:** SYN-01, SYN-02

## What shipped

`services/shopify/ShopifyProductService.ts` rewritten (~205 lines):

- `toDecimal(v)` — defensive Money parser handling BOTH String and `MoneyV2 { amount, currencyCode }` shapes (RESEARCH Q1 RESOLVED)
- `PRODUCTS_QUERY` GraphQL constant — products(first, after) with nested variants(first: 10), images(first: 10), options(first: 3) per RESEARCH §Q8 query-cost guidance
- `PRODUCTS_COUNT_QUERY` — separate `productsCount { count }` for D-04 totalCount derivation
- `fetchProductBatch(session, cursor, batchSize)` — instantiates `new shopifyClient.clients.Graphql({ session })`, calls `request`, returns `{ products, endCursor, hasNextPage }`
- `fetchTotalCount(session)` — single productsCount call; returns `count` or `null` gracefully on missing/throttled responses
- `mapToUpsertInput(node)` — pure transformer; sets `updatedAtShopify` from `node.updatedAt` (D-17 enables SYN-11 conflict resolution); routes all variant `price`/`compareAtPrice` through `toDecimal`
- TypeScript interfaces for `ShopifyProductNode`, `ShopifyVariantNode`, `ShopifyImageNode`, `ShopifyOptionNode`, `FetchBatchResult`

Supporting changes:
- `lib/db/repositories/ProductRepository.ts` — `ProductUpsertInput` grew `updatedAtShopify?: Date | null` field; `upsertProduct` writes it to the DB; added `findByShopAndHandle(shop, handle)` helper (Plan 02-09 uses it for the stale-event guard)
- `lib/sync/productSync.ts` — replaced the old `ShopifyProductService` class import (which no longer exists) with re-exports of the function-style service so any external caller compiles cleanly

## Verification

- `bunx vitest run services/shopify/__tests__/ShopifyProductService.test.ts` → 13/13 GREEN, including:
  - `toDecimal("19.99") === 19.99` ✓
  - `toDecimal({amount: "19.99", currencyCode: "USD"}) === 19.99` ✓ (Q1 RESOLVED)
  - `mapToUpsertInput` correctly maps BOTH variant.price shapes
  - `fetchTotalCount` returns null on missing/throttled responses
  - GID → BigInt mapping preserved for product/variants/images/options
- `bunx tsc --noEmit` clean for Phase 2 surface

## Notes

- Vitest mock pattern: used `vi.hoisted({ graphqlRequestMock: vi.fn() })` to expose the mock to the `vi.mock` factory, and inlined the `Graphql` mock as a class (not arrow function — needed for `new`-able constructor). This pattern recurs across Plan 02-06's Inngest function tests too.
- `fetchTotalCount` swallows errors and returns null — this is intentional per D-04: the UI handles `totalCount: null` by showing "X products synced so far" rather than blocking the run.

## Handoff

- Plan 02-06 imports `fetchProductBatch`, `fetchTotalCount`, `mapToUpsertInput` and orchestrates them inside the Inngest step-function
- Plan 02-09 uses `productRepository.findByShopAndHandle(shop, payload.handle)` for the stale-event guard in the webhook handler (D-17)
