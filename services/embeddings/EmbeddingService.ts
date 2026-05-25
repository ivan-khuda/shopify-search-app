/**
 * EmbeddingService — AI Gateway adapter for product vectorisation (Phase 3).
 *
 * Responsibilities:
 *   1. EMB-01: Centralise calls to Vercel AI Gateway for `openai/text-embedding-3-small`.
 *      PROJECT.md constraint locks AI Gateway as the *sole* runtime entry point for
 *      embeddings — never call the OpenAI SDK directly anywhere in the codebase.
 *   2. EMB-02: Provide a discriminated `{ ok, failed }` batch result so the sync loop
 *      can record partial-failure errors per input without try/catch noise.
 *   3. EMB-03: Pin the persisted `modelVersion` column to the frozen `EMBEDDING_MODEL`
 *      constant. Never use the gateway routing string (providerMetadata.gateway.routing)
 *      — that is a runtime telemetry value that may drift independently of intent.
 *
 * Security (T-3-02):
 *   The `embedBatch` catch block extracts `err.message` only. Never persist the full
 *   error object: doing so could leak headers (Authorization), request bodies, or
 *   provider-specific debug fields downstream into `SyncRun.errors[]` JSON.
 *
 * Authentication (T-3-03):
 *   `AI_GATEWAY_API_KEY` is read implicitly by the `ai` package's bundled gateway
 *   provider from `process.env`. The key is never referenced in source — it is
 *   only ever loaded from `.env` at runtime and transmitted via HTTPS by the SDK.
 */
import { embed as embedSdk, embedMany } from 'ai';
import { prisma } from '@/lib/db/client';

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;

export interface EmbedBatchResult {
  ok: Array<{ index: number; vector: number[] }>;
  failed: Array<{ index: number; message: string }>;
}

/**
 * Produce a single embedding vector for `text` via the AI Gateway.
 * Throws when the gateway returns a vector of unexpected length —
 * a dimension mismatch indicates a model misroute and must surface
 * loudly rather than silently corrupt the pgvector column.
 */
export async function embed(text: string): Promise<number[]> {
  const { embedding } = await embedSdk({
    model: EMBEDDING_MODEL,
    value: text,
    maxRetries: 2,
  });

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`
    );
  }

  return embedding;
}

/**
 * Embed an array of texts via a single AI Gateway `embedMany` call.
 *
 * Returns a discriminated result:
 *   - `ok`   : successfully embedded inputs, with original `index` preserved
 *   - `failed`: inputs whose batch call threw; populated with `err.message` only
 *
 * On a full-batch failure all inputs are reported in `failed` (one entry per
 * input). Callers can distinguish total failure (`ok.length === 0`) from
 * partial failure by inspecting both arrays.
 *
 * Empty input returns `{ ok: [], failed: [] }` without calling the gateway.
 */
export async function embedBatch(texts: string[]): Promise<EmbedBatchResult> {
  if (texts.length === 0) {
    return { ok: [], failed: [] };
  }

  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: texts,
      maxRetries: 2,
    });

    return {
      ok: embeddings.map((vector, index) => ({ index, vector })),
      failed: [],
    };
  } catch (err) {
    // T-3-02: persist err.message string only, never the full err object.
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: [],
      failed: texts.map((_, index) => ({ index, message })),
    };
  }
}

/**
 * Embed `text` and upsert it into `product_embeddings`, scoped to (shop, productId).
 *
 * The raw-SQL ON CONFLICT clause makes re-embedding the same product idempotent:
 * a subsequent webhook-triggered re-embed updates `embedding`, `content`,
 * `modelVersion`, and `searchableText` in place rather than inserting a duplicate.
 *
 * The vector is cast via `::vector` (not `<#>` and not `::float[]`) — `<#>` is
 * pgvector's *inner-product distance operator*, only valid for normalised vectors
 * (OpenAI's text-embedding-3-small does NOT pre-normalise output). Cosine
 * distance (`<=>`) is the query-time operator and lives in Phase 4.
 *
 * `modelVersion` is populated with the `EMBEDDING_MODEL` constant verbatim
 * (EMB-03). Never substitute the gateway routing string here.
 */
export async function embedAndStore(
  shop: string,
  productId: number,
  text: string
): Promise<void> {
  const vector = await embed(text);
  const vectorLiteral = `[${vector.join(',')}]`;

  await prisma.$executeRaw`INSERT INTO product_embeddings (shop, "productShop", "productId", content, embedding, "modelVersion", "searchableText", "createdAt") VALUES (${shop}, ${shop}, ${productId}, ${text}, ${vectorLiteral}::vector, ${EMBEDDING_MODEL}, ${text}, NOW()) ON CONFLICT (shop, "productShop", "productId") DO UPDATE SET embedding = EXCLUDED.embedding, content = EXCLUDED.content, "modelVersion" = EXCLUDED."modelVersion", "searchableText" = EXCLUDED."searchableText"`;
}
