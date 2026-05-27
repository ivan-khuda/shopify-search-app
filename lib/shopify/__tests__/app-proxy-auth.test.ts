/**
 * RED scaffold for STR-04 + IDN-02.
 * Tests import from modules that do not yet exist — they will fail with
 * "Cannot find module" until Wave 2 ships the implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Mocks must be declared before the hoisted imports ───────────────────────
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    utils: {
      validateHmac: vi.fn(),
    },
  },
}));

import {
  verifyAppProxyHmac,
  withAppProxyHmac,
  AppProxyAuthError,
} from '@/lib/shopify/app-proxy-auth';
import { shopifyClient } from '@/lib/shopify/client';

// ── HMAC signing helper (no & delimiter — D-21 App Proxy specifics) ─────────
function signParams(params: Record<string, string>, secret: string): string {
  // Sort keys alphabetically, join as key=value with NO delimiter, HMAC-SHA256
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHmac('sha256', secret).update(message).digest('hex');
}

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('http://mystore.myshopify.com/apps/smartdiscovery/chat');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

const SECRET = 'test-secret';

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  vi.clearAllMocks();
});

// ── verifyAppProxyHmac ───────────────────────────────────────────────────────

describe('verifyAppProxyHmac', () => {
  it('throws AppProxyAuthError("missing_signature") when signature param is absent', async () => {
    // shopifyClient.utils.validateHmac should not be called when signature is missing
    const req = makeRequest({ shop: 'mystore.myshopify.com' });
    await expect(verifyAppProxyHmac(req)).rejects.toThrow(AppProxyAuthError);
    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'missing_signature',
    });
  });

  it('throws AppProxyAuthError("invalid_signature") when HMAC validation fails', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const req = makeRequest({
      shop: 'mystore.myshopify.com',
      signature: 'badsignature',
    });
    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_signature',
    });
  });

  it('throws AppProxyAuthError("invalid_shop_domain") when shop does not end with .myshopify.com', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
    const params = { shop: 'evil.attacker.com' };
    const signature = signParams(params, SECRET);
    const req = makeRequest({ ...params, signature });
    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_shop_domain',
    });
  });

  it('returns { shop, query } on a valid HMAC-signed request with correct shop domain', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
    const params = { shop: 'mystore.myshopify.com', visitor_id: 'uuid-123' };
    const signature = signParams(params, SECRET);
    const req = makeRequest({ ...params, signature });

    const result = await verifyAppProxyHmac(req);

    expect(result.shop).toBe('mystore.myshopify.com');
    expect(result.query.get('shop')).toBe('mystore.myshopify.com');
    expect(result.query.get('visitor_id')).toBe('uuid-123');
  });

  it('derives shop from signed query params, never from unsanitized raw param', async () => {
    // If the actual shop param that was signed is different from what's in the URL,
    // the HMAC will fail — this test documents that shop comes from validated query.
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const req = makeRequest({
      shop: 'evil.myshopify.com',
      signature: 'forged',
    });
    // Must reject because HMAC is invalid — shop must NEVER be used before validation.
    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_signature',
    });
    // validateHmac must have been called (not short-circuited)
    expect(shopifyClient.utils.validateHmac).toHaveBeenCalled();
  });

  it('surfaces AppProxyAuthError as JSON { error: code } via withAppProxyHmac wrapper', async () => {
    // Missing signature → AppProxyAuthError → JSON 401
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withAppProxyHmac(handler);
    const req = makeRequest({ shop: 'mystore.myshopify.com' });
    const response = await wrapped(req);

    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('missing_signature');
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler with { shop, query, req } when HMAC is valid', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
    const params = { shop: 'mystore.myshopify.com', visitor_id: 'abc' };
    const signature = signParams(params, SECRET);
    const req = makeRequest({ ...params, signature });

    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withAppProxyHmac(handler);
    const response = await wrapped(req);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'mystore.myshopify.com', req })
    );
    expect(response.status).toBe(200);
  });

  it('IDN-02: returns 403 customer_id_mismatch when body.customer_id != signed logged_in_customer_id', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
    const params = {
      shop: 'mystore.myshopify.com',
      logged_in_customer_id: '111',
    };
    const signature = signParams(params, SECRET);

    // Request body has a different customer_id than what was signed
    const req = new Request(
      `http://mystore.myshopify.com/apps/smartdiscovery/chat?shop=${params.shop}&logged_in_customer_id=${params.logged_in_customer_id}&signature=${signature}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: 'v1',
          customer_id: '999', // does NOT match signed logged_in_customer_id '111'
        }),
      }
    );

    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withAppProxyHmac(handler);
    const response = await wrapped(req);

    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('customer_id_mismatch');
    expect(handler).not.toHaveBeenCalled();
  });
});
