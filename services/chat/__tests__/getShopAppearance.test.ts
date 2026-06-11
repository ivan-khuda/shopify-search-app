import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  prisma: { shopSettings: { findUnique } },
}));

import { getShopAppearance } from '../getShopAppearance';

describe('getShopAppearance', () => {
  beforeEach(() => findUnique.mockReset());

  it('returns defaults for empty shop without touching the DB', async () => {
    await expect(getShopAppearance('')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns defaults when no row exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
  });

  it('returns stored values, sanitised through parseAppearance', async () => {
    findUnique.mockResolvedValue({
      shop: 's.myshopify.com', activeChatModelId: null,
      emptyStateVariant: 'hero', cardDensity: 'banana', updatedAt: new Date(),
    });
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'hero', cardDensity: 'standard',
    });
  });

  it('returns defaults when the DB throws (chat hot path never breaks)', async () => {
    findUnique.mockRejectedValueOnce(new Error('down'));
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
  });
});
