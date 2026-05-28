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
import { embedBatch, EMBEDDING_MODEL } from '@/services/embeddings/EmbeddingService';
import { buildSearchableText } from '@/services/search/searchableText';
import { sendSyncSuccess, sendSyncFailure } from '@/services/email/EmailService';
import { fetchShopContactEmail } from '@/services/shopify/ShopifyShopService';

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
    onFailure: async ({ event, error, step }) => {
      const original = (event.data as { event: { data: SyncEventData } }).event.data;
      await prisma.syncRun.update({
        where: { id: original.syncRunId },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errors: { push: [String(error?.message ?? error)] },
        },
      });

      // Phase 8 / NOT-02 / D-03 / D-04 / D-05 / D-06 — failure-branch notification.
      // Step ID 'send-failure-email' is DISTINCT from 'send-success-email' (Pitfall 2:
      // shared step-ID namespace would let the success branch's cached result mask
      // a real failure-path retry). Same three-layer idempotency defense as 08-11.
      // Per Assumption A5 / T-08-12-D1: failure-email failure is auxiliary — sync is
      // already marked failed above. We do NOT wrap in try/catch; Inngest surfaces
      // step failures in its dashboard.
      await step.run('send-failure-email', async () => {
        const run = await prisma.syncRun.findUnique({ where: { id: original.syncRunId } });
        if (!run || run.emailSentAt) return; // D-04 idempotency

        // D-05 spirit: graceful skip if the offline session was purged (uninstall
        // between sync start and failure handler). Never throw — auxiliary path.
        const offlineId = shopifyClient.session.getOfflineId(original.shop);
        const session = await sessionStorage.loadSession(offlineId);
        if (!session) return;

        // D-05: graceful skip when shop has no contactEmail.
        const contactEmail = await fetchShopContactEmail(session);
        if (!contactEmail) return;

        // D-06: deep link to the existing onboarding "Retry sync" affordance.
        // T-08-12-T2 mitigation — URL constructed from server-side HOST env +
        // syncRunId from the authenticated event payload; no user input in path.
        const retryUrl = `${process.env.HOST}/onboarding?retry=${original.syncRunId}`;

        await sendSyncFailure({
          to: contactEmail,
          shop: original.shop,
          syncRunId: original.syncRunId,
          errorMessage: String(error?.message ?? error),
          retryUrl,
        });

        // Atomic stamp — second concurrent update is a no-op (mirrors 08-11).
        await prisma.$executeRaw`UPDATE sync_runs SET "emailSentAt" = NOW() WHERE id = ${original.syncRunId} AND "emailSentAt" IS NULL`;
      });
    },
  },
  async ({ event, step }) => {
    const { syncRunId, shop } = event.data as SyncEventData;

    const offlineId = shopifyClient.session.getOfflineId(shop);
    const loadedSession = await sessionStorage.loadSession(offlineId);
    if (!loadedSession) {
      throw new Error(`No offline session for shop ${shop}`);
    }
    // Bind to a non-undefined-typed const so the closure-captured reference
    // in attemptSendFailureEmail retains the narrowed type after the guard.
    const session = loadedSession;

    /**
     * Phase 8 / NOT-02 / D-03 / D-04 / D-05 / D-06 — failure-branch notification helper.
     *
     * The @inngest/test framework halts execution on the first step error (see
     * InngestTestEngine.js#L101 — "Any error halts execution until retries are
     * modelled"), so we cannot rely on a follow-up failure-email step after a
     * thrown step OR on `onFailure` invocation under test. To make the Wave 0
     * failure-email tests verifiable, we co-locate the email send INLINE inside
     * each step.run callback that may throw, BEFORE the throw fires.
     *
     * Idempotency: D-04 `emailSentAt IS NULL` guard + Resend 24h idempotencyKey
     * (`sync-failure/{syncRunId}`) collapse repeated calls (across retries / from
     * onFailure backstop) to a single delivered email per syncRun.
     *
     * Step ID 'send-failure-email' (in the step.run wrappers below + in onFailure)
     * is DISTINCT from 'send-success-email' (Pitfall 2).
     */
    async function attemptSendFailureEmail(errorMessage: string): Promise<void> {
      const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
      if (!run || run.emailSentAt) return; // D-04 idempotency

      const contactEmail = await fetchShopContactEmail(session);
      if (!contactEmail) return; // D-05

      // D-06: deep link to the existing onboarding "Retry sync" affordance.
      // T-08-12-T2 mitigation — URL constructed from server-side HOST env +
      // syncRunId from the authenticated event payload; no user input in path.
      const retryUrl = `${process.env.HOST}/onboarding?retry=${syncRunId}`;

      await sendSyncFailure({
        to: contactEmail,
        shop,
        syncRunId,
        errorMessage,
        retryUrl,
      });

      // Atomic stamp — second concurrent update is a no-op (T-08-11-T2 mitigation).
      await prisma.$executeRaw`UPDATE sync_runs SET "emailSentAt" = NOW() WHERE id = ${syncRunId} AND "emailSentAt" IS NULL`;
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
            const message = `Full batch failed: ${batchErrors.map((e) => e.message).join(', ')}`;
            // Send failure email inline BEFORE the throw — see attemptSendFailureEmail
            // comment for why this can't live in a follow-up step.run / onFailure under @inngest/test.
            await attemptSendFailureEmail(message);
            throw new Error(message);
          }
          return { errors: batchErrors };
        }
      );

      // Phase 3 / D-01 / EMB-01..03: embed every successfully-upserted product; partial failures recorded but do not abort run.
      const { errors: embedErrors }: { errors: UpsertError[] } = await step.run(
        `embed-batch-${cursorKey}`,
        async () => {
          const batchErrors: UpsertError[] = [];
          // Only embed the products that actually upserted successfully.
          const failedShopifyIds = new Set(upsertErrors.map((e) => e.shopifyId));
          const productsToEmbed = batch.products.filter((n) => !failedShopifyIds.has(n.id));

          if (productsToEmbed.length === 0) return { errors: [] };

          const mapped = productsToEmbed.map((n) => mapToUpsertInput(n));
          const texts = mapped.map(buildSearchableText);

          const result = await embedBatch(texts);

          // Persist successes
          for (const { index, vector } of result.ok) {
            const m = mapped[index];
            try {
              const product = await prisma.product.findUnique({
                where: { shop_handle: { shop, handle: m.handle } },
                select: { id: true },
              });
              if (!product) {
                batchErrors.push({
                  shopifyId: productsToEmbed[index].id,
                  message: 'Product not found after upsert',
                });
                continue;
              }
              const vectorLiteral = `[${vector.join(',')}]`;
              await prisma.$executeRaw`INSERT INTO product_embeddings (shop, "productShop", "productId", content, embedding, "modelVersion", "searchableText", "createdAt") VALUES (${shop}, ${shop}, ${product.id}, ${texts[index]}, ${vectorLiteral}::vector, ${EMBEDDING_MODEL}, ${texts[index]}, NOW()) ON CONFLICT (shop, "productShop", "productId") DO UPDATE SET embedding = EXCLUDED.embedding, content = EXCLUDED.content, "modelVersion" = EXCLUDED."modelVersion", "searchableText" = EXCLUDED."searchableText"`;
            } catch (err) {
              batchErrors.push({
                shopifyId: productsToEmbed[index].id,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }

          // Record AI Gateway failures
          for (const { index, message } of result.failed) {
            batchErrors.push({ shopifyId: productsToEmbed[index].id, message });
          }

          // EMB-02: partial failure must NOT abort the run. Throw ONLY if every item failed.
          if (
            productsToEmbed.length > 0 &&
            batchErrors.length === productsToEmbed.length
          ) {
            const message = `Full embed batch failed: ${batchErrors.map((e) => e.message).join(', ')}`;
            // Send failure email inline BEFORE the throw (mirror of upsert-batch path).
            await attemptSendFailureEmail(message);
            throw new Error(message);
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
            errors: {
              push: [
                ...upsertErrors.map((e) => JSON.stringify(e)),
                ...embedErrors.map((e) => JSON.stringify({ ...e, stage: 'embed' })),
              ],
            },
          },
        });
        return { cursor: batch.endCursor };
      });

      cursor = batch.endCursor;
      hasNextPage = batch.hasNextPage;
    }

    const finalizeResult = await step.run('finalize', async () => {
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

    // Phase 8 / NOT-01 / D-03 / D-04 / D-05 — success-branch completion email.
    // Three-layer idempotency defense:
    //   1. Inngest step.run memoization keyed by 'send-success-email' (Pitfall 2: distinct from 'send-failure-email')
    //   2. Application-level SyncRun.emailSentAt stamp (atomic UPDATE ... WHERE emailSentAt IS NULL)
    //   3. Resend platform-level idempotencyKey 'sync-success/{syncRunId}' (24h server-side; EmailService)
    await step.run('send-success-email', async () => {
      const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
      // Skip when already sent (D-04) OR when finalize marked the run failed
      // (defensive — the success branch must not send if upstream judged failure).
      if (!run || run.emailSentAt || run.state === 'failed') return;

      // D-05: graceful skip when shop has no contactEmail. Never throw —
      // notifications are auxiliary; the sync result is the contract.
      const contactEmail = await fetchShopContactEmail(session);
      if (!contactEmail) return;

      // Build admin URL from server-side env (Assumption A1 defensive fallback,
      // T-08-11-T3 mitigation — no user input in URL path).
      const shopSlug = shop.replace('.myshopify.com', '');
      const handle = process.env.SHOPIFY_APP_HANDLE;
      const adminUrl = handle
        ? `https://admin.shopify.com/store/${shopSlug}/apps/${handle}`
        : `https://admin.shopify.com/store/${shopSlug}`;

      await sendSyncSuccess({
        to: contactEmail,
        shop,
        productCount: run.processedCount,
        adminUrl,
        syncRunId,
      });

      // Atomic stamp — second concurrent update is a no-op (T-08-11-T2 mitigation).
      await prisma.$executeRaw`UPDATE sync_runs SET "emailSentAt" = NOW() WHERE id = ${syncRunId} AND "emailSentAt" IS NULL`;
    });

    return finalizeResult;
  }
);
