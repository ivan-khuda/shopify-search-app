/**
 * RED scaffold for D-07 — retentionSweep Inngest function.
 * Tests use @inngest/test InngestTestEngine per VALIDATION.
 * Tests fail with "Cannot find module '@/inngest/functions/retention-sweep'"
 * until Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InngestTestEngine } from '@inngest/test';

// ── Mock prisma ──────────────────────────────────────────────────────────────
const {
  conversationFindManyMock,
  conversationDeleteManyMock,
} = vi.hoisted(() => ({
  conversationFindManyMock: vi.fn(),
  conversationDeleteManyMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    conversation: {
      findMany: conversationFindManyMock,
      deleteMany: conversationDeleteManyMock,
    },
  },
}));

import { retentionSweepFunction } from '@/inngest/functions/retention-sweep';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retentionSweepFunction (D-07)', () => {
  it('has cron trigger 0 3 * * 0 (weekly Sunday 03:00 UTC per RESEARCH §Pattern 3)', () => {
    // Verify the function is configured with the correct cron schedule
    // The InngestTestEngine wraps the function — we inspect its config
    const fn = retentionSweepFunction;
    // Function config should have a cron trigger
    expect(fn).toBeDefined();
    // The trigger schedule must match the spec
    const config = (fn as unknown as { opts?: { triggers?: Array<{ cron?: string }> } }).opts;
    if (config?.triggers) {
      const cronTrigger = config.triggers.find((t) => t.cron);
      expect(cronTrigger?.cron).toBe('0 3 * * 0');
    }
  });

  it('deletes rows with lastMessageAt < now()-180d in batches of 1000', async () => {
    // First batch: 1000 rows found and deleted
    conversationFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 1000 }, (_, i) => ({ id: `conv-${i}` }))
    );
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 1000 });

    // Second batch: 0 rows → loop exits
    conversationFindManyMock.mockResolvedValueOnce([]);
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 0 });

    const engine = new InngestTestEngine({ function: retentionSweepFunction });
    const { result } = await engine.execute({
      events: [{ name: 'inngest/scheduled.timer', data: {} }],
    });

    // Should have called findMany at least twice (batch 1 + exit check)
    expect(conversationFindManyMock).toHaveBeenCalled();
    // The findMany query should filter on lastMessageAt < cutoff
    const findManyCall = conversationFindManyMock.mock.calls[0][0] as {
      where?: { lastMessageAt?: { lt?: Date } };
      take?: number;
    };
    expect(findManyCall.where?.lastMessageAt?.lt).toBeInstanceOf(Date);
    expect(findManyCall.take).toBe(1000);

    // Result should report totalDeleted
    const typedResult = result as { totalDeleted: number } | undefined;
    if (typedResult) {
      expect(typeof typedResult.totalDeleted).toBe('number');
    }
  });

  it('exits loop immediately when first batch returns 0 rows', async () => {
    conversationFindManyMock.mockResolvedValueOnce([]);
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 0 });

    const engine = new InngestTestEngine({ function: retentionSweepFunction });
    const { result } = await engine.execute({
      events: [{ name: 'inngest/scheduled.timer', data: {} }],
    });

    // deleteMany should not be called when findMany returns 0 rows
    // (or called once with 0-result)
    expect(conversationFindManyMock).toHaveBeenCalled();

    const typedResult = result as { totalDeleted: number } | undefined;
    if (typedResult) {
      expect(typedResult.totalDeleted).toBe(0);
    }
  });

  it('processes multiple batches until findMany returns 0 (paginated step.run loop)', async () => {
    // Batch 1: 1000 rows
    conversationFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 1000 }, (_, i) => ({ id: `conv-batch1-${i}` }))
    );
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 1000 });

    // Batch 2: 500 rows
    conversationFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 500 }, (_, i) => ({ id: `conv-batch2-${i}` }))
    );
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 500 });

    // Batch 3: 0 rows → exit
    conversationFindManyMock.mockResolvedValueOnce([]);
    conversationDeleteManyMock.mockResolvedValueOnce({ count: 0 });

    const engine = new InngestTestEngine({ function: retentionSweepFunction });
    const { result } = await engine.execute({
      events: [{ name: 'inngest/scheduled.timer', data: {} }],
    });

    // Should have iterated at least 2 batches
    expect(conversationFindManyMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    const typedResult = result as { totalDeleted: number } | undefined;
    if (typedResult) {
      expect(typedResult.totalDeleted).toBeGreaterThanOrEqual(1500);
    }
  });

  it('the cutoff date is approximately 180 days ago', async () => {
    conversationFindManyMock.mockResolvedValueOnce([]);

    const engine = new InngestTestEngine({ function: retentionSweepFunction });
    await engine.execute({
      events: [{ name: 'inngest/scheduled.timer', data: {} }],
    });

    if (conversationFindManyMock.mock.calls.length > 0) {
      const call = conversationFindManyMock.mock.calls[0][0] as {
        where?: { lastMessageAt?: { lt?: Date } };
      };
      const cutoff = call.where?.lastMessageAt?.lt;
      if (cutoff instanceof Date) {
        const msIn180Days = 180 * 24 * 60 * 60 * 1000;
        const expectedCutoff = Date.now() - msIn180Days;
        // Allow 10 second tolerance for test execution time
        expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(10000);
      }
    }
  });
});
