/**
 * RED scaffold for IDN-04 — conversations single-row resume and append.
 * Tests fail with "Cannot find module" until Wave 2 ships implementation.
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
    conversation: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

import { GET, PATCH } from '@/app/api/proxy/conversations/[id]/route';
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';
const VISITOR_ID = 'visitor-uuid-001';
const CONV_ID = 'conv-abc-123';

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
  id: string,
  searchParams: Record<string, string> = {},
  body?: unknown
): Request {
  const params = { shop: SHOP, visitor_id: VISITOR_ID, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/conversations/${id}`);
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
  vi.clearAllMocks();
  vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
});

describe('GET /api/proxy/conversations/[id]', () => {
  it('returns full messages JSONB for matching shop', async () => {
    const mockConv = {
      id: CONV_ID,
      shop: SHOP,
      visitorId: VISITOR_ID,
      title: 'Test chat',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      lastMessageAt: new Date('2026-01-01'),
    };
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConv as never);

    const req = makeRequest('GET', CONV_ID);
    const response = await GET(req, { params: Promise.resolve({ id: CONV_ID }) });

    expect(response.status).toBe(200);
    const body = await response.json() as { messages: unknown[] };
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(2);
  });

  it('returns 403 when conversation belongs to a different shop', async () => {
    const mockConv = {
      id: CONV_ID,
      shop: 'other.myshopify.com', // different shop
      visitorId: VISITOR_ID,
      messages: [],
    };
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConv as never);

    const req = makeRequest('GET', CONV_ID);
    const response = await GET(req, { params: Promise.resolve({ id: CONV_ID }) });

    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it('returns 404 when conversation id does not exist', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

    const req = makeRequest('GET', 'nonexistent-id');
    const response = await GET(req, { params: Promise.resolve({ id: 'nonexistent-id' }) });

    expect(response.status).toBe(404);
  });

  it('returns 401 when HMAC is invalid', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);

    // Manually craft a request with no signature
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/conversations/${CONV_ID}`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString());
    const response = await GET(req, { params: Promise.resolve({ id: CONV_ID }) });

    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/proxy/conversations/[id]', () => {
  it('appends a turn to messages JSONB atomically via raw SQL', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: CONV_ID,
      shop: SHOP,
      visitorId: VISITOR_ID,
      messages: [],
    } as never);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

    const turn = { role: 'user', content: 'New message' };
    const req = makeRequest('PATCH', CONV_ID, {}, { turn });
    const response = await PATCH(req, { params: Promise.resolve({ id: CONV_ID }) });

    expect(response.status).toBe(200);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('returns 403 when patching a conversation from a different shop', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: CONV_ID,
      shop: 'other.myshopify.com',
      visitorId: VISITOR_ID,
      messages: [],
    } as never);

    const req = makeRequest('PATCH', CONV_ID, {}, { turn: { role: 'user', content: 'Hi' } });
    const response = await PATCH(req, { params: Promise.resolve({ id: CONV_ID }) });

    expect(response.status).toBe(403);
  });

  it('returns 404 when conversation id does not exist for PATCH', async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

    const req = makeRequest('PATCH', 'nonexistent', {}, { turn: { role: 'user', content: 'Hi' } });
    const response = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(response.status).toBe(404);
  });
});
