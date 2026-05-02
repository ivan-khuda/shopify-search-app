import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      decodeSessionToken: vi.fn(),
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

  it('extracts shop from valid App Bridge Bearer token', async () => {
    vi.mocked(shopifyClient.session.decodeSessionToken).mockReturnValue({
      dest: 'https://test.myshopify.com',
    } as never);
    vi.mocked(shopifyClient.session.getOfflineId).mockReturnValue('offline_test.myshopify.com');
    vi.mocked(sessionStorage.loadSession).mockResolvedValue({ shop: 'test.myshopify.com' } as never);

    const request = makeRequest('/chat', { Authorization: 'Bearer valid.jwt.token' });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(shopifyClient.session.decodeSessionToken).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('redirects when Bearer token is invalid', async () => {
    vi.mocked(shopifyClient.session.decodeSessionToken).mockImplementation(() => {
      throw new Error('invalid token');
    });

    const request = makeRequest('/chat', { Authorization: 'Bearer bad.token' });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/api/auth');
  });

  it('redirects when no shop can be determined', async () => {
    const request = makeRequest('/chat');
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });
});
