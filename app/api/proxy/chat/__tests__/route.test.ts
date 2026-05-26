// Phase 4 stub tests: /api/proxy/chat returns 501 Not Implemented unconditionally
// until Phase 6 lands HMAC verification + streamText wiring. The `hybridSearch`
// import is preserved in route.ts as the EMB-07 source-level proof point; tests
// here confirm the route never reaches it. Issue closed: 04-REVIEW.md CR-01.
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

describe('POST /api/proxy/chat (Phase 4 stub)', () => {
  it('returns 501 with a not_implemented body and never calls hybridSearch — even with a valid shop and query', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=shop.myshopify.com', { query: 'shoes' }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('not_implemented');
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it('returns 501 when ?shop= is missing (no preferential 400 leak)', async () => {
    const res = await POST(makeRequest('http://localhost/api/proxy/chat', { query: 'shoes' }));
    expect(res.status).toBe(501);
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it('returns 501 when body is missing or malformed (request parsing never reached)', async () => {
    const resNoBody = await POST(
      new Request('http://localhost/api/proxy/chat?shop=s.myshopify.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(resNoBody.status).toBe(501);
    expect(hybridSearchMock).not.toHaveBeenCalled();

    const resBadJson = await POST(
      new Request('http://localhost/api/proxy/chat?shop=s.myshopify.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not valid json',
      }),
    );
    expect(resBadJson.status).toBe(501);
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it('returns 501 for empty or whitespace-only query body (no query-shape leak)', async () => {
    const resEmpty = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=s.myshopify.com', { query: '' }),
    );
    expect(resEmpty.status).toBe(501);

    const resWhitespace = await POST(
      makeRequest('http://localhost/api/proxy/chat?shop=s.myshopify.com', { query: '   ' }),
    );
    expect(resWhitespace.status).toBe(501);
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });
});
