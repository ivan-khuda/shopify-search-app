import { describe, expect, it, vi } from 'vitest';

const { getShopAppearance } = vi.hoisted(() => ({
  getShopAppearance: vi.fn().mockResolvedValue({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
  }),
}));
vi.mock('@/services/chat/getShopAppearance', () => ({ getShopAppearance }));
// withAppProxyHmac real signature: (handler: (ctx: { shop, query, req }) => Promise<Response>)
// The route only uses shop, so inject minimal ctx.
vi.mock('@/lib/shopify/app-proxy-auth', () => ({
  withAppProxyHmac:
    (handler: (ctx: { shop: string; query: URLSearchParams; req: Request }) => Promise<Response>) =>
    (req: Request) =>
      handler({ shop: 'test.myshopify.com', query: new URLSearchParams(), req }),
}));

import { GET } from '../route';

describe('GET /api/proxy/_meta/appearance', () => {
  it('returns the shop appearance as JSON', async () => {
    const res = await GET(new Request('http://x'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      emptyStateVariant: 'hero',
      cardDensity: 'compact',
    });
    expect(getShopAppearance).toHaveBeenCalledWith('test.myshopify.com');
  });
});
