/**
 * RED scaffold for IDN-06 — mergeVisitorIntoCustomer transaction.
 * Tests fail with "Cannot find module '@/lib/identity/merge'" until
 * Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ──────────────────────────────────────────────────────────────
const {
  transactionMock,
  visitorLinkFindUniqueMock,
  visitorLinkCreateMock,
  executeRawMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  visitorLinkFindUniqueMock: vi.fn(),
  visitorLinkCreateMock: vi.fn(),
  executeRawMock: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: transactionMock,
    visitorCustomerLink: {
      findUnique: visitorLinkFindUniqueMock,
      create: visitorLinkCreateMock,
    },
  },
}));

import { mergeVisitorIntoCustomer } from '@/lib/identity/merge';
import { prisma } from '@/lib/db/client';

const SHOP = 'mystore.myshopify.com';
const VISITOR_ID = 'visitor-uuid-001';
const CUSTOMER_ID = '5570080145486';

// Set up a transactionMock that runs the callback with a tx-scoped prisma proxy
function setupTransaction(): void {
  transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
    const tx = {
      visitorCustomerLink: {
        findUnique: visitorLinkFindUniqueMock,
        create: visitorLinkCreateMock,
      },
      $executeRaw: executeRawMock,
    };
    return callback(tx);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupTransaction();
  executeRawMock.mockResolvedValue(1);
  visitorLinkFindUniqueMock.mockResolvedValue(null); // No existing link by default
  visitorLinkCreateMock.mockResolvedValue({
    id: 'vcl-new',
    shop: SHOP,
    visitorId: VISITOR_ID,
    customerId: CUSTOMER_ID,
    mergedAt: new Date(),
  });
});

describe('mergeVisitorIntoCustomer (IDN-06)', () => {
  it('re-keys anonymous Conversation rows in place via UPDATE', async () => {
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    // The transaction callback must have called $executeRaw at least once
    // with a UPDATE "Conversation" ... SET "customerId" = ... WHERE "customerId" IS NULL
    expect(executeRawMock).toHaveBeenCalled();
    const allCalls = executeRawMock.mock.calls as unknown[][];
    // At least one call should be a Conversation UPDATE
    const updateCall = allCalls.find((call) => {
      const sqlStrings = call[0] as TemplateStringsArray;
      return Array.isArray(sqlStrings) && String(sqlStrings.join('')).includes('Conversation');
    });
    expect(updateCall).toBeDefined();
  });

  it('INSERTs SavedProduct rows with customerId set, ON CONFLICT DO NOTHING dedupes', async () => {
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    const allCalls = executeRawMock.mock.calls as unknown[][];
    const insertCall = allCalls.find((call) => {
      const sqlStrings = call[0] as TemplateStringsArray;
      return Array.isArray(sqlStrings) && String(sqlStrings.join('')).includes('SavedProduct');
    });
    expect(insertCall).toBeDefined();
  });

  it('DELETEs visitor-only SavedProduct rows after re-inserting with customerId', async () => {
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    const allCalls = executeRawMock.mock.calls as unknown[][];
    const deleteCall = allCalls.find((call) => {
      const sqlStrings = call[0] as TemplateStringsArray;
      const sql = String(sqlStrings.join(''));
      return Array.isArray(sqlStrings) && sql.includes('DELETE') && sql.includes('SavedProduct');
    });
    expect(deleteCall).toBeDefined();
  });

  it('INSERTs VisitorCustomerLink row as the final transaction step', async () => {
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    expect(visitorLinkCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shop: SHOP,
          visitorId: VISITOR_ID,
          customerId: CUSTOMER_ID,
        }),
      })
    );
  });

  it('is idempotent — second invocation with same triple is a no-op (short-circuits on existing VisitorCustomerLink)', async () => {
    // First call: no existing link
    visitorLinkFindUniqueMock.mockResolvedValue(null);
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    const firstCallExecuteCount = executeRawMock.mock.calls.length;
    const firstCallCreateCount = visitorLinkCreateMock.mock.calls.length;

    // Second call: existing link found → should short-circuit
    visitorLinkFindUniqueMock.mockResolvedValue({
      id: 'vcl-existing',
      shop: SHOP,
      visitorId: VISITOR_ID,
      customerId: CUSTOMER_ID,
      mergedAt: new Date(),
    });

    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    // No additional $executeRaw calls on second invocation
    expect(executeRawMock.mock.calls.length).toBe(firstCallExecuteCount);
    // No additional VisitorCustomerLink.create calls
    expect(visitorLinkCreateMock.mock.calls.length).toBe(firstCallCreateCount);
  });

  it('runs all steps within a single $transaction callback', async () => {
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    // Ensure prisma.$transaction was called exactly once
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
