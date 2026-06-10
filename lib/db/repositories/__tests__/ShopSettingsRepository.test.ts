// Phase 7 Wave 0 RED scaffold for lib/db/repositories/ShopSettingsRepository.ts.
// Pins the get() + upsert() contract from D-10. Implementation lands in Plan 03.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';
import { prisma } from '@/lib/db/client';

const findUniqueMock = prisma.shopSettings.findUnique as ReturnType<typeof vi.fn>;
const upsertMock = prisma.shopSettings.upsert as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShopSettingsRepository.get', () => {
  it('returns null when no row exists', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await shopSettingsRepository.get('shop-a.myshopify.com');

    expect(result).toBeNull();
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { shop: 'shop-a.myshopify.com' },
    });
  });

  it('returns the row when present', async () => {
    const row = {
      shop: 'shop-a.myshopify.com',
      activeChatModelId: 'anthropic/claude-sonnet-4.5',
      updatedAt: new Date(),
    };
    findUniqueMock.mockResolvedValue(row);

    const result = await shopSettingsRepository.get('shop-a.myshopify.com');

    expect(result).toEqual(row);
    expect(result?.activeChatModelId).toBe('anthropic/claude-sonnet-4.5');
  });
});

describe('ShopSettingsRepository.upsert', () => {
  it('creates a row when none exists (create branch wired correctly)', async () => {
    const row = {
      shop: 'shop-a.myshopify.com',
      activeChatModelId: 'google/gemini-2.5-flash',
      updatedAt: new Date(),
    };
    upsertMock.mockResolvedValue(row);

    await shopSettingsRepository.upsert('shop-a.myshopify.com', 'google/gemini-2.5-flash');

    expect(upsertMock).toHaveBeenCalledWith({
      where: { shop: 'shop-a.myshopify.com' },
      create: {
        shop: 'shop-a.myshopify.com',
        activeChatModelId: 'google/gemini-2.5-flash',
      },
      update: { activeChatModelId: 'google/gemini-2.5-flash' },
    });
  });

  it('updates only activeChatModelId on an existing row', async () => {
    const row = {
      shop: 'shop-a.myshopify.com',
      activeChatModelId: 'anthropic/claude-sonnet-4.5',
      updatedAt: new Date(),
    };
    upsertMock.mockResolvedValue(row);

    await shopSettingsRepository.upsert('shop-a.myshopify.com', 'anthropic/claude-sonnet-4.5');

    const call = upsertMock.mock.calls[0][0];
    expect(call.update).toEqual({ activeChatModelId: 'anthropic/claude-sonnet-4.5' });
    // update branch must NOT touch shop (PK) or updatedAt (@updatedAt-managed)
    expect(call.update).not.toHaveProperty('shop');
    expect(call.update).not.toHaveProperty('updatedAt');
  });

  it('returns the post-write row including updatedAt', async () => {
    const row = {
      shop: 'shop-a.myshopify.com',
      activeChatModelId: 'google/gemini-2.5-flash',
      updatedAt: new Date('2026-05-27T00:00:00Z'),
    };
    upsertMock.mockResolvedValue(row);

    const result = await shopSettingsRepository.upsert(
      'shop-a.myshopify.com',
      'google/gemini-2.5-flash',
    );

    expect(result).toEqual(row);
    expect(result.updatedAt).toEqual(new Date('2026-05-27T00:00:00Z'));
  });
});

// RED: implementation lands in Plan 03 (lib/db/repositories/ShopSettingsRepository.ts).
