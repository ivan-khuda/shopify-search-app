/**
 * GREEN tests for GET /api/shopify/sync/status (SYN-07, T-2-iso).
 * Post-Plan-02-08 implementation. Uses the same SDK-level mocks as the
 * Phase 1 sync route test (Option B) so withShopifySession flows naturally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/db/client', () => ({
  prisma: {
    syncRun: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from '../route';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';
import { prisma } from '@/lib/db/client';

function makeRequest(syncRunId?: string, headers: Record<string, string> = {}): Request {
  const url = syncRunId
    ? `http://localhost/api/shopify/sync/status?syncRunId=${syncRunId}`
    : `http://localhost/api/shopify/sync/status`;
  return new Request(url, { method: 'GET', headers });
}

function setupValidSession(shop = 'test.myshopify.com') {
  (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    dest: `https://${shop}`,
  });
  (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: `offline_${shop}`,
    shop,
    accessToken: 'shpat_xxx',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/shopify/sync/status (SYN-07)', () => {
  it('returns 400 missing_sync_run_id when query param absent', async () => {
    setupValidSession();
    const res = await GET(makeRequest(undefined, { Authorization: 'Bearer good' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_sync_run_id' });
  });

  it('returns 404 sync_run_not_found when row does not exist', async () => {
    setupValidSession();
    (prisma.syncRun.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeRequest('sr_missing', { Authorization: 'Bearer good' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'sync_run_not_found' });
  });

  it('returns 403 wrong_shop when row exists but belongs to a different shop (T-2-iso)', async () => {
    setupValidSession('mine.myshopify.com');
    (prisma.syncRun.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sr_001',
      shop: 'other.myshopify.com',
      state: 'running',
      processedCount: 1,
      totalCount: 10,
      errors: [],
      startedAt: new Date(),
      finishedAt: null,
    });
    const res = await GET(makeRequest('sr_001', { Authorization: 'Bearer good' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'wrong_shop' });
  });

  it('returns 200 with SyncRun snapshot when row found and shop matches', async () => {
    setupValidSession('test.myshopify.com');
    const startedAt = new Date('2026-05-23T10:00:00Z');
    (prisma.syncRun.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sr_002',
      shop: 'test.myshopify.com',
      state: 'running',
      processedCount: 142,
      totalCount: 3500,
      errors: [],
      startedAt,
      finishedAt: null,
      cursor: 'eyJjdXJzb3IiOiJhYmMifQ==', // should not appear in response
      idempotencyKey: 'secret-key',         // should not appear
    });
    const res = await GET(makeRequest('sr_002', { Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe('running');
    expect(body.processedCount).toBe(142);
    expect(body.totalCount).toBe(3500);
    expect(body.errors).toEqual([]);
    expect(body).not.toHaveProperty('cursor');
    expect(body).not.toHaveProperty('idempotencyKey');
  });

  it('returns 401 invalid_token when session token decode fails (inherits withShopifySession)', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad token')
    );
    const res = await GET(makeRequest('sr_003', { Authorization: 'Bearer broken' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_token' });
  });
});
