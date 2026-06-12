// services/settings/getShopSettings.ts
// Read path for the full per-shop settings bundle. Same philosophy as
// getShopAppearance (which remains for chat-surface callers): absence or
// error IS the defaults signal; never throws into a render path.
import { prisma } from '@/lib/db/client';
import {
  DEFAULT_SHOP_SETTINGS,
  parseShopSettings,
  type ShopSettingsBundle,
} from '@/lib/settings/contract';

export async function getShopSettings(shop: string): Promise<ShopSettingsBundle> {
  if (!shop) return DEFAULT_SHOP_SETTINGS;
  try {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!row) return DEFAULT_SHOP_SETTINGS;
    return parseShopSettings(row);
  } catch {
    return DEFAULT_SHOP_SETTINGS;
  }
}
