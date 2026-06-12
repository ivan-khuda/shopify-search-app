import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  prisma: { shopSettings: { findUnique } },
}));

import { DEFAULT_SHOP_SETTINGS } from '@/lib/settings/contract';
import { getShopSettings } from '../getShopSettings';

describe('getShopSettings', () => {
  beforeEach(() => findUnique.mockReset());

  it('returns defaults for empty shop without touching the DB', async () => {
    await expect(getShopSettings('')).resolves.toEqual(DEFAULT_SHOP_SETTINGS);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns defaults when no row exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getShopSettings('test.myshopify.com')).resolves.toEqual(DEFAULT_SHOP_SETTINGS);
  });

  it('row values flow through parseShopSettings', async () => {
    findUnique.mockResolvedValue({
      shop: 'test.myshopify.com',
      activeChatModelId: null,
      emptyStateVariant: 'cards',
      cardDensity: 'standard',
      drawerAccent: '#008060',
      greetingMessage: 'Hello!',
      suggestedPrompts: [{ icon: '☕', text: 'Show me coffee' }],
      monthlyCapRequests: null,
      notificationEmail: null,
      drawerEnabled: false,
      editorPreviewVisible: true,
      updatedAt: new Date(),
    });
    const result = await getShopSettings('test.myshopify.com');
    expect(result).toMatchObject({
      drawerAccent: '#008060',
      suggestedPrompts: [{ icon: '☕', text: 'Show me coffee' }],
      drawerEnabled: false,
    });
    expect(result.greetingMessage).toBe('Hello!');
  });

  it('sanitises bad values — cardDensity banana → standard', async () => {
    findUnique.mockResolvedValue({
      shop: 'test.myshopify.com',
      activeChatModelId: null,
      emptyStateVariant: 'cards',
      cardDensity: 'banana',
      drawerAccent: '#5B4FE9',
      greetingMessage: null,
      suggestedPrompts: [],
      monthlyCapRequests: null,
      notificationEmail: null,
      drawerEnabled: true,
      editorPreviewVisible: true,
      updatedAt: new Date(),
    });
    const result = await getShopSettings('test.myshopify.com');
    expect(result.cardDensity).toBe('standard');
  });

  it('returns defaults when the DB throws', async () => {
    findUnique.mockRejectedValueOnce(new Error('db down'));
    await expect(getShopSettings('test.myshopify.com')).resolves.toEqual(DEFAULT_SHOP_SETTINGS);
    expect(findUnique).toHaveBeenCalledOnce();
  });
});
