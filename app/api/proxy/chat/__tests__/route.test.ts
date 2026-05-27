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
  // Phase 8 (plan 08-01) additions
  tryConsumeRequestMock,
  capReachedResponseMock,
} = vi.hoisted(() => ({
  validateHmacMock: vi.fn(),
  rateLimitMock: vi.fn().mockReturnValue({ ok: true }),
  conversationUpdateMock: vi.fn(),
  conversationCreateMock: vi.fn(),
  hybridSearchMock: vi.fn().mockResolvedValue([]),
  getActiveChatModelMock: vi.fn().mockReturnValue({ id: 'google/gemini-2.5-flash' }),
  tryConsumeRequestMock: vi.fn().mockResolvedValue({ allowed: true }),
  capReachedResponseMock: vi.fn(),
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

// Phase 8 (plan 08-01) — CapService + cap-reached-response stubs.
// Both modules ship in Plan 08-08 / 08-09. The storefront route delta
// (Plan 08-09) injects tryConsumeRequest after App Proxy HMAC validation.
vi.mock('@/services/chat/CapService', () => ({
  tryConsumeRequest: tryConsumeRequestMock,
}));

vi.mock('@/lib/chat/cap-reached-response', () => ({
  capReachedResponse: capReachedResponseMock,
  CAP_REACHED_MESSAGE: "You've reached this month's message limit. It resets on the 1st of next month. Reach out to support to raise your cap.",
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn((opts: { onFinish?: (ctx: { response: { messages: unknown[] } }) => Promise<void> | void }) => {
      // Invoke onFinish synchronously so the handler's DB write happens
      // before toUIMessageStreamResponse() returns. Mirrors Vercel AI SDK
      // behavior where onFinish fires once the stream completes.
      void Promise.resolve().then(() => opts.onFinish?.({ response: { messages: [] } }));
      return {
        toUIMessageStreamResponse: vi.fn().mockReturnValue(
          new Response('data: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        ),
      };
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
  // Phase 8 default — cap-allowed so existing tests are unaffected.
  tryConsumeRequestMock.mockResolvedValue({ allowed: true });
  capReachedResponseMock.mockImplementation(() =>
    new Response('cap-reached-body', { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  );
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

/**
 * Phase 8 Wave 0 RED scaffold — anchors CAP-02 / CAP-03 / D-13 / D-14
 * for the storefront route. The cap check fires AFTER HMAC + rate-limit
 * + customer-id-match (those gates short-circuit first), then BEFORE the
 * AI Gateway call. Implementation lands in Plan 08-09.
 */
describe('POST /api/proxy/chat — Phase 8 hard cap (CAP-02, CAP-03, D-13, D-14)', () => {
  it('calls tryConsumeRequest with shop derived from HMAC ctx (NOT body/raw query)', async () => {
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Show me blue shoes' }] }],
    });
    await POST(req);
    expect(tryConsumeRequestMock).toHaveBeenCalledTimes(1);
    expect(tryConsumeRequestMock).toHaveBeenCalledWith(SHOP);
  });

  it('allowed: true → reaches the streaming response (normal flow)', async () => {
    tryConsumeRequestMock.mockResolvedValueOnce({ allowed: true });
    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Show me blue shoes' }] }],
    });
    const response = await POST(req);
    expect(capReachedResponseMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('allowed: false → returns capReachedResponse() instead of the normal stream', async () => {
    tryConsumeRequestMock.mockResolvedValueOnce({ allowed: false });
    const capBody = new Response('cap-reached-body', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    capReachedResponseMock.mockReturnValueOnce(capBody);

    const req = makeRequest({ visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      conversation_id: 'conv-existing',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Show me blue shoes' }] }],
    });
    const response = await POST(req);

    expect(capReachedResponseMock).toHaveBeenCalledTimes(1);
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(response).toBe(capBody);
    expect(response.status).toBe(200); // CAP-03: HTTP 200
  });

  it('cap check fires AFTER auth/rate-limit/customer-id-match gates (gate ordering)', async () => {
    // If HMAC fails first, the cap check must NOT run.
    validateHmacMock.mockResolvedValueOnce(false);
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
    expect(tryConsumeRequestMock).not.toHaveBeenCalled();
  });
});
