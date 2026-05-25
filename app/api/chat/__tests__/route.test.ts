// Phase 4 RED scaffold for ADM-06 / D-04, D-05, D-10. Implementation target: app/api/chat/route.ts (rewritten in plan 04-03).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { streamTextMock, hybridSearchMock, getActiveChatModelMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  hybridSearchMock: vi.fn(),
  getActiveChatModelMock: vi.fn(),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      decodeSessionToken: vi.fn(),
      getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
    },
  },
}));

vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: {
    loadSession: vi.fn(),
  },
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: streamTextMock,
  };
});

vi.mock('@/services/search/SearchService', () => ({
  hybridSearch: hybridSearchMock,
}));

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: getActiveChatModelMock,
}));

import { POST } from '@/app/api/chat/route';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

function makeRequest(
  headers: Record<string, string> = {},
  body: object = { messages: [] },
): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const mockStreamResponse = new Response('ok');

beforeEach(() => {
  vi.clearAllMocks();

  streamTextMock.mockReturnValue({
    toUIMessageStreamResponse: () => mockStreamResponse,
  });

  getActiveChatModelMock.mockResolvedValue({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  });

  hybridSearchMock.mockResolvedValue([]);

  (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    dest: 'https://example-shop.myshopify.com',
  });
  (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'offline_example-shop.myshopify.com',
    shop: 'example-shop.myshopify.com',
    accessToken: 'shpat_xxx',
  });
});

describe('POST /api/chat', () => {
  it('returns 401 missing_token when no Authorization header', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('missing_token');
  });

  it("passes the AI Gateway plain-string model 'google/gemini-2.5-flash' to streamText (NOT a provider import)", async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(streamArgs.model).toBe('google/gemini-2.5-flash');
    expect(typeof streamArgs.model).toBe('string');
  });

  it("registers a tool keyed exactly 'searchCatalog' (camelCase, singular)", async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(streamArgs.tools).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(streamArgs.tools, 'searchCatalog')).toBe(true);
    const keys = Object.keys(streamArgs.tools);
    expect(keys).toEqual(['searchCatalog']);
  });

  it('the searchCatalog tool uses inputSchema (Vercel AI SDK v6), NOT parameters (v5)', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(streamArgs.tools.searchCatalog.inputSchema).toBeTruthy();
    expect(streamArgs.tools.searchCatalog.parameters).toBeUndefined();
  });

  it('tool execute closure forwards shop from withShopifySession context (NOT from LLM args)', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];

    const abortController = new AbortController();
    await streamArgs.tools.searchCatalog.execute(
      { query: 'shoes', priceMax: 100 },
      { toolCallId: 't1', messages: [], abortSignal: abortController.signal },
    );

    expect(hybridSearchMock).toHaveBeenCalledTimes(1);
    expect(hybridSearchMock).toHaveBeenCalledWith('example-shop.myshopify.com', 'shoes', {
      priceMin: undefined,
      priceMax: 100,
    });
  });

  it('tool execute forwards both priceMin and priceMax when present', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];

    const abortController = new AbortController();
    await streamArgs.tools.searchCatalog.execute(
      { query: 'q', priceMin: 10, priceMax: 50 },
      { toolCallId: 't1', messages: [], abortSignal: abortController.signal },
    );

    expect(hybridSearchMock).toHaveBeenCalledWith('example-shop.myshopify.com', 'q', {
      priceMin: 10,
      priceMax: 50,
    });
  });

  it('tool execute forwards undefined priceMin/priceMax when not present in tool args', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];

    const abortController = new AbortController();
    await streamArgs.tools.searchCatalog.execute(
      { query: 'q' },
      { toolCallId: 't1', messages: [], abortSignal: abortController.signal },
    );

    expect(hybridSearchMock).toHaveBeenCalledWith('example-shop.myshopify.com', 'q', {
      priceMin: undefined,
      priceMax: undefined,
    });
  });

  it('system prompt contains the shop name (steers the LLM per D-04)', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(typeof streamArgs.system).toBe('string');
    expect(streamArgs.system.includes('example-shop.myshopify.com')).toBe(true);
  });

  it('system prompt instructs the LLM to call searchCatalog before recommending products', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(streamArgs.system).toMatch(/searchCatalog/i);
    expect(streamArgs.system).toMatch(/(always|before recommending)/i);
  });

  it('getActiveChatModel is called with shop from session context', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(getActiveChatModelMock).toHaveBeenCalledWith('example-shop.myshopify.com');
  });

  it('stopWhen is set (single tool round-trip with safety margin, per RESEARCH.md Open Question 5)', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    expect(streamArgs.stopWhen).toBeDefined();
  });

  it('tool inputSchema accepts query (1-500 chars), priceMin?, priceMax? — Zod validation contract', async () => {
    await POST(makeRequest({ Authorization: 'Bearer good' }));
    const streamArgs = streamTextMock.mock.calls[0][0];
    const schema = streamArgs.tools.searchCatalog.inputSchema;

    expect(schema.safeParse({ query: 'shoes', priceMax: 100 }).success).toBe(true);
    expect(schema.safeParse({ query: '' }).success).toBe(false);
    expect(schema.safeParse({ query: 'a'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ priceMin: 10 }).success).toBe(false);
    expect(schema.safeParse({ query: 'q', priceMin: 'not-a-number' }).success).toBe(false);
  });

  it('returns the streamText().toUIMessageStreamResponse() result as the handler response', async () => {
    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res).toBe(mockStreamResponse);
  });
});
