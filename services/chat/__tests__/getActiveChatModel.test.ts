// Phase 7 Wave 0 — getActiveChatModel resolver contract.
//
// Phase 4 (now obsolete) returned a hardcoded DEFAULT_MODEL for every shop.
// Those assertions are preserved under describe.skip as historical context.
//
// Phase 7 contract (D-06, D-09):
//   - No row for shop → returns DEFAULT_MODEL (no Prisma call when shop is empty)
//   - Row exists + catalog has matching id → returns { id, displayName from catalog }
//   - Row exists + catalog miss → synthesize displayName from id segment after '/'
//   - Row exists + catalog throws → same synthesis fallback (catalog outage)
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/services/chat/model-catalog', () => ({
  fetchModelCatalog: vi.fn(),
}));

import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from '@/services/chat/model-catalog';

const findUniqueMock = prisma.shopSettings.findUnique as ReturnType<typeof vi.fn>;
const fetchCatalogMock = fetchModelCatalog as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe.skip('Phase 4 contract (now obsolete — preserved as historical context)', () => {
  it("returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' } for any shop", async () => {
    const result = await getActiveChatModel('any-shop.myshopify.com');
    expect(result).toEqual({
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    });
  });

  it('returns the same constant for two different shops (Phase 4 is shop-agnostic by design)', async () => {
    const a = await getActiveChatModel('shop-a.myshopify.com');
    const b = await getActiveChatModel('shop-b.myshopify.com');
    expect(a).toEqual(b);
  });

  it('id field is the AI Gateway provider/model namespaced string format', async () => {
    const result = await getActiveChatModel('shop.myshopify.com');
    expect(result.id).toMatch(/^[a-z-]+\/[a-z0-9.-]+$/);
  });
});

describe('Phase 7 contract — DB-backed resolver (D-06, D-09)', () => {
  it('returns DEFAULT_MODEL when no ShopSettings row exists for shop (D-09)', async () => {
    findUniqueMock.mockResolvedValue(null);
    fetchCatalogMock.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
        },
      ],
    });

    const result = await getActiveChatModel('any-shop.myshopify.com');

    expect(result).toEqual({
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    });
  });

  it('returns DEFAULT_MODEL when shop is the empty string and never queries the DB', async () => {
    const result = await getActiveChatModel('');

    expect(result).toEqual({
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('reads ShopSettings and hydrates displayName from the catalog on DB hit (D-06)', async () => {
    findUniqueMock.mockResolvedValue({
      shop: 'shop-a.myshopify.com',
      activeChatModelId: 'anthropic/claude-sonnet-4.5',
      updatedAt: new Date(),
    });
    fetchCatalogMock.mockResolvedValue({
      models: [
        {
          id: 'anthropic/claude-sonnet-4.5',
          displayName: 'Claude Sonnet 4.5',
          provider: 'anthropic',
        },
        {
          id: 'google/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          provider: 'google',
        },
      ],
    });

    const result = await getActiveChatModel('shop-a.myshopify.com');

    expect(result).toEqual({
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
    });
  });

  it('synthesizes displayName from id segment when the catalog does not contain the saved id (Open Q3)', async () => {
    findUniqueMock.mockResolvedValue({
      shop: 'shop-b.myshopify.com',
      activeChatModelId: 'anthropic/claude-ghost-99',
      updatedAt: new Date(),
    });
    fetchCatalogMock.mockResolvedValue({
      models: [
        {
          id: 'google/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
        },
      ],
    });

    const result = await getActiveChatModel('shop-b.myshopify.com');

    expect(result.id).toBe('anthropic/claude-ghost-99');
    expect(result.displayName).toBe('claude-ghost-99');
  });

  it('synthesizes displayName from id segment when fetchModelCatalog throws (catalog outage)', async () => {
    findUniqueMock.mockResolvedValue({
      shop: 'shop-c.myshopify.com',
      activeChatModelId: 'anthropic/claude-sonnet-4.5',
      updatedAt: new Date(),
    });
    fetchCatalogMock.mockRejectedValue(new Error('catalog unavailable'));

    const result = await getActiveChatModel('shop-c.myshopify.com');

    expect(result.id).toBe('anthropic/claude-sonnet-4.5');
    expect(result.displayName).toBe('claude-sonnet-4.5');
  });
});

// RED: Phase 7 body of services/chat/getActiveChatModel.ts lands in Plan 06.
