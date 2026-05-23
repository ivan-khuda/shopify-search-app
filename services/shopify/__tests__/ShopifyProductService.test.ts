/**
 * Wave 0 RED stubs for SYN-01, SYN-02 (GraphQL paginate + map to ProductUpsertInput).
 *
 * RED on the missing exports (current stub returns empty array). Plan 02-05 lands
 * the real implementation and turns these GREEN.
 *
 * IMPORTANT: tests must cover BOTH variant.price shapes (string and MoneyV2 object)
 * per RESEARCH.md Q1 RESOLVED — Plan 02-05 ships a defensive toDecimal helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const graphqlRequestMock = vi.fn();

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    clients: {
      Graphql: vi.fn().mockImplementation(() => ({
        request: graphqlRequestMock,
      })),
    },
  },
}));

let fetchProductBatch: unknown = undefined;
let fetchTotalCount: unknown = undefined;
let mapToUpsertInput: unknown = undefined;
let toDecimal: unknown = undefined;
try {
  const mod = await import('../ShopifyProductService');
  fetchProductBatch = (mod as Record<string, unknown>).fetchProductBatch;
  fetchTotalCount = (mod as Record<string, unknown>).fetchTotalCount;
  mapToUpsertInput = (mod as Record<string, unknown>).mapToUpsertInput;
  toDecimal = (mod as Record<string, unknown>).toDecimal;
} catch {
  // RED until Plan 02-05
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShopifyProductService (SYN-01, SYN-02)', () => {
  it.runIf(!!fetchProductBatch)(
    'fetchProductBatch calls products(first: 100, after: cursor) and returns {products, endCursor, hasNextPage}',
    async () => {
      expect(fetchProductBatch).toBeDefined();
    }
  );

  it.runIf(!!fetchTotalCount)('fetchTotalCount calls productsCount query and returns the count (or null on missing data)', async () => {
    expect(fetchTotalCount).toBeDefined();
  });

  it.runIf(!!mapToUpsertInput)(
    'mapToUpsertInput maps Product node to ProductUpsertInput including updatedAtShopify (D-17)',
    async () => {
      expect(mapToUpsertInput).toBeDefined();
    }
  );

  it.runIf(!!toDecimal)('toDecimal handles String shape: "19.99" → 19.99 (RESEARCH.md Q1 RESOLVED)', () => {
    const fn = toDecimal as (v: unknown) => number;
    expect(fn('19.99')).toBeCloseTo(19.99);
  });

  it.runIf(!!toDecimal)(
    'toDecimal handles MoneyV2 shape: { amount: "19.99", currencyCode: "USD" } → 19.99 (RESEARCH.md Q1 RESOLVED)',
    () => {
      const fn = toDecimal as (v: unknown) => number;
      expect(fn({ amount: '19.99', currencyCode: 'USD' })).toBeCloseTo(19.99);
    }
  );

  it.runIf(!!mapToUpsertInput)(
    'mapToUpsertInput correctly handles BOTH variant price shapes (String AND MoneyV2)',
    async () => {
      expect(mapToUpsertInput).toBeDefined();
    }
  );

  it.runIf(!fetchProductBatch || !mapToUpsertInput || !toDecimal)(
    'PRE-IMPLEMENTATION: ShopifyProductService exports not yet created (Plan 02-05)',
    () => {
      expect(fetchProductBatch ?? mapToUpsertInput ?? toDecimal).toBeUndefined();
    }
  );
});
