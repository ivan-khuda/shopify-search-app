import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import {
  fetchProductBatch,
  fetchTotalCount,
  mapToUpsertInput,
  type FetchBatchResult,
} from '@/services/shopify/ShopifyProductService';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

interface SyncEventData {
  syncRunId: string;
  shop: string;
}

interface UpsertError {
  shopifyId: string;
  message: string;
}

export const syncProductsFunction = inngest.createFunction(
  {
    id: 'sync-products',
    triggers: [{ event: 'shopify/product.sync' }],
    retries: 3,
    onFailure: async ({ event, error }) => {
      const original = (event.data as { event: { data: SyncEventData } }).event.data;
      await prisma.syncRun.update({
        where: { id: original.syncRunId },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errors: { push: [String(error?.message ?? error)] },
        },
      });
    },
  },
  async ({ event, step }) => {
    const { syncRunId, shop } = event.data as SyncEventData;

    const offlineId = shopifyClient.session.getOfflineId(shop);
    const session = await sessionStorage.loadSession(offlineId);
    if (!session) {
      throw new Error(`No offline session for shop ${shop}`);
    }

    await step.run('mark-running', async () => {
      await prisma.syncRun.update({
        where: { id: syncRunId },
        data: { state: 'running', startedAt: new Date() },
      });
    });

    await step.run('fetch-total-count', async () => {
      const total = await fetchTotalCount(session);
      await prisma.syncRun.update({
        where: { id: syncRunId },
        data: { totalCount: total },
      });
      return total;
    });

    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const cursorKey: string = cursor ?? 'start';

      const batch: FetchBatchResult = await step.run(`fetch-batch-${cursorKey}`, async () =>
        fetchProductBatch(session, cursor, 100)
      );

      const { errors: upsertErrors }: { errors: UpsertError[] } = await step.run(
        `upsert-batch-${cursorKey}`,
        async () => {
          const batchErrors: UpsertError[] = [];
          for (const node of batch.products) {
            try {
              await productRepository.upsertProduct(shop, mapToUpsertInput(node));
            } catch (err) {
              batchErrors.push({
                shopifyId: node.id,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }
          if (
            batch.products.length > 0 &&
            batchErrors.length === batch.products.length
          ) {
            throw new Error(
              `Full batch failed: ${batchErrors.map((e) => e.message).join(', ')}`
            );
          }
          return { errors: batchErrors };
        }
      );

      await step.run(`persist-cursor-${cursorKey}`, async () => {
        await prisma.syncRun.update({
          where: { id: syncRunId },
          data: {
            cursor: batch.endCursor,
            processedCount: {
              increment: batch.products.length - upsertErrors.length,
            },
            errors: { push: upsertErrors.map((e) => JSON.stringify(e)) },
          },
        });
        return { cursor: batch.endCursor };
      });

      cursor = batch.endCursor;
      hasNextPage = batch.hasNextPage;
    }

    return await step.run('finalize', async () => {
      const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
      const errorCount = run?.errors.length ?? 0;
      const finalState: 'partial' | 'succeeded' = errorCount > 0 ? 'partial' : 'succeeded';
      await prisma.syncRun.update({
        where: { id: syncRunId },
        data: { state: finalState, finishedAt: new Date() },
      });
      return {
        state: finalState,
        processedCount: run?.processedCount ?? 0,
        errorCount,
      };
    });
  }
);
