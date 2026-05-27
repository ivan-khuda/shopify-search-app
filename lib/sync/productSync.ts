/**
 * Phase 2 sync orchestrator stub.
 *
 * The real sync workflow lives in the Inngest step-function at
 * `inngest/functions/sync-products.ts` (Plan 02-06) — that's where the
 * actual loop over Shopify GraphQL batches and ProductRepository upserts
 * runs.
 *
 * This file is kept for callers that want a thin sync helper outside the
 * Inngest runtime (e.g. CLI scripts, future ad-hoc backfills). For V1 it
 * just re-exports the service functions so callers can wire their own loop.
 */
export {
  fetchProductBatch,
  fetchTotalCount,
  mapToUpsertInput,
  PRODUCTS_QUERY,
  PRODUCTS_COUNT_QUERY,
  toDecimal,
} from '@/services/shopify/ShopifyProductService';
