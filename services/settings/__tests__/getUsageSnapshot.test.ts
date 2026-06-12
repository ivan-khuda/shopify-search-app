// Settings-redesign Task 8 — usage snapshot helper extracted from
// GET /api/settings/usage so the SSR settings page and the route share one
// data-assembly path. Mock idiom mirrors app/api/settings/usage/__tests__.
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
vi.mock('@/lib/util/period', () => ({
  getCurrentPeriod: () => '2026-06',
}));
vi.mock('@/services/chat/CapService', () => ({
  readEffectiveDefaultCap: () => 2000,
}));

import { getUsageSnapshot } from '../getUsageSnapshot';

describe('getUsageSnapshot', () => {
  beforeEach(() => {
    counterFindUnique.mockReset().mockResolvedValue(null);
    settingsFindUnique.mockReset().mockResolvedValue(null);
  });

  it('returns the usage snapshot for the current period', async () => {
    counterFindUnique.mockResolvedValue({ requestCount: 1284, adminRequestCount: 182 });
    await expect(getUsageSnapshot('test.myshopify.com')).resolves.toEqual({
      used: 1284,
      adminUsed: 182,
      storefrontUsed: 1102,
      cap: 2000,
      periodLabel: 'June 2026',
      resetsAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('scopes the counter lookup to the shop and current period', async () => {
    await getUsageSnapshot('test.myshopify.com');
    expect(counterFindUnique).toHaveBeenCalledWith({
      where: { shop_period: { shop: 'test.myshopify.com', period: '2026-06' } },
    });
    expect(settingsFindUnique).toHaveBeenCalledWith({
      where: { shop: 'test.myshopify.com' },
      select: { monthlyCapRequests: true },
    });
  });

  it('returns zeros when no counter row exists yet', async () => {
    const snapshot = await getUsageSnapshot('test.myshopify.com');
    expect(snapshot).toMatchObject({ used: 0, adminUsed: 0, storefrontUsed: 0, cap: 2000 });
  });

  it('cap reflects the per-shop override when set below the default', async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapRequests: 500 });
    const snapshot = await getUsageSnapshot('test.myshopify.com');
    expect(snapshot.cap).toBe(500);
  });

  it('cap never exceeds the operator default even if the row holds a larger value', async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapRequests: 9999 });
    const snapshot = await getUsageSnapshot('test.myshopify.com');
    expect(snapshot.cap).toBe(2000);
  });

  it('empty shop returns a zeroed snapshot without touching the DB', async () => {
    const snapshot = await getUsageSnapshot('');
    expect(snapshot).toEqual({
      used: 0,
      adminUsed: 0,
      storefrontUsed: 0,
      cap: 2000,
      periodLabel: 'June 2026',
      resetsAt: '2026-07-01T00:00:00.000Z',
    });
    expect(counterFindUnique).not.toHaveBeenCalled();
    expect(settingsFindUnique).not.toHaveBeenCalled();
  });
});
