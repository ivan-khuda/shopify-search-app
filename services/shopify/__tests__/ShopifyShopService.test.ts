/**
 * Phase 8 Wave 0 RED scaffold — anchors D-05 (skip email when contactEmail missing).
 *
 * Pins the fetchShopContactEmail contract:
 *   - happy path: returns the email string
 *   - null contactEmail: returns null
 *   - empty string: returns null
 *   - GraphQL throw: returns null (NOT throws — per D-05 notifications are auxiliary)
 *
 * Implementation lands in Plan 08-05 at services/shopify/ShopifyShopService.ts.
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

beforeEach(() => {
  vi.clearAllMocks();
});

const mockSession = {
  id: 'offline_test-shop.myshopify.com',
  shop: 'test-shop.myshopify.com',
  accessToken: 'shpat_xxx',
} as never;

describe('fetchShopContactEmail (D-05)', () => {
  it('returns the contactEmail on happy path', async () => {
    graphqlRequestMock.mockResolvedValueOnce({
      data: { shop: { contactEmail: 'owner@example.com' } },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-05).
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    const result = await fetchShopContactEmail(mockSession);
    expect(result).toBe('owner@example.com');
  });

  it('returns null when shop.contactEmail is null', async () => {
    graphqlRequestMock.mockResolvedValueOnce({
      data: { shop: { contactEmail: null } },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    const result = await fetchShopContactEmail(mockSession);
    expect(result).toBeNull();
  });

  it('returns null when shop.contactEmail is an empty string', async () => {
    graphqlRequestMock.mockResolvedValueOnce({
      data: { shop: { contactEmail: '' } },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    const result = await fetchShopContactEmail(mockSession);
    expect(result).toBeNull();
  });

  it('returns null when the GraphQL client throws (D-05 — does NOT bubble)', async () => {
    graphqlRequestMock.mockRejectedValueOnce(new Error('GraphQL 500'));
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    const result = await fetchShopContactEmail(mockSession);
    expect(result).toBeNull();
  });

  it('returns null when the response shape is malformed (missing shop)', async () => {
    graphqlRequestMock.mockResolvedValueOnce({ data: {} });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    const result = await fetchShopContactEmail(mockSession);
    expect(result).toBeNull();
  });

  it('issues a GraphQL query mentioning shop { contactEmail }', async () => {
    graphqlRequestMock.mockResolvedValueOnce({
      data: { shop: { contactEmail: 'owner@example.com' } },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { fetchShopContactEmail } = await import('@/services/shopify/ShopifyShopService');
    await fetchShopContactEmail(mockSession);
    expect(graphqlRequestMock).toHaveBeenCalledTimes(1);
    const queryArg = String(graphqlRequestMock.mock.calls[0][0] ?? '');
    expect(queryArg).toMatch(/shop\s*\{[\s\S]*contactEmail/);
  });
});
