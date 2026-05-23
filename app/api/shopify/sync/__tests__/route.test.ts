import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shopify/client', () => {
  return {
    shopifyClient: {
      session: {
        decodeSessionToken: vi.fn(),
        getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
      },
      clients: {
        Rest: vi.fn().mockImplementation(() => ({
          get: vi.fn().mockResolvedValue({ body: { product: { id: 1 } } }),
        })),
      },
    },
  };
});

vi.mock('@/lib/shopify/session-storage', () => {
  return {
    sessionStorage: {
      loadSession: vi.fn(),
    },
  };
});

import { POST } from '../route';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/shopify/sync', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/shopify/sync', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('missing_token');
  });

  it('returns 401 when token cannot be decoded', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad token')
    );

    const res = await POST(makeRequest({ Authorization: 'Bearer broken' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_token');
  });

  it('returns 401 invalid_dest when payload.dest is not a parseable URL', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'not-a-url',
    });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_dest');
  });

  it('returns 401 invalid_shop_domain when hostname is not *.myshopify.com', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://attacker.example.com',
    });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_shop_domain');
  });

  it('returns 401 when no offline session exists for the shop', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('no_offline_session');
  });

  it('returns 200 with success when token is valid and session exists', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(shopifyClient.session.getOfflineId).toHaveBeenCalledWith('example-shop.myshopify.com');
  });
});

// =========================================================================
// Phase 2 Wave 0 RED stubs for SYN-05, SYN-08 (D-05 idempotency + syncRunId).
// describe.skip until Plan 02-07 lands. Plan 02-07 removes .skip and adds the
// `prisma.syncRun.findFirst/create` + `inngest.send` mocks to make these GREEN.
// =========================================================================
describe.skip('POST /api/shopify/sync — Phase 2 behavior (Plan 02-07)', () => {
  it(
    'returns existing syncRunId when SyncRun with same idempotencyKey exists in queued/running state (D-05, 5-min window)',
    async () => {
      // Plan 02-07: mock prisma.syncRun.findFirst → existing row with state='running'; route returns its id, no inngest.send.
      expect(true).toBe(true);
    }
  );

  it(
    'creates a new SyncRun row and calls inngest.send({name:"shopify/product.sync", data:{syncRunId, shop}}) when no existing run matches',
    async () => {
      // Plan 02-07: mock prisma.syncRun.findFirst → null; create → returns new row; expect inngest.send to be called.
      expect(true).toBe(true);
    }
  );

  it('responds with { syncRunId: <cuid-shape string> } within 2 seconds (SYN-05 latency contract)', async () => {
    expect(true).toBe(true);
  });
});
