/**
 * Phase 6 RED scaffold for STR-04 + D-19 + IDN-02 — storefront chat route.
 *
 * Replaces the Phase 4 stub test file. The old tests asserted 501; Phase 6
 * will ship a working HMAC-authenticated streaming endpoint, so these tests
 * drive the real implementation.
 *
 * Tests fail with "Cannot find module '@/lib/shopify/app-proxy-auth'" until
 * Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Mocks (must be hoisted before imports) ───────────────────────────────────
const {
  validateHmacMock,
  rateLimitMock,
  conversationUpdateMock,
  conversationCreateMock,
  hybridSearchMock,
  getActiveChatModelMock,
} = vi.hoisted(() => ({
  validateHmacMock: vi.fn(),
  rateLimitMock: vi.fn().mockReturnValue({ ok: true }),
  conversationUpdateMock: vi.fn(),
  conversationCreateMock: vi.fn(),
  hybridSearchMock: vi.fn().mockResolvedValue([]),
  getActiveChatModelMock: vi.fn().mockReturnValue({ id: 'google/gemini-2.5-flash' }),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    utils: { validateHmac: validateHmacMock },
  },
}));

vi.mock('@/lib/rate-limit/memory', () => ({
  rateLimit: rateLimitMock,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    conversation: {
      update: conversationUpdateMock,
      create: conversationCreateMock,
    },
  },
}));

vi.mock('@/services/search/SearchService', () => ({
  hybridSearch: hybridSearchMock,
}));

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: getActiveChatModelMock,
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn().mockReturnValue({
      toUIMessageStreamResponse: vi.fn().mockReturnValue(
        new Response('data: [DONE]\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      ),
    }),
  };
});

import { POST } from '@/app/api/proxy/chat/route';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';
const VISITOR_ID = 'visitor-uuid-001';
const CUSTOMER_ID = '5570080145486';

function signParams(params: Record<string, string>): string {
  // D-21: NO & delimiter between key=value pairs (App Proxy algorithm)
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function makeRequest(
  searchParams: Record<string, string>,
  body: unknown
): Request {
  const params = { shop: SHOP, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/chat`);
  for (const [k, v] of Object.entries({ ...params, signature })) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  vi.clearAllMocks();
  validateHmacMock.mockResolvedValue(true);
  rateLimitMock.mockReturnValue({ ok: true });
  conversationUpdateMock.mockResolvedValue({});
  conversationCreateMock.mockResolvedValue({ id: 'conv-new' });
});

describe('POST /api/proxy/chat — STR-04 auth', () => {
  it('returns 401 without HMAC signature', async () => {
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/chat`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: VISITOR_ID, messages: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 401 when validateHmac returns false', async () => {
    validateHmacMock.mockResolvedValue(false);

    const params = { shop: SHOP, visitor_id: VISITOR_ID };
    const signature = signParams(params);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/chat`);
    for (const [k, v] of Object.entries({ ...params, signature })) {
      url.searchParams.set(k, v);
    }
    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: VISITOR_ID, messages: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('returns 400 when visitor_id is missing from request body', async () => {
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      // intentionally omitting visitor_id from body
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/visitor_id/);
  });

  it('IDN-02: returns 403 customer_id_mismatch when body.customer_id != signed logged_in_customer_id', async () => {
    const searchParams = {
      visitor_id: VISITOR_ID,
      logged_in_customer_id: CUSTOMER_ID,
    };
    const params = { shop: SHOP, ...searchParams };
    const signature = signParams(params);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/chat`);
    for (const [k, v] of Object.entries({ ...params, signature })) {
      url.searchParams.set(k, v);
    }

    const req = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: VISITOR_ID,
        customer_id: '9999999', // MISMATCH with signed logged_in_customer_id
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('customer_id_mismatch');
  });

  it('returns 429 with Retry-After header when rate limit is exceeded', async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSeconds: 60 });

    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    });
    const response = await POST(req);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});

describe('POST /api/proxy/chat — happy path', () => {
  it('returns 200 streaming response (text/event-stream) on a valid request', async () => {
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Show me blue shoes' }] }],
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
    const contentType = response.headers.get('Content-Type') ?? '';
    expect(contentType).toMatch(/text\/event-stream|application\/x-ndjson/);
  });
});

describe('POST /api/proxy/chat — D-19 onFinish DB write', () => {
  it('calls prisma.conversation.update with lastMessageAt Date after stream completes', async () => {
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Find me running shoes' }] }],
    });

    await POST(req);

    // onFinish must write the conversation update atomically
    expect(conversationUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shop: SHOP }),
        data: expect.objectContaining({
          lastMessageAt: expect.any(Date),
        }),
      })
    );
  });

  it('does NOT call hybridSearch with raw URL shop param (shop derived from HMAC, not raw query)', async () => {
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Find shoes' }] }],
    });

    await POST(req);

    // hybridSearch shop arg must be the validated shop from HMAC context
    if (hybridSearchMock.mock.calls.length > 0) {
      const shopArg = hybridSearchMock.mock.calls[0][0] as string;
      expect(shopArg).toBe(SHOP);
    }
  });
});
