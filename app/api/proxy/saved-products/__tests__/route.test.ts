/**
 * Tests for IDN-05 — saved products toggle + IDN-02 customer_id cross-check.
 * Updated for CR-03: tests send server-signed visitor tokens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    utils: { validateHmac: vi.fn() },
  },
}));

vi.mock('@/lib/rate-limit/memory', () => ({
  rateLimit: vi.fn().mockReturnValue({ ok: true }),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    savedProduct: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

import { GET, POST } from '@/app/api/proxy/saved-products/route';
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';
import { signVisitorId } from '@/lib/identity/visitor-signature';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';
const VISITOR_UUID = 'visitor-uuid-001-aaaa-bbbbccccdddd';
// CR-03: VISITOR_ID is the signed token sent by the client
let VISITOR_ID: string;
const CUSTOMER_ID = '5570080145486';
const PRODUCT_ID = 'gid://shopify/Product/42';

function signParams(params: Record<string, string>): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function makeRequest(
  method: string,
  searchParams: Record<string, string>,
  body?: unknown
): Request {
  const params = { shop: SHOP, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products`);
  for (const [k, v] of Object.entries({ ...params, signature })) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  // CR-03: mint signed token after secret is set
  VISITOR_ID = signVisitorId(VISITOR_UUID);
  vi.clearAllMocks();
  vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
});

describe('GET /api/proxy/saved-products', () => {
  it('returns saved products for visitor_id and linked customer rows', async () => {
    const mockRows = [
      { shop: SHOP, visitorId: VISITOR_ID, customerId: null, productId: PRODUCT_ID, savedAt: new Date() },
    ];
    vi.mocked(prisma.savedProduct.findMany).mockResolvedValue(mockRows as never);

    const req = makeRequest('GET', { visitor_id: VISITOR_ID });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json() as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('returns 401 without HMAC', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString());
    const response = await GET(req);
    expect(response.status).toBe(401);
  });
});

describe('POST /api/proxy/saved-products', () => {
  it('is idempotent — repeated POST yields the same row count (ON CONFLICT DO NOTHING, D-20)', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    // First POST
    const req1 = makeRequest('POST', { visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      product_id: PRODUCT_ID,
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);

    // Second POST with same data — server uses ON CONFLICT DO NOTHING
    const req2 = makeRequest('POST', { visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      product_id: PRODUCT_ID,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);

    // Both calls succeed; DB handles deduplication
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('returns 401 without HMAC', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: VISITOR_ID, product_id: PRODUCT_ID }),
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('IDN-02: returns 403 customer_id_mismatch when body.customer_id != signed logged_in_customer_id', async () => {
    const params = {
      shop: SHOP,
      visitor_id: VISITOR_ID,
      logged_in_customer_id: CUSTOMER_ID,
    };
    const signature = signParams(params);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products`);
    for (const [k, v] of Object.entries({ ...params, signature })) {
      url.searchParams.set(k, v);
    }

    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: VISITOR_ID,
        customer_id: '9999999', // MISMATCH with signed logged_in_customer_id
        product_id: PRODUCT_ID,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('customer_id_mismatch');
  });

  it('accepts customer_id that matches signed logged_in_customer_id (IDN-02 happy path)', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    const params = {
      shop: SHOP,
      visitor_id: VISITOR_ID,
      logged_in_customer_id: CUSTOMER_ID,
    };
    const signature = signParams(params);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products`);
    for (const [k, v] of Object.entries({ ...params, signature })) {
      url.searchParams.set(k, v);
    }

    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: VISITOR_ID,
        customer_id: CUSTOMER_ID, // MATCHES signed value
        product_id: PRODUCT_ID,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});

describe('CR-03: invalid_visitor_signature rejection', () => {
  it('GET returns 401 invalid_visitor_signature for a bare unsigned visitor_id', async () => {
    const req = makeRequest('GET', { visitor_id: VISITOR_UUID }); // bare, not signed
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('invalid_visitor_signature');
    expect(prisma.savedProduct.findMany).not.toHaveBeenCalled();
  });

  it('POST returns 401 invalid_visitor_signature for a tampered visitor_id', async () => {
    const req = makeRequest('POST', { visitor_id: VISITOR_UUID }, {
      visitor_id: VISITOR_UUID, // bare uuid — no server signature
      product_id: PRODUCT_ID,
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('invalid_visitor_signature');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
