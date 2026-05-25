/**
 * GREEN tests for EmbeddingService (Phase 3, EMB-01, EMB-02, EMB-03, D-09, D-08).
 *
 * Mocks `ai` package (embed + embedMany) and `@/lib/db/client` (prisma.$executeRaw).
 * Pattern modelled on services/shopify/__tests__/ShopifyProductService.test.ts
 * (vi.hoisted destructure + functional vi.mock factory).
 *
 * Asserts:
 *   - dimension-mismatch guard throws (data-integrity)
 *   - modelVersion column receives EMBEDDING_MODEL constant verbatim (EMB-03)
 *   - ON CONFLICT clause is present (idempotent re-embedding)
 *   - embedBatch failed[].message is a plain string (T-3-02 — no err object leak)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { embedMock, embedManyMock, executeRawMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  embedManyMock: vi.fn(),
  executeRawMock: vi.fn(),
}));

vi.mock('ai', () => ({
  embed: embedMock,
  embedMany: embedManyMock,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $executeRaw: executeRawMock,
  },
}));

import {
  embed,
  embedBatch,
  embedAndStore,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from '../EmbeddingService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EmbeddingService', () => {
  describe('embed', () => {
    it('embed(text) returns a number[] of length EMBEDDING_DIMENSIONS (1536)', async () => {
      embedMock.mockResolvedValueOnce({
        embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
      });
      const result = await embed('hello');
      expect(result.length).toBe(1536);
      expect(EMBEDDING_DIMENSIONS).toBe(1536);
    });

    it('embed(text) throws when AI Gateway returns vector with length != EMBEDDING_DIMENSIONS', async () => {
      embedMock.mockResolvedValueOnce({
        embedding: new Array(100).fill(0),
      });
      await expect(embed('hello')).rejects.toThrow(/dimension mismatch/i);
    });

    it("embed(text) calls embed() from 'ai' with model = EMBEDDING_MODEL constant 'openai/text-embedding-3-small'", async () => {
      embedMock.mockResolvedValueOnce({
        embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
      });
      await embed('sample input');
      expect(embedMock).toHaveBeenCalledTimes(1);
      const firstArg = embedMock.mock.calls[0][0];
      expect(firstArg.model).toBe('openai/text-embedding-3-small');
      expect(EMBEDDING_MODEL).toBe('openai/text-embedding-3-small');
      expect(firstArg.value).toBe('sample input');
      expect(firstArg.maxRetries).toBe(2);
    });
  });

  describe('embedBatch', () => {
    it('embedBatch(texts) returns { ok: [{index, vector}], failed: [] } on full success', async () => {
      embedManyMock.mockResolvedValueOnce({
        embeddings: [
          [0, 1, 2],
          [3, 4, 5],
        ],
      });
      const result = await embedBatch(['a', 'b']);
      expect(result).toEqual({
        ok: [
          { index: 0, vector: [0, 1, 2] },
          { index: 1, vector: [3, 4, 5] },
        ],
        failed: [],
      });
    });

    it('embedBatch(texts) returns { ok: [], failed: [{index, message}] } when embedMany throws (one entry per input)', async () => {
      embedManyMock.mockRejectedValueOnce(new Error('rate limit hit'));
      const result = await embedBatch(['a', 'b']);
      expect(result.ok).toEqual([]);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0]).toEqual({ index: 0, message: 'rate limit hit' });
      expect(result.failed[1]).toEqual({ index: 1, message: 'rate limit hit' });
    });

    it('embedBatch failed[].message contains err.message text only, never the full error object (T-3-02)', async () => {
      // Build an Error with extra leak-prone fields (mimicking SDK error shapes).
      class LeakyError extends Error {
        config = { headers: { Authorization: 'Bearer SECRET-AI-GATEWAY-KEY' } };
        response = { data: { internal: 'do-not-leak' } };
        constructor(msg: string) {
          super(msg);
          this.name = 'LeakyError';
        }
      }
      embedManyMock.mockRejectedValueOnce(new LeakyError('upstream 429'));

      const result = await embedBatch(['x']);
      expect(result.failed).toHaveLength(1);
      const entry = result.failed[0];
      // message must be a plain string equal to err.message
      expect(typeof entry.message).toBe('string');
      expect(entry.message).toBe('upstream 429');
      // No secret/internal fields leaked through the result
      expect(JSON.stringify(entry)).not.toContain('SECRET-AI-GATEWAY-KEY');
      expect(JSON.stringify(entry)).not.toContain('Authorization');
      expect(JSON.stringify(entry)).not.toContain('do-not-leak');
      // entry shape is exactly { index, message } — no nested err/config/response/stack
      expect(Object.keys(entry).sort()).toEqual(['index', 'message']);
    });

    it('embedBatch([]) returns { ok: [], failed: [] } without calling embedMany (zero-input guard)', async () => {
      const result = await embedBatch([]);
      expect(result).toEqual({ ok: [], failed: [] });
      expect(embedManyMock).not.toHaveBeenCalled();
    });
  });

  describe('embedAndStore', () => {
    it('embedAndStore(shop, productId, text) calls embed then prisma.$executeRaw with the modelVersion equal to EMBEDDING_MODEL constant (EMB-03)', async () => {
      embedMock.mockResolvedValueOnce({
        embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.5),
      });
      executeRawMock.mockResolvedValueOnce(1);

      await embedAndStore('shop.myshopify.com', 42, 'sample text');

      expect(embedMock).toHaveBeenCalledTimes(1);
      expect(executeRawMock).toHaveBeenCalledTimes(1);

      // prisma.$executeRaw is called as a tagged template: ($strings, ...values).
      const call = executeRawMock.mock.calls[0];
      const values = call.slice(1);

      // EMB-03 proof: persisted modelVersion column value is the pinned constant.
      expect(values).toContain('openai/text-embedding-3-small');
      // Shop scoping: shop appears twice (shop column + productShop column).
      const shopOccurrences = values.filter((v: unknown) => v === 'shop.myshopify.com').length;
      expect(shopOccurrences).toBeGreaterThanOrEqual(2);
      // productId substituted
      expect(values).toContain(42);
      // content and searchableText both equal the input text
      const textOccurrences = values.filter((v: unknown) => v === 'sample text').length;
      expect(textOccurrences).toBeGreaterThanOrEqual(2);
    });

    it('embedAndStore upsert SQL uses ON CONFLICT (shop, productShop, productId) DO UPDATE (idempotent re-embedding)', async () => {
      embedMock.mockResolvedValueOnce({
        embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
      });
      executeRawMock.mockResolvedValueOnce(1);

      await embedAndStore('shop.myshopify.com', 1, 'text');

      const call = executeRawMock.mock.calls[0];
      const sqlSkeleton = (call[0] as readonly string[]).join('?');
      expect(sqlSkeleton).toMatch(/ON CONFLICT[\s\S]*shop[\s\S]*productShop[\s\S]*productId[\s\S]*DO UPDATE/);
      expect(sqlSkeleton).toContain('EXCLUDED."modelVersion"');
      // Vector cast must be ::vector, never <#> (inner-product distance operator).
      expect(sqlSkeleton).toContain('::vector');
      expect(sqlSkeleton).not.toContain('<#>');
    });
  });
});
