/**
 * RED scaffold for IDN-03/IDN-04 — conversations list, create, bulk delete.
 * Tests fail with "Cannot find module" until Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Mock dependencies before import ─────────────────────────────────────────
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
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    visitorCustomerLink: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET, POST, DELETE } from '@/app/api/proxy/conversations/route';
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';
import { rateLimit } from '@/lib/rate-limit/memory';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';
const VISITOR_ID = 'visitor-uuid-001';

function signParams(params: Record<string, string>): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join(''); // NO & delimiter
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function makeRequest(
  method: string,
  searchParams: Record<string, string>,
  body?: unknown
): Request {
  const params = { shop: SHOP, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/conversations`);
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
  vi.mocked(rateLimit).mockReturnValue({ ok: true });
  vi.mocked(prisma.visitorCustomerLink.findUnique).mockResolvedValue(null);
});

describe('GET /api/proxy/conversations', () => {
  it('returns 401 when HMAC signature is missing', async () => {
    vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(false);
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/conversations`);
    url.searchParams.set('shop', SHOP);
    url.searchParams.set('visitor_id', VISITOR_ID);
    // No signature param → treated as missing_signature
    const req = new Request(url.toString());
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('returns paginated list of up to 20 conversations ordered by lastMessageAt desc', async () => {
    const mockRows = Array.from({ length: 20 }, (_, i) => ({
      id: `conv-${i}`,
      title: `Chat ${i}`,
      lastMessageAt: new Date(Date.now() - i * 1000),
      shop: SHOP,
      visitorId: VISITOR_ID,
    }));
    vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockRows as never);

    const req = makeRequest('GET', { visitor_id: VISITOR_ID });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json() as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toHaveLength(20);
  });

  it('returns 400 when visitor_id param is missing', async () => {
    const req = makeRequest('GET', {}); // no visitor_id
    const response = await GET(req);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/proxy/conversations', () => {
  it('creates a conversation with title = first 60 chars of firstMessage.text (D-18)', async () => {
    const longText = 'A'.repeat(100);
    vi.mocked(prisma.conversation.create).mockResolvedValue({
      id: 'conv-new',
      title: longText.slice(0, 60),
      shop: SHOP,
      visitorId: VISITOR_ID,
    } as never);

    const req = makeRequest('POST', { visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      firstMessage: { text: longText },
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json() as { conversation_id: string };
    expect(body.conversation_id).toBe('conv-new');
    // Assert title was capped at 60 chars
    const createCall = vi.mocked(prisma.conversation.create).mock.calls[0][0];
    expect((createCall.data as { title: string }).title).toHaveLength(60);
  });

  it('falls back to "(no title)" when firstMessage.text is empty or missing', async () => {
    vi.mocked(prisma.conversation.create).mockResolvedValue({
      id: 'conv-empty',
      title: '(no title)',
    } as never);

    const req = makeRequest('POST', { visitor_id: VISITOR_ID }, {
      visitor_id: VISITOR_ID,
      firstMessage: { text: '' },
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
    const createCall = vi.mocked(prisma.conversation.create).mock.calls[0][0];
    expect((createCall.data as { title: string }).title).toBe('(no title)');
  });
});

describe('DELETE /api/proxy/conversations', () => {
  it('bulk removes all conversation rows for visitor_id', async () => {
    vi.mocked(prisma.conversation.deleteMany).mockResolvedValue({ count: 5 });

    const req = makeRequest('DELETE', { visitor_id: VISITOR_ID });
    const response = await DELETE(req);

    expect(response.status).toBe(200);
    const body = await response.json() as { deleted: number };
    expect(body.deleted).toBe(5);
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shop: SHOP }),
      })
    );
  });

  it('returns 400 when visitor_id is missing', async () => {
    const req = makeRequest('DELETE', {}); // no visitor_id
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });
});
