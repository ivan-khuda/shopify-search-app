/**
 * GREEN tests for POST /api/shopify/webhook (SYN-10, SYN-11).
 * Post-Plan-02-09 implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  validateMock,
  webhookCreateMock,
  productFindFirstMock,
  upsertProductMock,
  deleteProductMock,
  findByShopAndHandleMock,
  // Phase 3 additions (plan 03-01 RED scaffold)
  embedAndStoreMock,
  buildSearchableTextMock,
} = vi.hoisted(() => ({
  validateMock: vi.fn(),
  webhookCreateMock: vi.fn(),
  productFindFirstMock: vi.fn(),
  upsertProductMock: vi.fn(),
  deleteProductMock: vi.fn(),
  findByShopAndHandleMock: vi.fn(),
  embedAndStoreMock: vi.fn(),
  buildSearchableTextMock: vi.fn((_p: unknown) => 'mocked-text'),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: { webhooks: { validate: validateMock } },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    webhookEvent: { create: webhookCreateMock },
    product: { findFirst: productFindFirstMock },
  },
}));

vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: {
    upsertProduct: upsertProductMock,
    deleteProduct: deleteProductMock,
    findByShopAndHandle: findByShopAndHandleMock,
  },
}));

// Phase 3 additions (plan 03-01) — EmbeddingService + buildSearchableText
vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embedAndStore: embedAndStoreMock,
}));

vi.mock('@/services/search/searchableText', () => ({
  buildSearchableText: buildSearchableTextMock,
}));

import { POST } from '../route';

function makeRequest(body: object | string): Request {
  return new Request('http://localhost/api/shopify/webhook', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'X-Shopify-Hmac-Sha256': 'mock-hmac', 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/shopify/webhook (SYN-10, SYN-11)', () => {
  it('returns 401 invalid_hmac when shopifyClient.webhooks.validate returns valid:false', async () => {
    validateMock.mockResolvedValue({ valid: false });
    const res = await POST(makeRequest({ id: 1, handle: 'x' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_hmac' });
    expect(webhookCreateMock).not.toHaveBeenCalled();
    expect(upsertProductMock).not.toHaveBeenCalled();
  });

  it('returns 200 dedup when WebhookEvent.create throws Prisma P2002 unique violation', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-1',
    });
    const dupErr = Object.assign(new Error('dup'), { code: 'P2002' });
    webhookCreateMock.mockRejectedValueOnce(dupErr);
    const res = await POST(makeRequest({ id: 1, handle: 'x', updated_at: new Date().toISOString() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dedup).toBe(true);
    expect(upsertProductMock).not.toHaveBeenCalled();
  });

  it('products/update calls productRepository.upsertProduct with mapped payload (includes updatedAtShopify)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-2',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce(null); // no existing row
    upsertProductMock.mockResolvedValueOnce({ id: 1, shop: 'test.myshopify.com' });

    const res = await POST(makeRequest({
      id: 123456,
      title: 'Shoe',
      handle: 'shoe',
      body_html: '<p>Nice shoe</p>',
      vendor: 'Nike',
      product_type: 'Footwear',
      status: 'active',
      tags: 'red,leather',
      updated_at: '2026-05-22T10:00:00Z',
      variants: [{ id: 555, sku: 'SH-1', price: '99.99' }],
      images: [{ id: 999, src: 'https://cdn.shop.com/s.jpg' }],
      options: [{ id: 777, name: 'Size', values: ['M', 'L'] }],
    }));

    expect(res.status).toBe(200);
    expect(upsertProductMock).toHaveBeenCalledTimes(1);
    const [shopArg, inputArg] = upsertProductMock.mock.calls[0];
    expect(shopArg).toBe('test.myshopify.com');
    expect(inputArg.handle).toBe('shoe');
    expect(inputArg.title).toBe('Shoe');
    expect(inputArg.tags).toEqual(['red', 'leather']);
    expect(inputArg.updatedAtShopify).toBeInstanceOf(Date);
    expect(inputArg.updatedAtShopify.toISOString()).toBe('2026-05-22T10:00:00.000Z');
    expect(inputArg.variants[0].price).toBeCloseTo(99.99);
    expect(inputArg.images[0].url).toBe('https://cdn.shop.com/s.jpg');
  });

  it('products/delete calls productRepository.deleteProduct(shop, productId)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/delete',
      webhookId: 'evt-3',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    productFindFirstMock.mockResolvedValueOnce({ id: 42, shop: 'test.myshopify.com' });
    deleteProductMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ id: 999888 }));
    expect(res.status).toBe(200);
    expect(productFindFirstMock).toHaveBeenCalledWith({
      where: { shop: 'test.myshopify.com', shopifyId: BigInt(999888) },
    });
    expect(deleteProductMock).toHaveBeenCalledWith('test.myshopify.com', 42);
  });

  it('stale updated_at (older than existing.updatedAtShopify) returns 200 without re-upserting (SYN-11, D-17)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-4',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce({
      id: 1,
      shop: 'test.myshopify.com',
      handle: 'shoe',
      updatedAtShopify: new Date('2026-05-22T12:00:00Z'),
    });

    const res = await POST(makeRequest({
      id: 100,
      handle: 'shoe',
      updated_at: '2026-05-22T10:00:00Z', // OLDER than existing
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: 'stale' });
    expect(upsertProductMock).not.toHaveBeenCalled();
  });

  it('reads rawBody via req.text() BEFORE JSON.parse (D-10) — verified by passing valid JSON to validator', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-5',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce(null);
    upsertProductMock.mockResolvedValueOnce({ id: 1, shop: 'test.myshopify.com' });

    await POST(makeRequest({ id: 1, handle: 'a', updated_at: '2026-05-22T10:00:00Z' }));

    // validateMock receives the raw body string, not parsed JSON
    expect(validateMock).toHaveBeenCalledTimes(1);
    const arg = validateMock.mock.calls[0][0];
    expect(typeof arg.rawBody).toBe('string');
    expect(arg.rawBody).toContain('"id":1');
  });

  it('ignores unknown topics with 200 (already deduped)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'orders/create', // not handled by V1
      webhookId: 'evt-6',
    });
    webhookCreateMock.mockResolvedValueOnce({});

    const res = await POST(makeRequest({ id: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: 'orders/create' });
    expect(upsertProductMock).not.toHaveBeenCalled();
    expect(deleteProductMock).not.toHaveBeenCalled();
  });
});

/**
 * Phase 3 (plan 03-07) — webhook re-embedding after upsert.
 * Implements the D-02 contract: synchronous embedAndStore inside the
 * products/create|update branch, with try/catch + console.error + 200 on
 * embed-only failure (Pitfall 3). Mocks are wired in the hoisted block.
 */
describe('embedding integration (Phase 3)', () => {
  beforeEach(() => {
    buildSearchableTextMock.mockReturnValue('mocked-text');
  });

  it('products/create webhook calls embedAndStore(shop, upserted.id, buildSearchableText(mapped)) after upsertProduct', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/create',
      webhookId: 'evt-emb-1',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce(null);
    upsertProductMock.mockResolvedValueOnce({ id: 42, shop: 'test.myshopify.com' });

    const res = await POST(
      makeRequest({
        id: 1,
        title: 'Shoe',
        handle: 'shoe',
        updated_at: '2026-05-22T10:00:00Z',
      }),
    );

    expect(res.status).toBe(200);
    expect(upsertProductMock).toHaveBeenCalledTimes(1);
    expect(buildSearchableTextMock).toHaveBeenCalledTimes(1);
    expect(embedAndStoreMock).toHaveBeenCalledTimes(1);
    expect(embedAndStoreMock).toHaveBeenCalledWith(
      'test.myshopify.com',
      42,
      'mocked-text',
    );
  });

  it('products/update webhook calls embedAndStore once, with the local Product.id (not Shopify GID)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-emb-2',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce(null);
    upsertProductMock.mockResolvedValueOnce({ id: 42, shop: 'test.myshopify.com' });

    const res = await POST(
      makeRequest({
        id: 999999, // Shopify product GID source — must NOT appear in embedAndStore call
        title: 'Shoe',
        handle: 'shoe',
        updated_at: '2026-05-22T10:00:00Z',
      }),
    );

    expect(res.status).toBe(200);
    expect(embedAndStoreMock).toHaveBeenCalledTimes(1);
    const secondArg = embedAndStoreMock.mock.calls[0][1];
    expect(typeof secondArg).toBe('number');
    expect(secondArg).toBe(42);
    // Defensive: must NOT be a GID string and must NOT be the payload.id
    expect(secondArg).not.toBe(999999);
    expect(String(secondArg)).not.toContain('gid://');
  });

  it('products/delete webhook does NOT call embedAndStore (FK cascade handles row deletion)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/delete',
      webhookId: 'evt-emb-3',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    productFindFirstMock.mockResolvedValueOnce({ id: 7, shop: 'test.myshopify.com' });
    deleteProductMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ id: 999888 }));

    expect(res.status).toBe(200);
    expect(deleteProductMock).toHaveBeenCalledTimes(1);
    expect(embedAndStoreMock).not.toHaveBeenCalled();
  });

  it('webhook returns 200 even when embedAndStore throws (Shopify must not retry on embed failure)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-emb-4',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce(null);
    upsertProductMock.mockResolvedValueOnce({ id: 42, shop: 'test.myshopify.com' });
    embedAndStoreMock.mockRejectedValueOnce(new Error('rate limit'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(
      makeRequest({
        id: 1,
        title: 'Shoe',
        handle: 'shoe',
        updated_at: '2026-05-22T10:00:00Z',
      }),
    );

    expect(res.status).toBe(200);
    // Product was still upserted — embed failure must not roll back the persisted row
    expect(upsertProductMock).toHaveBeenCalledTimes(1);
    expect(embedAndStoreMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('stale event (older updated_at than existing) returns 200 without calling embedAndStore (no wasted AI Gateway cost)', async () => {
    validateMock.mockResolvedValue({
      valid: true,
      domain: 'test.myshopify.com',
      topic: 'products/update',
      webhookId: 'evt-emb-5',
    });
    webhookCreateMock.mockResolvedValueOnce({});
    findByShopAndHandleMock.mockResolvedValueOnce({
      id: 1,
      shop: 'test.myshopify.com',
      handle: 'shoe',
      updatedAtShopify: new Date('2099-01-01T00:00:00Z'),
    });

    const res = await POST(
      makeRequest({
        id: 1,
        handle: 'shoe',
        updated_at: '2020-01-01T00:00:00Z',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: 'stale' });
    expect(upsertProductMock).not.toHaveBeenCalled();
    expect(embedAndStoreMock).not.toHaveBeenCalled();
  });
});
