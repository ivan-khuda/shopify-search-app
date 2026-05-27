import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * Wraps a callback in a Prisma transaction that first sets the pgvector
 * iterative-scan GUC (`hnsw.iterative_scan = 'relaxed_order'`).
 *
 * Uses the CALLBACK form of `$transaction` — NEVER the array form. The array
 * form does not guarantee a single BEGIN/COMMIT envelope, so a `SET LOCAL`
 * issued via `$transaction([...])` may land on a different connection than
 * the subsequent vector query and silently no-op, causing Postgres to bypass
 * the HNSW index without warning (Pitfall 1).
 *
 * The Accelerate pooler returns connections at COMMIT, so the `SET LOCAL`
 * only lives for the duration of this transaction.
 *
 * Shop-AGNOSTIC: multi-tenant filtering (`WHERE shop = $1`) MUST happen in
 * the user-supplied callback. Phase 4 SearchService is the canonical caller.
 */
export async function withHnswIterativeScan<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`;
    return callback(tx);
  });
}
