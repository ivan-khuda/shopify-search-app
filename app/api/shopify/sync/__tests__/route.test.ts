import { describe, it, expect, vi, beforeEach } from 'vitest';

const { syncRunFindFirst, syncRunCreate, inngestSend } = vi.hoisted(() => ({
  syncRunFindFirst: vi.fn(),
  syncRunCreate: vi.fn(),
  inngestSend: vi.fn().mockResolvedValue({ ids: ['evt-1'] }),
}));

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

vi.mock('@/lib/db/client', () => ({
  prisma: {
    syncRun: {
      findFirst: syncRunFindFirst,
      create: syncRunCreate,
    },
  },
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: inngestSend },
}));

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

  it('returns 200 with syncRunId when token is valid and session exists (Phase 2)', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    });
    syncRunFindFirst.mockResolvedValueOnce(null);
    syncRunCreate.mockResolvedValueOnce({ id: 'sr_new', shop: 'example-shop.myshopify.com' });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.syncRunId).toBe('sr_new');
    expect(shopifyClient.session.getOfflineId).toHaveBeenCalledWith('example-shop.myshopify.com');
  });
});

// =========================================================================
// Phase 2 Wave 0 RED stubs for SYN-05, SYN-08 (D-05 idempotency + syncRunId).
// describe.skip until Plan 02-07 lands. Plan 02-07 removes .skip and adds the
// `prisma.syncRun.findFirst/create` + `inngest.send` mocks to make these GREEN.
// =========================================================================
describe('POST /api/shopify/sync — Phase 2 behavior (Plan 02-07)', () => {
  beforeEach(() => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    });
  });

  it('returns existing syncRunId when SyncRun with same idempotencyKey exists (D-05)', async () => {
    syncRunFindFirst.mockResolvedValueOnce({ id: 'sr_existing', state: 'running' });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ syncRunId: 'sr_existing' });
    expect(syncRunCreate).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('creates a new SyncRun and calls inngest.send with {syncRunId, shop} when no existing run', async () => {
    syncRunFindFirst.mockResolvedValueOnce(null);
    syncRunCreate.mockResolvedValueOnce({ id: 'sr_new', shop: 'example-shop.myshopify.com' });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ syncRunId: 'sr_new' });

    expect(syncRunCreate).toHaveBeenCalledTimes(1);
    expect(syncRunCreate.mock.calls[0][0].data).toMatchObject({
      shop: 'example-shop.myshopify.com',
      state: 'queued',
      processedCount: 0,
    });
    expect(syncRunCreate.mock.calls[0][0].data.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);

    expect(inngestSend).toHaveBeenCalledTimes(1);
    expect(inngestSend).toHaveBeenCalledWith({
      name: 'shopify/product.sync',
      data: { syncRunId: 'sr_new', shop: 'example-shop.myshopify.com' },
    });
  });

  it('event payload contains only {syncRunId, shop} — no access token leak (T-2-leak)', async () => {
    syncRunFindFirst.mockResolvedValueOnce(null);
    syncRunCreate.mockResolvedValueOnce({ id: 'sr_2', shop: 'example-shop.myshopify.com' });

    await POST(makeRequest({ Authorization: 'Bearer good' }));

    const eventArg = inngestSend.mock.calls[0][0];
    expect(Object.keys(eventArg.data).sort()).toEqual(['shop', 'syncRunId']);
    expect(eventArg.data).not.toHaveProperty('accessToken');
    expect(eventArg.data).not.toHaveProperty('session');
  });
});
