/**
 * GREEN tests for syncProductsFunction (SYN-03, SYN-06) post Plan 02-06.
 * Uses @inngest/test InngestTestEngine to invoke step.run callbacks inline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InngestTestEngine } from '@inngest/test';

const { syncRunUpdate, syncRunFindUnique, upsertMock, fetchBatchMock, fetchTotalCountMock, mapToUpsertMock, loadSessionMock, getOfflineIdMock } = vi.hoisted(() => ({
  syncRunUpdate: vi.fn(),
  syncRunFindUnique: vi.fn(),
  upsertMock: vi.fn(),
  fetchBatchMock: vi.fn(),
  fetchTotalCountMock: vi.fn(),
  mapToUpsertMock: vi.fn(),
  loadSessionMock: vi.fn(),
  getOfflineIdMock: vi.fn((shop: string) => `offline_${shop}`),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    syncRun: {
      update: syncRunUpdate,
      findUnique: syncRunFindUnique,
    },
  },
}));

vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: {
    upsertProduct: upsertMock,
  },
}));

vi.mock('@/services/shopify/ShopifyProductService', () => ({
  fetchProductBatch: fetchBatchMock,
  fetchTotalCount: fetchTotalCountMock,
  mapToUpsertInput: mapToUpsertMock,
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: { session: { getOfflineId: getOfflineIdMock } },
}));

vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: { loadSession: loadSessionMock },
}));

import { syncProductsFunction } from '../sync-products';

beforeEach(() => {
  vi.clearAllMocks();
  loadSessionMock.mockResolvedValue({ id: 'offline_test.myshopify.com', shop: 'test.myshopify.com', accessToken: 'shpat_xx' });
  syncRunUpdate.mockResolvedValue({});
  mapToUpsertMock.mockImplementation((node: { id: string }) => ({ shopifyId: BigInt(123), title: 'T', handle: node.id }));
});

describe('syncProductsFunction (SYN-03, SYN-06)', () => {
  it('processes a single batch and finalizes succeeded when no errors', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(1);
    fetchBatchMock.mockResolvedValueOnce({
      products: [{ id: 'gid://shopify/Product/1' }],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValueOnce({ id: 1 });
    syncRunFindUnique.mockResolvedValueOnce({ id: 'sr_001', processedCount: 1, errors: [] });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { result } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_001', shop: 'test.myshopify.com' } }],
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith('test.myshopify.com', expect.any(Object));
    expect((result as { state: string }).state).toBe('succeeded');
  });

  it('persists cursor after each batch via deterministic step IDs (D-01)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    // First batch with cursor='start'
    fetchBatchMock.mockResolvedValueOnce({
      products: [{ id: 'gid://shopify/Product/1' }],
      endCursor: 'cursor-after-1',
      hasNextPage: true,
    });
    // Second batch with cursor='cursor-after-1'
    fetchBatchMock.mockResolvedValueOnce({
      products: [{ id: 'gid://shopify/Product/2' }],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValue({ id: 1 });
    syncRunFindUnique.mockResolvedValueOnce({ id: 'sr_002', processedCount: 2, errors: [] });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { result } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_002', shop: 'test.myshopify.com' } }],
    });

    // Both batches processed; cursor was used as step ID
    expect(fetchBatchMock).toHaveBeenCalledTimes(2);
    expect(fetchBatchMock).toHaveBeenNthCalledWith(1, expect.anything(), null, 100);
    expect(fetchBatchMock).toHaveBeenNthCalledWith(2, expect.anything(), 'cursor-after-1', 100);
    expect((result as { state: string }).state).toBe('succeeded');
  });

  it('marks state=partial when one product upsert fails but batch is not 100% failed (D-15, SYN-03)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock
      .mockResolvedValueOnce({ id: 1 })  // first OK
      .mockRejectedValueOnce(new Error('constraint violation')); // second fails
    syncRunFindUnique.mockResolvedValueOnce({
      id: 'sr_003',
      processedCount: 1,
      errors: ['{"shopifyId":"gid://shopify/Product/2","message":"constraint violation"}'],
    });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { result } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_003', shop: 'test.myshopify.com' } }],
    });

    expect((result as { state: string }).state).toBe('partial');
    expect((result as { errorCount: number }).errorCount).toBe(1);
  });

  it('throws (triggers Inngest retry) when entire batch fails (D-15)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(1);
    fetchBatchMock.mockResolvedValueOnce({
      products: [{ id: 'gid://shopify/Product/1' }],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockRejectedValueOnce(new Error('db down'));

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { error } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_004', shop: 'test.myshopify.com' } }],
    });
    // Inngest test harness reports step errors via the result.error field
    // rather than rejecting the promise — a thrown step triggers a retry,
    // not an immediate rejection.
    expect(error).toBeDefined();
    expect(String((error as Error)?.message ?? error)).toMatch(/Full batch failed/);
  });

  it('transitions queued→running at function start and writes finishedAt at end (D-03)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(0);
    fetchBatchMock.mockResolvedValueOnce({
      products: [],
      endCursor: null,
      hasNextPage: false,
    });
    syncRunFindUnique.mockResolvedValueOnce({ id: 'sr_005', processedCount: 0, errors: [] });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_005', shop: 'test.myshopify.com' } }],
    });

    const updates = syncRunUpdate.mock.calls.map((c) => c[0]);
    // mark-running update
    expect(updates.some((u) => u.data?.state === 'running' && u.data?.startedAt instanceof Date)).toBe(true);
    // finalize update with finishedAt
    expect(updates.some((u) => u.data?.finishedAt instanceof Date && (u.data?.state === 'succeeded' || u.data?.state === 'partial'))).toBe(true);
  });
});
