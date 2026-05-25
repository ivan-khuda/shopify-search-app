// Phase 4 RED scaffold for EMB-07 success criterion #3 (both routes call SearchService).
// Implementation target: app/api/proxy/chat/route.ts (created in plan 04-04). Phase 6 will replace this stub with HMAC + streamText.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { hybridSearchMock } = vi.hoisted(() => ({
  hybridSearchMock: vi.fn(),
}));

vi.mock('@/services/search/SearchService', () => ({
  hybridSearch: hybridSearchMock,
}));

import { POST } from '@/app/api/proxy/chat/route';

function makeRequest(url: string, body?: object): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/proxy/chat', () => {
  it("returns 400 with { error: 'missing_shop' } when ?shop= is missing", async () => {
    const res = await POST(makeRequest('http://localhost/api/proxy/chat', { query: 'shoes' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_shop');
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it('returns { products: [] } without calling hybridSearch when query body is empty string', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=s.myshopify.com', { query: '' }),
    );
    const body = await res.json();
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(body.products).toEqual([]);
  });

  it('returns { products: [] } without calling hybridSearch when query body is whitespace-only', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=s.myshopify.com', { query: '   ' }),
    );
    const body = await res.json();
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(body.products).toEqual([]);
  });

  it('returns { products: [] } without calling hybridSearch when body is missing or non-JSON', async () => {
    // Missing body
    const res1 = await POST(
      new Request('http://localhost/api/proxy/chat?shop=s.myshopify.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body1 = await res1.json();
    expect(body1.products).toEqual([]);
    expect(hybridSearchMock).not.toHaveBeenCalled();

    // Malformed JSON
    const res2 = await POST(
      new Request('http://localhost/api/proxy/chat?shop=s.myshopify.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not valid json',
      }),
    );
    const body2 = await res2.json();
    expect(body2.products).toEqual([]);
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it("calls hybridSearch('shop.myshopify.com', 'shoes') and returns its result wrapped in { products }", async () => {
    const fakeProducts = [
      { id: '1', title: 'X', price: '$5', description: 'D' },
    ];
    hybridSearchMock.mockResolvedValueOnce(fakeProducts);

    const res = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=shop.myshopify.com', { query: 'shoes' }),
    );
    const body = await res.json();

    expect(hybridSearchMock).toHaveBeenCalledTimes(1);
    expect(hybridSearchMock).toHaveBeenCalledWith('shop.myshopify.com', 'shoes');
    expect(body.products).toEqual(fakeProducts);
  });
});
