/**
 * GREEN tests for syncProductsFunction (SYN-03, SYN-06) post Plan 02-06.
 * Uses @inngest/test InngestTestEngine to invoke step.run callbacks inline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InngestTestEngine } from '@inngest/test';

const {
  syncRunUpdate,
  syncRunFindUnique,
  upsertMock,
  fetchBatchMock,
  fetchTotalCountMock,
  mapToUpsertMock,
  loadSessionMock,
  getOfflineIdMock,
  // Phase 3 additions (plan 03-01 RED scaffold)
  embedBatchMock,
  executeRawMock,
  productFindUniqueMock,
  buildSearchableTextMock,
} = vi.hoisted(() => ({
  syncRunUpdate: vi.fn(),
  syncRunFindUnique: vi.fn(),
  upsertMock: vi.fn(),
  fetchBatchMock: vi.fn(),
  fetchTotalCountMock: vi.fn(),
  mapToUpsertMock: vi.fn(),
  loadSessionMock: vi.fn(),
  getOfflineIdMock: vi.fn((shop: string) => `offline_${shop}`),
  embedBatchMock: vi.fn(),
  executeRawMock: vi.fn(),
  productFindUniqueMock: vi.fn(),
  buildSearchableTextMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    syncRun: {
      update: syncRunUpdate,
      findUnique: syncRunFindUnique,
    },
    // Phase 3 additions
    $executeRaw: executeRawMock,
    product: {
      findUnique: productFindUniqueMock,
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

// Phase 3 additions (plan 03-01) — EmbeddingService + buildSearchableText
vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embedBatch: embedBatchMock,
  EMBEDDING_MODEL: 'openai/text-embedding-3-small',
}));

vi.mock('@/services/search/searchableText', () => ({
  buildSearchableText: buildSearchableTextMock,
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
  // Phase 3 defaults: keep the embed-batch step a no-op for Phase 2 tests
  // unless an individual test overrides these mocks.
  embedBatchMock.mockImplementation(async (texts: string[]) => ({
    ok: texts.map((_, index) => ({ index, vector: new Array(1536).fill(0) })),
    failed: [],
  }));
  buildSearchableTextMock.mockImplementation((p: { handle: string }) => `text-${p.handle}`);
  productFindUniqueMock.mockResolvedValue({ id: 1 });
  executeRawMock.mockResolvedValue(1);
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

/**
 * GREEN tests for Phase 3 (plan 03-06) — embed-batch step inside the
 * Inngest sync function. Replaces the it.todo entries from plan 03-01.
 * Validates EMB-01 (embed every upserted product), EMB-02 (partial
 * failures don't abort the run, full-batch failures throw), and EMB-03
 * (modelVersion pinned to EMBEDDING_MODEL constant).
 */
describe('embed-batch step (Phase 3)', () => {
  it('calls EmbeddingService.embedBatch with searchableText for each upserted product (EMB-01)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValue({ id: 1 });
    // mapToUpsertMock returns { handle: node.id, ... } per beforeEach setup.
    // buildSearchableTextMock receives the mapped UpsertInput and returns a distinct text.
    buildSearchableTextMock.mockImplementation((p: { handle: string }) => `Title: ${p.handle}`);
    embedBatchMock.mockResolvedValueOnce({
      ok: [
        { index: 0, vector: new Array(1536).fill(0) },
        { index: 1, vector: new Array(1536).fill(0) },
      ],
      failed: [],
    });
    productFindUniqueMock.mockResolvedValue({ id: 42 });
    executeRawMock.mockResolvedValue(1);
    syncRunFindUnique.mockResolvedValueOnce({ id: 'sr_emb_001', processedCount: 2, errors: [] });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_emb_001', shop: 'test.myshopify.com' } }],
    });

    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    expect(embedBatchMock).toHaveBeenCalledWith([
      'Title: gid://shopify/Product/1',
      'Title: gid://shopify/Product/2',
    ]);
  });

  it('does NOT embed products whose upsert failed in the previous step', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(3);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
        { id: 'gid://shopify/Product/3' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    // Second product's upsert fails — only #1 and #3 should be embedded.
    upsertMock
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error('upsert blew up'))
      .mockResolvedValueOnce({ id: 3 });
    buildSearchableTextMock.mockImplementation((p: { handle: string }) => `Title: ${p.handle}`);
    embedBatchMock.mockResolvedValueOnce({
      ok: [
        { index: 0, vector: new Array(1536).fill(0) },
        { index: 1, vector: new Array(1536).fill(0) },
      ],
      failed: [],
    });
    productFindUniqueMock.mockResolvedValue({ id: 1 });
    executeRawMock.mockResolvedValue(1);
    syncRunFindUnique.mockResolvedValueOnce({
      id: 'sr_emb_002',
      processedCount: 2,
      errors: ['{"shopifyId":"gid://shopify/Product/2","message":"upsert blew up"}'],
    });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_emb_002', shop: 'test.myshopify.com' } }],
    });

    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    const embedCallTexts = embedBatchMock.mock.calls[0][0] as string[];
    // Product #2 (failed upsert) is excluded; only products #1 and #3 are embedded.
    expect(embedCallTexts).toEqual([
      'Title: gid://shopify/Product/1',
      'Title: gid://shopify/Product/3',
    ]);
    expect(embedCallTexts).not.toContain('Title: gid://shopify/Product/2');
  });

  it("partial embed failure pushes errors[] tagged stage:'embed' and run does not become 'failed' (EMB-02)", async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValue({ id: 1 });
    buildSearchableTextMock.mockImplementation((p: { handle: string }) => `Title: ${p.handle}`);
    embedBatchMock.mockResolvedValueOnce({
      ok: [{ index: 0, vector: new Array(1536).fill(0) }],
      failed: [{ index: 1, message: 'rate limit' }],
    });
    productFindUniqueMock.mockResolvedValue({ id: 42 });
    executeRawMock.mockResolvedValue(1);
    syncRunFindUnique.mockResolvedValueOnce({
      id: 'sr_emb_003',
      processedCount: 2,
      errors: ['{"shopifyId":"gid://shopify/Product/2","message":"rate limit","stage":"embed"}'],
    });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { result } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_emb_003', shop: 'test.myshopify.com' } }],
    });

    // Inspect the persist-cursor update's errors.push payload for the stage:'embed' tag.
    const persistUpdates = syncRunUpdate.mock.calls
      .map((c) => c[0])
      .filter((u) => u.data?.errors?.push);
    const allErrorPushes = persistUpdates.flatMap((u) => u.data.errors.push as string[]);
    const embedStageErrors = allErrorPushes.filter((s) => {
      try { return JSON.parse(s).stage === 'embed'; } catch { return false; }
    });
    expect(embedStageErrors.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(embedStageErrors[0]);
    expect(parsed).toMatchObject({ shopifyId: 'gid://shopify/Product/2', message: 'rate limit', stage: 'embed' });

    // Run continues — final state is 'partial', NOT 'failed'.
    expect((result as { state: string }).state).not.toBe('failed');
    expect(['succeeded', 'partial']).toContain((result as { state: string }).state);
  });

  it('full-batch embed failure throws so Inngest retries (EMB-02)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValue({ id: 1 });
    buildSearchableTextMock.mockImplementation((p: { handle: string }) => `Title: ${p.handle}`);
    // Every embed attempt fails — embed-batch step must throw, which triggers Inngest retry.
    embedBatchMock.mockResolvedValue({
      ok: [],
      failed: [
        { index: 0, message: 'gateway down' },
        { index: 1, message: 'gateway down' },
      ],
    });
    productFindUniqueMock.mockResolvedValue({ id: 42 });
    executeRawMock.mockResolvedValue(1);

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    const { error } = await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_emb_004', shop: 'test.myshopify.com' } }],
    });

    expect(error).toBeDefined();
    expect(String((error as Error)?.message ?? error)).toMatch(/Full embed batch failed/);
  });

  it('writes EMBEDDING_MODEL constant value into each raw SQL upsert (EMB-03)', async () => {
    fetchTotalCountMock.mockResolvedValueOnce(2);
    fetchBatchMock.mockResolvedValueOnce({
      products: [
        { id: 'gid://shopify/Product/1' },
        { id: 'gid://shopify/Product/2' },
      ],
      endCursor: null,
      hasNextPage: false,
    });
    upsertMock.mockResolvedValue({ id: 1 });
    buildSearchableTextMock.mockImplementation((p: { handle: string }) => `Title: ${p.handle}`);
    embedBatchMock.mockResolvedValueOnce({
      ok: [
        { index: 0, vector: new Array(1536).fill(0) },
        { index: 1, vector: new Array(1536).fill(0) },
      ],
      failed: [],
    });
    productFindUniqueMock.mockResolvedValue({ id: 42 });
    executeRawMock.mockResolvedValue(1);
    syncRunFindUnique.mockResolvedValueOnce({ id: 'sr_emb_005', processedCount: 2, errors: [] });

    const engine = new InngestTestEngine({ function: syncProductsFunction });
    await engine.execute({
      events: [{ name: 'shopify/product.sync', data: { syncRunId: 'sr_emb_005', shop: 'test.myshopify.com' } }],
    });

    // The raw SQL upsert is a tagged template: mock receives [stringsArray, ...values].
    // Flatten all interpolated values across all $executeRaw calls and confirm the
    // EMBEDDING_MODEL constant is present.
    expect(executeRawMock).toHaveBeenCalled();
    const allValues = executeRawMock.mock.calls.flatMap((call) => call.slice(1));
    expect(allValues).toContain('openai/text-embedding-3-small');
  });
});
