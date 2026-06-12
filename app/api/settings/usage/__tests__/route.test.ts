import { beforeEach, describe, expect, it, vi } from 'vitest';

const { counterFindUnique, settingsFindUnique } = vi.hoisted(() => ({
  counterFindUnique: vi.fn(),
  settingsFindUnique: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    requestCounter: { findUnique: counterFindUnique },
    shopSettings: { findUnique: settingsFindUnique },
  },
}));
// withShopifySession passthrough — same idiom as the other settings route tests.
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession:
    (handler: (ctx: { shop: string; req: Request }) => Promise<Response>) =>
    (req: Request) => handler({ shop: 'test.myshopify.com', req }),
}));
vi.mock('@/lib/util/period', () => ({
  getCurrentPeriod: () => '2026-06',
}));
vi.mock('@/services/chat/CapService', () => ({
  readEffectiveDefaultCap: () => 2000,
}));

import { GET } from '../route';

const get = () => GET(new Request('http://x/api/settings/usage'));

describe('GET /api/settings/usage', () => {
  beforeEach(() => {
    counterFindUnique.mockReset().mockResolvedValue(null);
    settingsFindUnique.mockReset().mockResolvedValue(null);
  });

  it('returns the usage snapshot for the current period', async () => {
    counterFindUnique.mockResolvedValue({ requestCount: 1284, adminRequestCount: 182 });
    const res = await get();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      used: 1284,
      adminUsed: 182,
      storefrontUsed: 1102,
      cap: 2000,
      periodLabel: 'June 2026',
      resetsAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('scopes the counter lookup to the session shop and current period', async () => {
    await get();
    expect(counterFindUnique).toHaveBeenCalledWith({
      where: { shop_period: { shop: 'test.myshopify.com', period: '2026-06' } },
    });
    expect(settingsFindUnique).toHaveBeenCalledWith({
      where: { shop: 'test.myshopify.com' },
      select: { monthlyCapRequests: true },
    });
  });

  it('returns zeros when no counter row exists yet', async () => {
    const res = await get();
    const json = await res.json();
    expect(json).toMatchObject({ used: 0, adminUsed: 0, storefrontUsed: 0, cap: 2000 });
  });

  it('cap reflects the per-shop override when set below the default', async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapRequests: 500 });
    const res = await get();
    const json = await res.json();
    expect(json.cap).toBe(500);
  });

  it('cap never exceeds the operator default even if the row holds a larger value', async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapRequests: 9999 });
    const res = await get();
    const json = await res.json();
    expect(json.cap).toBe(2000);
  });
});
