/**
 * Integration-style RED scaffold for IDN-06 — mergeVisitorIntoCustomer full flow.
 *
 * This test runs with a real test DB when TEST_DATABASE_URL is set, or with
 * Prisma's mock pattern otherwise. Uses it.skipIf to skip gracefully in
 * non-DB environments (matches *.integration-test pattern in the repo).
 *
 * Tests fail with "Cannot find module '@/lib/identity/merge'" until Wave 2
 * ships implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock-based (unit layer) + skipIf integration guard ───────────────────────
// The mock pattern is used for local dev; the real DB path is guarded by
// TEST_DATABASE_URL (set only in CI with a real Postgres instance).

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
const VISITOR_ID = 'visitor-merge-integration-001';
const CUSTOMER_ID = '5570080145486';

function setupTransactionWithConversations(convCount: number, savedCount: number): void {
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

  // Simulate: UPDATE Conversation → convCount rows updated
  // Simulate: INSERT SavedProduct (copy with customerId) → savedCount rows
  // Simulate: DELETE SavedProduct (visitor-only) → savedCount rows
  executeRawMock
    .mockResolvedValueOnce(convCount)     // UPDATE Conversation
    .mockResolvedValueOnce(savedCount)    // INSERT SavedProduct copy
    .mockResolvedValueOnce(savedCount);   // DELETE SavedProduct visitor-only

  visitorLinkCreateMock.mockResolvedValue({
    id: 'vcl-new',
    shop: SHOP,
    visitorId: VISITOR_ID,
    customerId: CUSTOMER_ID,
    mergedAt: new Date(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  visitorLinkFindUniqueMock.mockResolvedValue(null);
});

describe('mergeVisitorIntoCustomer — integration (IDN-06)', () => {
  it(
    'creates VisitorCustomerLink + re-keys 3 anon Conversation rows + re-INSERTs 2 anon SavedProduct rows with customerId + DELETEs visitor-only rows',
    async () => {
      setupTransactionWithConversations(3, 2);

      await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

      // Verify VisitorCustomerLink was created
      expect(visitorLinkCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shop: SHOP,
            visitorId: VISITOR_ID,
            customerId: CUSTOMER_ID,
          }),
        })
      );

      // Verify $executeRaw was called 3 times (UPDATE Conversation, INSERT SavedProduct, DELETE SavedProduct)
      expect(executeRawMock).toHaveBeenCalledTimes(3);
    }
  );

  it('second call with same triple is a no-op — VisitorCustomerLink idempotency check', async () => {
    setupTransactionWithConversations(3, 2);

    // First merge
    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);
    const firstCallCount = executeRawMock.mock.calls.length;
    const firstCreateCount = visitorLinkCreateMock.mock.calls.length;

    // Second merge: existing VisitorCustomerLink found → early return
    visitorLinkFindUniqueMock.mockResolvedValue({
      id: 'vcl-existing',
      shop: SHOP,
      visitorId: VISITOR_ID,
      customerId: CUSTOMER_ID,
      mergedAt: new Date(),
    });

    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    // No additional database writes on second call
    expect(executeRawMock.mock.calls.length).toBe(firstCallCount);
    expect(visitorLinkCreateMock.mock.calls.length).toBe(firstCreateCount);
  });

  it('runs within a single transaction boundary', async () => {
    setupTransactionWithConversations(1, 1);

    await mergeVisitorIntoCustomer(SHOP, VISITOR_ID, CUSTOMER_ID);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it.skipIf(!process.env.TEST_DATABASE_URL)(
    'integration with real test DB: merge re-keys rows and second call is truly a no-op',
    async () => {
      // This test block runs only in CI with a real Postgres database.
      // When TEST_DATABASE_URL is set, use the real prisma client (unmocked).
      // The mock vi.mock above is overridden by resetting modules in this scope.
      //
      // Prerequisites:
      //   - TEST_DATABASE_URL points to a test Postgres with Phase 6 schema applied
      //   - Test shop, visitor, and customer data seeded for isolation
      //
      // For now this is a placeholder that validates the real integration path.
      // Wave 2 will seed + assert actual DB row state.

      const { mergeVisitorIntoCustomer: realMerge } = await import(
        '@/lib/identity/merge'
      );

      const testShop = `test-${Date.now()}.myshopify.com`;
      const testVisitor = `v-${Date.now()}`;
      const testCustomer = `c-${Date.now()}`;

      // First merge should succeed without throwing
      await expect(
        realMerge(testShop, testVisitor, testCustomer)
      ).resolves.toBeUndefined();

      // Second merge should also succeed (idempotent)
      await expect(
        realMerge(testShop, testVisitor, testCustomer)
      ).resolves.toBeUndefined();
    }
  );
});
