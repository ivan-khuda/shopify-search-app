/**
 * Anchors CAP-02 (env-driven default 2000) + the settings-redesign cap
 * override (lowering-only, per-shop) and surface-split counting.
 *
 * Pins the CapService.tryConsumeRequest contract:
 *   - default cap === 2000 when env unset
 *   - HARD_CAP_REQUESTS_PER_MONTH='500' → cap === 500
 *   - invalid env (non-numeric / negative) → falls back to 2000
 *   - per-shop ShopSettings.monthlyCapRequests lowers the cap (never raises)
 *   - settings read failure NEVER blocks chat — default cap path
 *   - calls repo with shop, period from getCurrentPeriod(), cap, surface
 *   - returns { allowed } pass-through
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tryConsumeMock, getCurrentPeriodMock, findUniqueMock } = vi.hoisted(() => ({
  tryConsumeMock: vi.fn(),
  getCurrentPeriodMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('@/lib/db/repositories/RequestCounterRepository', () => ({
  requestCounterRepository: {
    tryConsume: tryConsumeMock,
  },
}));

vi.mock('@/lib/util/period', () => ({
  getCurrentPeriod: getCurrentPeriodMock,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: findUniqueMock,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete process.env.HARD_CAP_REQUESTS_PER_MONTH;
  getCurrentPeriodMock.mockReturnValue('2026-05');
  tryConsumeMock.mockResolvedValue({ allowed: true, requestCount: 1 });
  findUniqueMock.mockResolvedValue(null);
});

describe('CapService.tryConsumeRequest — env-driven cap (CAP-02)', () => {
  it('uses DEFAULT_CAP = 2000 when HARD_CAP_REQUESTS_PER_MONTH is unset', async () => {
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'storefront',
    );
  });

  it('uses the env value when HARD_CAP_REQUESTS_PER_MONTH is a positive integer string', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '500';
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      '2026-05',
      500,
      'storefront',
    );
  });

  it('falls back to 2000 when env value is non-numeric ("abc")', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = 'abc';
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][2]).toBe(2000);
  });

  it('falls back to 2000 when env value is "-1"', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '-1';
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][2]).toBe(2000);
  });

  it('falls back to 2000 when env value is "0"', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '0';
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][2]).toBe(2000);
  });
});

describe('CapService.tryConsumeRequest — per-shop cap override (lowering-only)', () => {
  it('uses the ShopSettings override when below the default cap', async () => {
    findUniqueMock.mockResolvedValue({ monthlyCapRequests: 100 });
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { shop: 'test-shop.myshopify.com' },
      select: { monthlyCapRequests: true },
    });
    expect(tryConsumeMock).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      '2026-05',
      100,
      'storefront',
    );
  });

  it('null override → env/default path unchanged', async () => {
    findUniqueMock.mockResolvedValue({ monthlyCapRequests: null });
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][2]).toBe(2000);
  });

  it('never raises above the default cap (Math.min)', async () => {
    findUniqueMock.mockResolvedValue({ monthlyCapRequests: 9999 });
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][2]).toBe(2000);
  });

  it('settings read failure → default cap, chat NOT blocked', async () => {
    findUniqueMock.mockRejectedValue(new Error('settings outage'));
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    const result = await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'storefront',
    );
    expect(result).toEqual({ allowed: true });
  });
});

describe('CapService.tryConsumeRequest — surface pass-through', () => {
  it("passes 'admin' through to the repository", async () => {
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'admin');
    expect(tryConsumeMock.mock.calls[0][3]).toBe('admin');
  });

  it("passes 'storefront' through to the repository", async () => {
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(tryConsumeMock.mock.calls[0][3]).toBe('storefront');
  });
});

describe('CapService.tryConsumeRequest — period derivation', () => {
  it('calls getCurrentPeriod() to resolve the YYYY-MM period for the repo call', async () => {
    getCurrentPeriodMock.mockReturnValue('2026-12');
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(getCurrentPeriodMock).toHaveBeenCalled();
    expect(tryConsumeMock.mock.calls[0][1]).toBe('2026-12');
  });
});

describe('CapService.tryConsumeRequest — return shape (pass-through)', () => {
  it('returns { allowed: true } when repo resolves allowed: true', async () => {
    tryConsumeMock.mockResolvedValueOnce({ allowed: true, requestCount: 42 });
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    const result = await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: false } when repo resolves allowed: false (cap reached)', async () => {
    tryConsumeMock.mockResolvedValueOnce({ allowed: false });
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    const result = await tryConsumeRequest('test-shop.myshopify.com', 'storefront');
    expect(result).toEqual({ allowed: false });
  });
});

describe('CapService.readEffectiveDefaultCap', () => {
  it('returns 2000 when env unset', async () => {
    const { readEffectiveDefaultCap } = await import('@/services/chat/CapService');
    expect(readEffectiveDefaultCap()).toBe(2000);
  });

  it('returns the env value when set to a positive integer string', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '750';
    const { readEffectiveDefaultCap } = await import('@/services/chat/CapService');
    expect(readEffectiveDefaultCap()).toBe(750);
  });
});
