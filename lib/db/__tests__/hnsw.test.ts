/**
 * Unit tests for withHnswIterativeScan (Phase 3, EMB-06, D-11).
 *
 * Mocks @/lib/db/client.prisma — analog to lib/db/repositories/__tests__/ProductRepository.test.ts
 * (vi.mock('@/lib/db/client', ...)). Uses vi.hoisted to share the spy refs with
 * the mock factory.
 */
import { describe, it, vi, beforeEach, expect } from 'vitest';
import type { Prisma } from '@/app/generated/prisma/client';

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
  // Wire $transaction (callback form) to invoke the callback synchronously
  // with a `tx` object exposing $executeRaw — mirrors prisma 7's behaviour.
  transactionMock.mockImplementation(
    async (cb: (tx: { $executeRaw: typeof executeRawMock }) => Promise<unknown>) =>
      cb({ $executeRaw: executeRawMock }),
  );
});

describe('withHnswIterativeScan', () => {
  it('delegates to prisma.$transaction in callback form', async () => {
    await withHnswIterativeScan(async () => 'ok');

    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Defensive: prove the FIRST argument is a Function (callback form),
    // not an array (which would be Pitfall 1 — array form breaks SET LOCAL).
    expect(transactionMock.mock.calls[0][0]).toBeInstanceOf(Function);
  });

  it("issues SET LOCAL hnsw.iterative_scan = 'relaxed_order' as the first statement inside the transaction", async () => {
    await withHnswIterativeScan(async () => 'ok');

    expect(executeRawMock).toHaveBeenCalledTimes(1);
    // $executeRaw receives a TemplateStringsArray as its first argument.
    const templateStrings = executeRawMock.mock.calls[0][0] as TemplateStringsArray;
    expect(templateStrings.join('')).toBe(
      "SET LOCAL hnsw.iterative_scan = 'relaxed_order'",
    );
  });

  it('invokes the user callback AFTER the SET LOCAL (verified via mock.invocationCallOrder)', async () => {
    const userCb = vi.fn(async () => 'hello');
    await withHnswIterativeScan(userCb);

    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(userCb).toHaveBeenCalledTimes(1);
    expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      userCb.mock.invocationCallOrder[0],
    );
  });

  it('returns the value returned by the user callback', async () => {
    const result = await withHnswIterativeScan(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('passes the transaction client into the user callback', async () => {
    const userCb = vi.fn<(tx: Prisma.TransactionClient) => Promise<string>>(
      async () => 'ok',
    );
    await withHnswIterativeScan(userCb);

    const txArg = userCb.mock.calls[0][0] as unknown as {
      $executeRaw: typeof executeRawMock;
    };
    expect(txArg).toBeDefined();
    expect(txArg.$executeRaw).toBe(executeRawMock);
  });
});
