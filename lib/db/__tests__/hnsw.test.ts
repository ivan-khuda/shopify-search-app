/**
 * RED scaffold for withHnswIterativeScan (Phase 3, EMB-06, D-11).
 *
 * Mocks @/lib/db/client.prisma — analog to lib/db/repositories/__tests__/ProductRepository.test.ts
 * (vi.mock('@/lib/db/client', ...)). Uses vi.hoisted to share the spy refs with
 * the mock factory.
 *
 * Import from ../hnsw will resolve once plan 03-03 creates lib/db/hnsw.ts.
 */
import { describe, it, vi, beforeEach } from 'vitest';

const { executeRawMock, transactionMock } = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $executeRaw: executeRawMock,
    $transaction: transactionMock,
  },
}));

import { withHnswIterativeScan } from '../hnsw';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withHnswIterativeScan', () => {
  it.todo('delegates to prisma.$transaction in callback form');

  it.todo(
    "issues SET LOCAL hnsw.iterative_scan = 'relaxed_order' as the first statement inside the transaction",
  );

  it.todo(
    'invokes the user callback AFTER the SET LOCAL (verified via mock.invocationCallOrder)',
  );

  it.todo('returns the value returned by the user callback');
});
