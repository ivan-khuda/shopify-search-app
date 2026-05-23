/**
 * GREEN test file for SYN-01, SYN-02 (post-Plan-02-05).
 *
 * Covers fetchProductBatch, fetchTotalCount, mapToUpsertInput, toDecimal —
 * including the BOTH-shapes test for variant.price (String AND MoneyV2) per
 * RESEARCH.md Q1 RESOLVED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { graphqlRequestMock } = vi.hoisted(() => ({
  graphqlRequestMock: vi.fn(),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    clients: {
      Graphql: class {
        request = graphqlRequestMock;
      },
    },
  },
}));

import {
  fetchProductBatch,
  fetchTotalCount,
  mapToUpsertInput,
  toDecimal,
  type ShopifyProductNode,
} from '../ShopifyProductService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toDecimal (RESEARCH.md Q1 RESOLVED)', () => {
  it('handles String shape: "19.99" → 19.99', () => {
    expect(toDecimal('19.99')).toBeCloseTo(19.99);
  });

  it('handles MoneyV2 shape: { amount: "19.99", currencyCode: "USD" } → 19.99', () => {
    expect(toDecimal({ amount: '19.99', currencyCode: 'USD' })).toBeCloseTo(19.99);
  });

  it('returns NaN for unrecognized shapes', () => {
    expect(Number.isNaN(toDecimal(null))).toBe(true);
    expect(Number.isNaN(toDecimal(undefined))).toBe(true);
    expect(Number.isNaN(toDecimal({}))).toBe(true);
  });
});

describe('fetchProductBatch (SYN-01)', () => {
  it('calls products(first: 100, after: cursor) and returns {products, endCursor, hasNextPage}', async () => {
    graphqlRequestMock.mockResolvedValueOnce({
      data: {
        products: {
          nodes: [{ id: 'gid://shopify/Product/1', title: 'A', handle: 'a' }],
          pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
        },
      },
    });
    const result = await fetchProductBatch({ shop: 'a.myshopify.com' } as never, null, 100);
    expect(graphqlRequestMock).toHaveBeenCalledTimes(1);
    expect(graphqlRequestMock.mock.calls[0][1]).toEqual({
      variables: { first: 100, after: null },
    });
    expect(result.products).toHaveLength(1);
    expect(result.endCursor).toBe('cursor-1');
    expect(result.hasNextPage).toBe(true);
  });

  it('throws when GraphQL response is malformed', async () => {
    graphqlRequestMock.mockResolvedValueOnce({ data: {} });
    await expect(fetchProductBatch({ shop: 'a.myshopify.com' } as never, null, 100)).rejects.toThrow(
      /malformed GraphQL response/
    );
  });
});

describe('fetchTotalCount', () => {
  it('returns the count from productsCount query', async () => {
    graphqlRequestMock.mockResolvedValueOnce({ data: { productsCount: { count: 247 } } });
    const result = await fetchTotalCount({ shop: 'a.myshopify.com' } as never);
    expect(result).toBe(247);
  });

  it('returns null when the count is missing (D-04 graceful fallback)', async () => {
    graphqlRequestMock.mockResolvedValueOnce({ data: {} });
    const result = await fetchTotalCount({ shop: 'a.myshopify.com' } as never);
    expect(result).toBeNull();
  });

  it('returns null when the query throws', async () => {
    graphqlRequestMock.mockRejectedValueOnce(new Error('throttled'));
    const result = await fetchTotalCount({ shop: 'a.myshopify.com' } as never);
    expect(result).toBeNull();
  });
});

describe('mapToUpsertInput (SYN-02)', () => {
  const baseNode: ShopifyProductNode = {
    id: 'gid://shopify/Product/123',
    title: 'Test Product',
    handle: 'test-product',
    description: 'A test product',
    vendor: 'TestCo',
    productType: 'Widget',
    status: 'ACTIVE',
    tags: ['new', 'featured'],
    updatedAt: '2026-05-23T10:00:00Z',
    publishedAt: '2026-05-01T00:00:00Z',
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/456',
          title: 'Default',
          sku: 'SKU-1',
          price: '19.99',
          compareAtPrice: '29.99',
          availableForSale: true,
          selectedOptions: [{ name: 'Size', value: 'M' }],
        },
      ],
    },
    images: {
      nodes: [
        {
          id: 'gid://shopify/ProductImage/789',
          url: 'https://cdn.shopify.com/img.jpg',
          altText: 'alt',
          width: 100,
          height: 100,
        },
      ],
    },
    options: {
      nodes: [{ id: 'gid://shopify/ProductOption/999', name: 'Size', position: 1, values: ['S', 'M', 'L'] }],
    },
  };

  it('maps GraphQL Product node to ProductUpsertInput including updatedAtShopify (D-17)', () => {
    const result = mapToUpsertInput(baseNode);
    expect(result.title).toBe('Test Product');
    expect(result.handle).toBe('test-product');
    expect(result.shopifyId).toBe(BigInt(123));
    expect(result.tags).toEqual(['new', 'featured']);
    expect(result.updatedAtShopify).toBeInstanceOf(Date);
    expect((result.updatedAtShopify as Date).toISOString()).toBe('2026-05-23T10:00:00.000Z');
  });

  it('maps variant.price (String shape) correctly', () => {
    const result = mapToUpsertInput(baseNode);
    expect(result.variants?.[0].price).toBeCloseTo(19.99);
    expect(result.variants?.[0].compareAtPrice).toBeCloseTo(29.99);
  });

  it('maps variant.price (MoneyV2 shape) correctly — Q1 RESOLVED', () => {
    const moneyV2Node: ShopifyProductNode = {
      ...baseNode,
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/456',
            title: 'Default',
            price: { amount: '24.50', currencyCode: 'USD' },
            compareAtPrice: { amount: '34.50', currencyCode: 'USD' },
            selectedOptions: [],
          },
        ],
      },
    };
    const result = mapToUpsertInput(moneyV2Node);
    expect(result.variants?.[0].price).toBeCloseTo(24.5);
    expect(result.variants?.[0].compareAtPrice).toBeCloseTo(34.5);
  });

  it('handles missing optional fields without throwing', () => {
    const minimal: ShopifyProductNode = {
      id: 'gid://shopify/Product/1',
      title: 'Min',
      handle: 'min',
    };
    const result = mapToUpsertInput(minimal);
    expect(result.title).toBe('Min');
    expect(result.tags).toEqual([]);
    expect(result.variants).toEqual([]);
    expect(result.images).toEqual([]);
    expect(result.options).toEqual([]);
    expect(result.updatedAtShopify).toBeNull();
  });

  it('preserves Shopify GID → BigInt mapping for product, variants, images, options', () => {
    const result = mapToUpsertInput(baseNode);
    expect(result.shopifyId).toBe(BigInt(123));
    expect(result.variants?.[0].shopifyId).toBe(BigInt(456));
    expect(result.images?.[0].shopifyId).toBe(BigInt(789));
    expect(result.options?.[0].shopifyId).toBe(BigInt(999));
  });
});
