/**
 * Phase 8 Wave 0 RED scaffold — anchors CAP-01 + CAP-03 + SC4 (atomic-increment SQL shape).
 *
 * Pins the RequestCounterRepository.tryConsume contract:
 *   - Invokes prisma.$queryRaw with a tagged-template literal containing the
 *     canonical strings INSERT INTO request_counter, ON CONFLICT (shop, period),
 *     DO UPDATE, "requestCount" <, RETURNING
 *   - Returns { allowed: true, requestCount } when $queryRaw returns one row
 *   - Returns { allowed: false } when $queryRaw returns zero rows (cap reached)
 *
 * Implementation lands in Plan 08-07 at lib/db/repositories/RequestCounterRepository.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function flattenTaggedTemplate(strings: TemplateStringsArray | string[]): string {
  // prisma.$queryRaw is invoked as a tagged template; the first arg is the
  // strings array. Join all parts with the placeholder marker to assert the
  // canonical SQL shape without coupling to specific interpolation positions.
  return Array.from(strings).join(' ? ');
}

describe('RequestCounterRepository.tryConsume — atomic SQL shape (CAP-01 / SC4)', () => {
  it('invokes prisma.$queryRaw as a tagged template (first arg has strings array)', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume('test-shop.myshopify.com', '2026-05', 2000, 'storefront');
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    const [stringsArg] = queryRawMock.mock.calls[0];
    // Prisma.sql / tagged-template: first arg is an array-like of cooked strings.
    expect(Array.isArray(stringsArg) || (stringsArg as { raw?: unknown }).raw).toBeTruthy();
  });

  it('SQL contains INSERT INTO request_counter ... ON CONFLICT (shop, period) DO UPDATE ... WHERE "requestCount" < ... RETURNING', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume('test-shop.myshopify.com', '2026-05', 2000, 'storefront');
    const [stringsArg] = queryRawMock.mock.calls[0];
    const sql = flattenTaggedTemplate(stringsArg as TemplateStringsArray).toLowerCase();
    expect(sql).toContain('insert into');
    expect(sql).toContain('request_counter');
    expect(sql).toContain('on conflict');
    expect(sql).toContain('(shop, period)');
    expect(sql).toContain('do update');
    expect(sql).toContain('"requestcount" <');
    expect(sql).toContain('returning');
  });

  it('interpolates shop, period, and cap as bound parameters (no literal values in SQL strings)', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 7 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume('test-shop.myshopify.com', '2026-05', 2000, 'storefront');
    const args = queryRawMock.mock.calls[0];
    // Tagged template: args[0] is the strings array, args[1..N] are interpolated values.
    const values = args.slice(1);
    expect(values).toContain('test-shop.myshopify.com');
    expect(values).toContain('2026-05');
    expect(values).toContain(2000);
  });
});

describe('RequestCounterRepository.tryConsume — surface split (adminRequestCount)', () => {
  it('SQL increments "adminRequestCount" alongside "requestCount"', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume('test-shop.myshopify.com', '2026-05', 2000, 'admin');
    const [stringsArg] = queryRawMock.mock.calls[0];
    const sql = flattenTaggedTemplate(stringsArg as TemplateStringsArray).toLowerCase();
    expect(sql).toContain('"adminrequestcount"');
  });

  it("'admin' surface binds an increment of 1 for adminRequestCount", async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume('test-shop.myshopify.com', '2026-05', 2000, 'admin');
    const values = queryRawMock.mock.calls[0].slice(1);
    expect(values).toEqual(['test-shop.myshopify.com', '2026-05', 1, 1, 2000]);
  });

  it("'storefront' surface binds an increment of 0 for adminRequestCount", async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    await requestCounterRepository.tryConsume(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'storefront',
    );
    const values = queryRawMock.mock.calls[0].slice(1);
    expect(values).toEqual(['test-shop.myshopify.com', '2026-05', 0, 0, 2000]);
  });

  it('cap WHERE-clause still gates on "requestCount" < cap only (CAP-01 unchanged)', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    const result = await requestCounterRepository.tryConsume(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'admin',
    );
    const [stringsArg] = queryRawMock.mock.calls[0];
    const sql = flattenTaggedTemplate(stringsArg as TemplateStringsArray).toLowerCase();
    expect(sql).toContain('"requestcount" <');
    expect(sql).not.toContain('"adminrequestcount" <');
    expect(result).toEqual({ allowed: false });
  });
});

describe('RequestCounterRepository.tryConsume — return shape', () => {
  it('returns { allowed: true, requestCount } when one row is returned', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 5 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    const result = await requestCounterRepository.tryConsume(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'storefront',
    );
    expect(result).toEqual({ allowed: true, requestCount: 5 });
  });

  it('returns { allowed: false } when zero rows are returned (cap reached)', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    const result = await requestCounterRepository.tryConsume(
      'test-shop.myshopify.com',
      '2026-05',
      2000,
      'storefront',
    );
    expect(result).toEqual({ allowed: false });
  });

  it('returns { allowed: true, requestCount } correctly for the first request of a new period (requestCount === 1)', async () => {
    queryRawMock.mockResolvedValueOnce([{ requestCount: 1 }]);
    const { requestCounterRepository } = await import(
      '@/lib/db/repositories/RequestCounterRepository'
    );
    const result = await requestCounterRepository.tryConsume(
      'fresh-shop.myshopify.com',
      '2026-06',
      2000,
      'storefront',
    );
    expect(result).toEqual({ allowed: true, requestCount: 1 });
  });
});
