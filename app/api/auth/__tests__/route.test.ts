import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { GET as callbackGET } from '../callback/route';
import { GET as onlineGET } from '../online/route';
import { Session } from '@shopify/shopify-api';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    auth: {
      begin: vi.fn(),
      callback: vi.fn(),
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

describe('GET /api/auth/callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores offline session and redirects to online OAuth', async () => {
    const mockSession = new Session({
      id: 'offline_test.myshopify.com',
      shop: 'test.myshopify.com',
      state: 'state123',
      isOnline: false,
      accessToken: 'shpat_abc',
      scope: 'read_products',
    });

    vi.mocked(shopifyClient.auth.callback).mockResolvedValue({
      session: mockSession,
      headers: undefined,
    } as never);

    const request = new Request(
      'http://localhost/api/auth/callback?code=abc&hmac=xyz&shop=test.myshopify.com&state=state123&timestamp=1000'
    );
    const response = await callbackGET(request);

    expect(shopifyClient.auth.callback).toHaveBeenCalledWith({ rawRequest: request });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/api/auth/online');
  });
});

describe('GET /api/auth/online', () => {
  beforeEach(() => vi.clearAllMocks());

  it('begins online OAuth for valid shop', async () => {
    const mockRedirect = new Response(null, {
      status: 302,
      headers: { Location: 'https://test.myshopify.com/admin/oauth/authorize' },
    });
    vi.mocked(shopifyClient.auth.begin).mockResolvedValue(mockRedirect as never);

    const request = new Request('http://localhost/api/auth/online?shop=test.myshopify.com');
    const response = await onlineGET(request);

    expect(shopifyClient.auth.begin).toHaveBeenCalledWith({
      shop: 'test.myshopify.com',
      callbackPath: '/api/auth/online/callback',
      isOnline: true,
      rawRequest: request,
    });
    expect(response.status).toBe(302);
  });

  it('returns 400 when shop param is missing', async () => {
    const request = new Request('http://localhost/api/auth/online');
    const response = await onlineGET(request);
    expect(response.status).toBe(400);
  });
});

import { GET as onlineCallbackGET } from '../online/callback/route';

describe('GET /api/auth/online/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHOPIFY_APP_HANDLE = 'test-app';
  });

  afterEach(() => {
    delete process.env.SHOPIFY_APP_HANDLE;
  });

  it('stores online session and redirects to onboarding', async () => {
    const mockSession = new Session({
      id: 'test.myshopify.com_123',
      shop: 'test.myshopify.com',
      state: 'state456',
      isOnline: true,
      accessToken: 'shpua_xyz',
      scope: 'read_products',
      userId: BigInt(123456),
    });

    vi.mocked(shopifyClient.auth.callback).mockResolvedValue({
      session: mockSession,
      headers: undefined,
    } as never);

    const request = new Request(
      'http://localhost/api/auth/online/callback?code=abc&hmac=xyz&shop=test.myshopify.com&state=state456&timestamp=1000'
    );
    const response = await onlineCallbackGET(request);

    expect(shopifyClient.auth.callback).toHaveBeenCalledWith({ rawRequest: request });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('test.myshopify.com/admin/apps');
    expect(response.headers.get('Location')).toContain('/onboarding');
  });

  it('returns 500 when SHOPIFY_APP_HANDLE is not configured', async () => {
    delete process.env.SHOPIFY_APP_HANDLE;

    const mockSession = new Session({
      id: 'test.myshopify.com_123',
      shop: 'test.myshopify.com',
      state: 'state456',
      isOnline: true,
      accessToken: 'shpua_xyz',
      scope: 'read_products',
      userId: BigInt(123456),
    });

    vi.mocked(shopifyClient.auth.callback).mockResolvedValue({
      session: mockSession,
      headers: undefined,
    } as never);

    const request = new Request(
      'http://localhost/api/auth/online/callback?code=abc&hmac=xyz&shop=test.myshopify.com&state=state456&timestamp=1000'
    );
    const response = await onlineCallbackGET(request);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('SHOPIFY_APP_HANDLE env var not configured');
  });
});
