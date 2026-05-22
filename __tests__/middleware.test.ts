import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      getOfflineId: vi.fn(),
    },
  },
}));

vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: {
    loadSession: vi.fn(),
  },
}));

import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';
// TODO(Plan 07): update to import { proxy } from '../proxy' after Next.js 16 migration (D-08).
import { middleware } from '../middleware';

const makeRequest = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, { headers });

describe('middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows request when shop has offline session', async () => {
    vi.mocked(shopifyClient.session.getOfflineId).mockReturnValue('offline_test.myshopify.com');
    vi.mocked(sessionStorage.loadSession).mockResolvedValue({ shop: 'test.myshopify.com' } as never);

    const request = makeRequest('/chat?shop=test.myshopify.com');
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it('redirects to /api/auth when no offline session found', async () => {
    vi.mocked(shopifyClient.session.getOfflineId).mockReturnValue('offline_test.myshopify.com');
    vi.mocked(sessionStorage.loadSession).mockResolvedValue(undefined);

    const request = makeRequest('/chat?shop=test.myshopify.com');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/api/auth');
  });

  it('redirects when no shop can be determined', async () => {
    const request = makeRequest('/chat');
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  it('redirects to /api/auth without shop param when shop query is missing', async () => {
    // D-09: middleware only reads shop from ?shop= query param
    // When ?shop= is absent, redirect to /api/auth with no shop= param
    const request = makeRequest('/chat');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('Location') ?? '';
    expect(location).toContain('/api/auth');
    expect(location).not.toContain('shop=');
  });
});
