/**
 * Tests for IDN-05 — saved products single-product delete.
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
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { DELETE } from '@/app/api/proxy/saved-products/[productId]/route';
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';
import { signVisitorId } from '@/lib/identity/visitor-signature';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';
const VISITOR_UUID = 'visitor-uuid-001-aaaa-bbbbccccdddd';
// CR-03: VISITOR_ID is the signed token; VISITOR_UUID is the bare uuid used in DB
let VISITOR_ID: string;
const PRODUCT_ID = 'gid://shopify/Product/42';
const ENCODED_PRODUCT_ID = encodeURIComponent(PRODUCT_ID);

function signParams(params: Record<string, string>): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function makeRequest(
  productId: string,
  searchParams: Record<string, string>
): Request {
  const params = { shop: SHOP, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products/${productId}`);
  for (const [k, v] of Object.entries({ ...params, signature })) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'DELETE' });
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  // CR-03: mint signed token after secret is set
  VISITOR_ID = signVisitorId(VISITOR_UUID);
  vi.clearAllMocks();
  vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
});

describe('DELETE /api/proxy/saved-products/[productId]', () => {
  it('removes a single saved product row matching shop + visitor + productId', async () => {
    // DB rows store the bare uuid, not the signed token
    vi.mocked(prisma.savedProduct.findFirst).mockResolvedValue({
      shop: SHOP,
      visitorId: VISITOR_UUID,
      productId: PRODUCT_ID,
    } as never);
    vi.mocked(prisma.savedProduct.deleteMany).mockResolvedValue({ count: 1 });

    const req = makeRequest(ENCODED_PRODUCT_ID, { visitor_id: VISITOR_ID });
    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { deleted: number };
    expect(body.deleted).toBe(1);
    expect(prisma.savedProduct.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shop: SHOP, visitorId: VISITOR_UUID }),
      })
    );
  });

  it('returns 403 when saved product belongs to a different shop', async () => {
    vi.mocked(prisma.savedProduct.findFirst).mockResolvedValue({
      shop: 'other.myshopify.com',
      visitorId: VISITOR_UUID,
      productId: PRODUCT_ID,
    } as never);

    const req = makeRequest(ENCODED_PRODUCT_ID, { visitor_id: VISITOR_ID });
    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 400 when visitor_id is missing from query', async () => {
    const params = { shop: SHOP };
    const signature = signParams(params);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products/${ENCODED_PRODUCT_ID}`);
    url.searchParams.set('shop', SHOP);
    url.searchParams.set('signature', signature);
    const req = new Request(url.toString(), { method: 'DELETE' });

    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain('visitor_id');
  });

  it('returns 404 when the saved product row does not exist', async () => {
    vi.mocked(prisma.savedProduct.findFirst).mockResolvedValue(null);

    const req = makeRequest(ENCODED_PRODUCT_ID, { visitor_id: VISITOR_ID });
    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 401 when HMAC is invalid', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/saved-products/${ENCODED_PRODUCT_ID}`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString(), { method: 'DELETE' });

    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });

    expect(response.status).toBe(401);
  });
});

describe('CR-03: invalid_visitor_signature rejection', () => {
  it('DELETE returns 401 invalid_visitor_signature for a bare unsigned visitor_id before DB', async () => {
    const req = makeRequest(ENCODED_PRODUCT_ID, { visitor_id: VISITOR_UUID }); // bare uuid
    const response = await DELETE(req, {
      params: Promise.resolve({ productId: ENCODED_PRODUCT_ID }),
    });
    expect(response.status).toBe(401);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('invalid_visitor_signature');
    expect(prisma.savedProduct.findFirst).not.toHaveBeenCalled();
  });
});
