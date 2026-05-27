/**
 * Phase 8 Wave 0 RED scaffold — anchors CAP-02 (env-driven default 2000).
 *
 * Pins the CapService.tryConsumeRequest contract:
 *   - default cap === 2000 when env unset
 *   - HARD_CAP_REQUESTS_PER_MONTH='500' → cap === 500
 *   - invalid env (non-numeric / negative) → falls back to 2000
 *   - calls repo with shop, period from getCurrentPeriod(), cap
 *   - returns { allowed } pass-through
 *
 * Implementation lands in Plan 08-08 at services/chat/CapService.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tryConsumeMock, getCurrentPeriodMock } = vi.hoisted(() => ({
  tryConsumeMock: vi.fn(),
  getCurrentPeriodMock: vi.fn(),
}));

vi.mock('@/lib/db/repositories/RequestCounterRepository', () => ({
  requestCounterRepository: {
    tryConsume: tryConsumeMock,
  },
}));

vi.mock('@/lib/util/period', () => ({
  getCurrentPeriod: getCurrentPeriodMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete process.env.HARD_CAP_REQUESTS_PER_MONTH;
  getCurrentPeriodMock.mockReturnValue('2026-05');
  tryConsumeMock.mockResolvedValue({ allowed: true, requestCount: 1 });
});

describe('CapService.tryConsumeRequest — env-driven cap (CAP-02)', () => {
  it('uses DEFAULT_CAP = 2000 when HARD_CAP_REQUESTS_PER_MONTH is unset', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-08).
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(tryConsumeMock).toHaveBeenCalledWith('test-shop.myshopify.com', '2026-05', 2000);
  });

  it('uses the env value when HARD_CAP_REQUESTS_PER_MONTH is a positive integer string', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '500';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(tryConsumeMock).toHaveBeenCalledWith('test-shop.myshopify.com', '2026-05', 500);
  });

  it('falls back to 2000 when env value is non-numeric ("abc")', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = 'abc';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(tryConsumeMock).toHaveBeenCalledWith('test-shop.myshopify.com', '2026-05', 2000);
  });

  it('falls back to 2000 when env value is "-1"', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '-1';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(tryConsumeMock).toHaveBeenCalledWith('test-shop.myshopify.com', '2026-05', 2000);
  });

  it('falls back to 2000 when env value is "0"', async () => {
    process.env.HARD_CAP_REQUESTS_PER_MONTH = '0';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(tryConsumeMock).toHaveBeenCalledWith('test-shop.myshopify.com', '2026-05', 2000);
  });
});

describe('CapService.tryConsumeRequest — period derivation', () => {
  it('calls getCurrentPeriod() to resolve the YYYY-MM period for the repo call', async () => {
    getCurrentPeriodMock.mockReturnValue('2026-12');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    await tryConsumeRequest('test-shop.myshopify.com');
    expect(getCurrentPeriodMock).toHaveBeenCalled();
    expect(tryConsumeMock.mock.calls[0][1]).toBe('2026-12');
  });
});

describe('CapService.tryConsumeRequest — return shape (pass-through)', () => {
  it('returns { allowed: true } when repo resolves allowed: true', async () => {
    tryConsumeMock.mockResolvedValueOnce({ allowed: true, requestCount: 42 });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    const result = await tryConsumeRequest('test-shop.myshopify.com');
    expect(result).toEqual({ allowed: true });
  });

  it('returns { allowed: false } when repo resolves allowed: false (cap reached)', async () => {
    tryConsumeMock.mockResolvedValueOnce({ allowed: false });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { tryConsumeRequest } = await import('@/services/chat/CapService');
    const result = await tryConsumeRequest('test-shop.myshopify.com');
    expect(result).toEqual({ allowed: false });
  });
});
