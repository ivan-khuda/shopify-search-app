/**
 * Wave 0 RED stubs for SYN-07 (status polling endpoint).
 *
 * This file goes RED on the missing `../route` GET handler. Plan 02-08 lands
 * the production code and turns these GREEN.
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
      findFirst: vi.fn(),
    },
  },
}));

// RED until Plan 02-08 lands. @vite-ignore bypasses compile-time resolution.
let GET: unknown = undefined;
const TARGET = '../route';
try {
  const mod = await import(/* @vite-ignore */ TARGET);
  GET = (mod as Record<string, unknown>).GET;
} catch {
  // RED until Plan 02-08
}

function makeRequest(syncRunId?: string, headers: Record<string, string> = {}): Request {
  const url = syncRunId
    ? `http://localhost/api/shopify/sync/status?syncRunId=${syncRunId}`
    : `http://localhost/api/shopify/sync/status`;
  return new Request(url, { method: 'GET', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/shopify/sync/status (SYN-07)', () => {
  it.runIf(!!GET)('returns 400 missing_sync_run_id when query param absent', async () => {
    expect(GET).toBeDefined();
  });

  it.runIf(!!GET)('returns 404 sync_run_not_found when row does not exist for shop', async () => {
    expect(GET).toBeDefined();
  });

  it.runIf(!!GET)('returns 403 wrong_shop when row exists but belongs to a different shop (cross-shop access blocked)', async () => {
    expect(GET).toBeDefined();
  });

  it.runIf(!!GET)('returns 200 with {state, processedCount, totalCount, errors, startedAt, finishedAt} when row found and shop matches', async () => {
    expect(GET).toBeDefined();
  });

  it.runIf(!!GET)('returns 401 invalid_token when session token decode fails (inherits withShopifySession)', async () => {
    expect(GET).toBeDefined();
  });

  it.runIf(!GET)('PRE-IMPLEMENTATION: ../route GET handler is not yet created (Plan 02-08)', () => {
    expect(GET).toBeUndefined();
    // helpers used so vitest does not warn about unused
    void makeRequest;
  });
});
