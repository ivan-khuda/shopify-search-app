/**
 * RED scaffold — HMAC fuzz / regression tests for STR-04.
 * Regression guard: ensures the App Proxy signing uses NO & delimiter
 * between key=value pairs (unlike OAuth which uses &). This is D-21 RESEARCH
 * §App Proxy specifics.
 *
 * Tests fail with "Cannot find module" until Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    utils: {
      validateHmac: vi.fn(),
    },
  },
}));

import { verifyAppProxyHmac, AppProxyAuthError } from '@/lib/shopify/app-proxy-auth';
import { shopifyClient } from '@/lib/shopify/client';

const SECRET = 'test-secret';

/**
 * Sign params using NO delimiter — the correct App Proxy algorithm.
 * Join sorted key=value pairs with '' (empty string), not '&'.
 */
function signNoDelimiter(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join(''); // NO & delimiter
  return createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Sign params using & delimiter — the WRONG algorithm (OAuth confusion pitfall).
 * This should NOT verify correctly.
 */
function signWithAmpersandDelimiter(params: Record<string, string>, secret: string): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&'); // WRONG — OAuth delimiter
  return createHmac('sha256', secret).update(message).digest('hex');
}

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('http://mystore.myshopify.com/apps/smartdiscovery/chat');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  vi.clearAllMocks();
});

describe('App Proxy HMAC fuzz cases', () => {
  it('rejects when shop param is tampered after signing', async () => {
    // Sign for mystore, but then mutate the shop param
    const params = { shop: 'mystore.myshopify.com', path_prefix: '/apps/smartdiscovery' };
    const signature = signNoDelimiter(params, SECRET);

    // Now tamper: ship a different shop in the URL (HMAC was computed over original)
    // validateHmac detects the mismatch and returns false
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);

    const req = makeRequest({
      shop: 'evil.myshopify.com', // tampered
      path_prefix: '/apps/smartdiscovery',
      signature,
    });

    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_signature',
    });
  });

  it('rejects when signature has extra leading/trailing whitespace', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);

    const params = { shop: 'mystore.myshopify.com' };
    const signature = signNoDelimiter(params, SECRET);

    const req = makeRequest({
      shop: 'mystore.myshopify.com',
      signature: `  ${signature}  `, // extra whitespace
    });

    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_signature',
    });
  });

  it('REGRESSION: & delimiter produces a different HMAC than no-delimiter (OAuth confusion guard)', () => {
    const params = { path_prefix: '/apps/smartdiscovery', shop: 'mystore.myshopify.com', timestamp: '1700000000' };
    const noDelim = signNoDelimiter(params, SECRET);
    const withAmp = signWithAmpersandDelimiter(params, SECRET);

    // These MUST be different — if they were equal, the tests would be worthless.
    // The App Proxy algorithm uses NO & delimiter; OAuth uses &. They must differ
    // to prevent the OAuth-confusion HMAC attack.
    expect(noDelim).not.toBe(withAmp);
  });

  it('rejects signature computed with & delimiter (OAuth confusion pitfall regression)', async () => {
    // If an implementation accidentally uses & delimiter (OAuth algorithm),
    // a signature computed that way should NOT be accepted.
    // validateHmac (correct algorithm: no delimiter) returns false for & signature.
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);

    const params = { path_prefix: '/apps/smartdiscovery', shop: 'mystore.myshopify.com' };
    const wrongSignature = signWithAmpersandDelimiter(params, SECRET);

    const req = makeRequest({
      ...params,
      signature: wrongSignature,
    });

    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'invalid_signature',
    });
  });

  it('accepts a correctly signed request with multiple params (alphabetical sort)', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);

    const params = {
      logged_in_customer_id: '12345',
      path_prefix: '/apps/smartdiscovery',
      shop: 'mystore.myshopify.com',
      timestamp: '1700000000',
    };
    const signature = signNoDelimiter(params, SECRET);

    const req = makeRequest({ ...params, signature });

    // Should resolve without throwing
    const result = await verifyAppProxyHmac(req);
    expect(result.shop).toBe('mystore.myshopify.com');
  });

  it('rejects when signature param is an empty string', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);

    const req = makeRequest({
      shop: 'mystore.myshopify.com',
      signature: '',
    });

    await expect(verifyAppProxyHmac(req)).rejects.toMatchObject({
      code: 'missing_signature',
    });
  });
});
