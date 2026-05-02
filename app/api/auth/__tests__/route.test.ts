import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    auth: {
      begin: vi.fn(),
    },
  },
}));

import { shopifyClient } from '@/lib/shopify/client';

describe('GET /api/auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to Shopify OAuth for valid shop param', async () => {
    const mockRedirect = new Response(null, {
      status: 302,
      headers: { Location: 'https://test.myshopify.com/admin/oauth/authorize' },
    });
    vi.mocked(shopifyClient.auth.begin).mockResolvedValue(mockRedirect as never);

    const request = new Request('http://localhost/api/auth?shop=test.myshopify.com');
    const response = await GET(request);

    expect(shopifyClient.auth.begin).toHaveBeenCalledWith({
      shop: 'test.myshopify.com',
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: request,
    });
    expect(response.status).toBe(302);
  });

  it('returns 400 when shop param is missing', async () => {
    const request = new Request('http://localhost/api/auth');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});
