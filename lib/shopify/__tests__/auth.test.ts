import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/shopify/client', () => {
  return {
    shopifyClient: {
      session: {
        decodeSessionToken: vi.fn(),
        getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
      },
    },
  };
});

vi.mock('@/lib/shopify/session-storage', () => {
  return {
    sessionStorage: {
      loadSession: vi.fn(),
    },
  };
});

import { verifyShopSessionToken, withShopifySession, ShopifyAuthError } from '../auth';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('verifyShopSessionToken', () => {
  it('throws ShopifyAuthError("missing_token") when Authorization header is absent', async () => {
    const req = new Request('http://localhost/', { method: 'POST' });
    await expect(verifyShopSessionToken(req)).rejects.toThrow(ShopifyAuthError);
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'missing_token' });
  });

  it('throws ShopifyAuthError("missing_token") when Authorization does not start with "Bearer "', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Token something' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'missing_token' });
  });

  it('throws ShopifyAuthError("invalid_token") when decodeSessionToken rejects', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad token')
    );
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer broken' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('throws ShopifyAuthError("invalid_dest") when payload.dest is missing', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      // dest is intentionally absent
    });
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'invalid_dest' });
  });

  it('throws ShopifyAuthError("invalid_dest") when payload.dest is not a parseable URL', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'not-a-url',
    });
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    // NOTE: D-06 — invalid_dest is a distinct code split out from invalid_token
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'invalid_dest' });
  });

  it('throws ShopifyAuthError("invalid_shop_domain") when hostname does not end with .myshopify.com', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://attacker.example.com',
    });
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'invalid_shop_domain' });
  });

  it('throws ShopifyAuthError("no_offline_session") when sessionStorage.loadSession returns undefined', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'no_offline_session' });
  });

  it('throws ShopifyAuthError("no_offline_session") when sessionStorage.loadSession returns null', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    await expect(verifyShopSessionToken(req)).rejects.toMatchObject({ code: 'no_offline_session' });
  });

  it('returns { shop, session } on success with shop equal to the dest hostname', async () => {
    const mockSession = {
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    };
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });

    const result = await verifyShopSessionToken(req);

    expect(result.shop).toBe('example-shop.myshopify.com');
    expect(result.session).toBe(mockSession);
    expect(shopifyClient.session.getOfflineId).toHaveBeenCalledWith('example-shop.myshopify.com');
  });
});

describe('withShopifySession', () => {
  it('invokes handler with { shop, session, req } on success and returns its Response', async () => {
    const mockSession = {
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    };
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

    const handlerMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedHandler = withShopifySession(handlerMock);

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });

    const response = await wrappedHandler(req);

    expect(handlerMock).toHaveBeenCalledWith({
      shop: 'example-shop.myshopify.com',
      session: mockSession,
      req,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it.each([
    ['missing_token', undefined, undefined],
    ['invalid_token', 'broken', 'DECODE_THROWS'],
    ['invalid_dest', 'good', { dest: undefined }],
    ['invalid_shop_domain', 'good', { dest: 'https://attacker.example.com' }],
    ['no_offline_session', 'good', { dest: 'https://example-shop.myshopify.com' }],
  ] as const)(
    'returns 401 with { error: "%s" } for ShopifyAuthError code %s',
    async (code, bearerToken, decodedPayload) => {
      if (code === 'invalid_token') {
        (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('bad token')
        );
      } else if (decodedPayload === undefined) {
        // missing_token — no mocking needed, no Authorization header
      } else {
        (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue(
          decodedPayload
        );
      }

      if (code === 'no_offline_session') {
        (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      }

      const headers: Record<string, string> = {};
      if (bearerToken !== undefined) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }

      const req = new Request('http://localhost/', {
        method: 'POST',
        headers,
      });

      const handler = vi.fn().mockResolvedValue(new Response('should not reach', { status: 200 }));
      const wrappedHandler = withShopifySession(handler);
      const response = await wrappedHandler(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toMatchObject({ error: code });
      expect(handler).not.toHaveBeenCalled();
    }
  );
});
