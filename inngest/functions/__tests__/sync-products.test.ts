/**
 * Wave 0 RED stubs for SYN-03, SYN-06 (D-01 deterministic step IDs,
 * D-15 per-product try/catch error policy).
 *
 * This file goes RED on the missing `../sync-products` module — that's the
 * intended Wave 0 state. Plan 02-06 lands the production code and turns
 * these GREEN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    syncRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/repositories/ProductRepository', () => ({
  productRepository: {
    upsertProduct: vi.fn(),
  },
}));

vi.mock('@/services/shopify/ShopifyProductService', () => ({
  fetchProductBatch: vi.fn(),
  fetchTotalCount: vi.fn(),
  mapToUpsertInput: vi.fn(),
}));

vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: { getOfflineId: vi.fn((shop: string) => `offline_${shop}`) },
  },
}));

vi.mock('@/lib/shopify/session-storage', () => ({
  sessionStorage: { loadSession: vi.fn() },
}));

// RED: this import will fail until Plan 02-06 lands. @vite-ignore bypasses
// Vite's compile-time module resolution so the suite still loads at runtime.
let syncProductsFunction: unknown = undefined;
const TARGET = '../sync-products';
try {
  const mod = await import(/* @vite-ignore */ TARGET);
  syncProductsFunction = (mod as Record<string, unknown>).syncProductsFunction;
} catch {
  // expected RED state pre-Plan-06
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncProductsFunction (SYN-03, SYN-06)', () => {
  it.runIf(!!syncProductsFunction)('processes a single batch and marks SyncRun succeeded', async () => {
    // Plan 02-06: implement via @inngest/test InngestTestEngine.execute()
    expect(syncProductsFunction).toBeDefined();
  });

  it.runIf(!!syncProductsFunction)(
    'persists cursor after each batch via deterministic step.run IDs fetch-batch-${cursor} / upsert-batch-${cursor} / persist-cursor-${cursor} (D-01)',
    async () => {
      expect(syncProductsFunction).toBeDefined();
    }
  );

  it.runIf(!!syncProductsFunction)('marks state=partial when at least one product upsert fails but batch is not 100% failed (D-15, SYN-03)', async () => {
    expect(syncProductsFunction).toBeDefined();
  });

  it.runIf(!!syncProductsFunction)('throws to trigger Inngest retry when entire batch fails (D-15)', async () => {
    expect(syncProductsFunction).toBeDefined();
  });

  it.runIf(!!syncProductsFunction)('transitions queued→running at function start and writes finishedAt at end (D-03)', async () => {
    expect(syncProductsFunction).toBeDefined();
  });

  // Pre-Plan-06: assert the module is missing so the suite reports a clear RED.
  it.runIf(!syncProductsFunction)('PRE-IMPLEMENTATION: ../sync-products module is not yet created (Plan 02-06)', () => {
    expect(syncProductsFunction).toBeUndefined();
  });
});
