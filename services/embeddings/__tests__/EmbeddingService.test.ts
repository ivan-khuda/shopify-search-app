/**
 * RED scaffold for EmbeddingService (Phase 3, EMB-01, EMB-03, D-09, D-08).
 *
 * Mocks `ai` package (embed + embedMany) and `@/lib/db/client` (prisma.$executeRaw).
 * Pattern modelled on services/shopify/__tests__/ShopifyProductService.test.ts
 * (vi.hoisted destructure + functional vi.mock factory).
 *
 * The named imports below force plan 03-04 to export `EMBEDDING_MODEL` and
 * `EMBEDDING_DIMENSIONS` constants.
 */
import { describe, it, vi, beforeEach } from 'vitest';

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
    it.todo(
      'embed(text) returns a number[] of length EMBEDDING_DIMENSIONS (1536)',
    );

    it.todo(
      'embed(text) throws when AI Gateway returns vector with length != EMBEDDING_DIMENSIONS',
    );

    it.todo(
      "embed(text) calls embed() from 'ai' with model = EMBEDDING_MODEL constant 'openai/text-embedding-3-small'",
    );
  });

  describe('embedBatch', () => {
    it.todo(
      'embedBatch(texts) returns { ok: [{index, vector}], failed: [] } on full success',
    );

    it.todo(
      'embedBatch(texts) returns { ok: [], failed: [{index, message}] } when embedMany throws (one entry per input)',
    );

    it.todo(
      'embedBatch failed[].message contains err.message text only, never the full error object',
    );
  });

  describe('embedAndStore', () => {
    it.todo(
      'embedAndStore(shop, productId, text) calls embed then prisma.$executeRaw with the modelVersion equal to EMBEDDING_MODEL constant',
    );

    it.todo(
      'embedAndStore upsert SQL uses ON CONFLICT (shop, productShop, productId) DO UPDATE',
    );
  });
});
