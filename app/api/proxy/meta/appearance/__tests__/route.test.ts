import { describe, expect, it, vi } from 'vitest';

const { getShopSettings } = vi.hoisted(() => ({
  getShopSettings: vi.fn().mockResolvedValue({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
    drawerAccent: '#008060',
    greetingMessage: 'Welcome to Acme!',
    suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
    monthlyCapRequests: 500,
    notificationEmail: 'ops@example.com',
    drawerEnabled: false,
    editorPreviewVisible: false,
    fabStyle: 'pill',
    drawerPosition: 'bottom-sheet',
  }),
}));
vi.mock('@/services/settings/getShopSettings', () => ({ getShopSettings }));
// withAppProxyHmac real signature: (handler: (ctx: { shop, query, req }) => Promise<Response>)
// The route only uses shop, so inject minimal ctx.
vi.mock('@/lib/shopify/app-proxy-auth', () => ({
  withAppProxyHmac:
    (handler: (ctx: { shop: string; query: URLSearchParams; req: Request }) => Promise<Response>) =>
    (req: Request) =>
      handler({ shop: 'test.myshopify.com', query: new URLSearchParams(), req }),
}));

import { GET } from '../route';

describe('GET /api/proxy/meta/appearance', () => {
  it('returns the storefront presentation bundle as JSON', async () => {
    const res = await GET(new Request('http://x'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      emptyStateVariant: 'hero',
      cardDensity: 'compact',
      drawerAccent: '#008060',
      greetingMessage: 'Welcome to Acme!',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
      drawerEnabled: false,
      editorPreviewVisible: false,
      fabStyle: 'pill',
      drawerPosition: 'bottom-sheet',
    });
    expect(getShopSettings).toHaveBeenCalledWith('test.myshopify.com');
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
  });

  it('never leaks notificationEmail or monthlyCapRequests to the storefront', async () => {
    const res = await GET(new Request('http://x'));
    const body = await res.json();
    expect(body).not.toHaveProperty('notificationEmail');
    expect(body).not.toHaveProperty('monthlyCapRequests');
  });
});
