// services/chat/getShopAppearance.ts
// Read path for the per-shop appearance settings. Mirrors the
// getActiveChatModel resolver philosophy: absence of a row (or any
// error) IS the defaults signal; this never throws into a render path.
import { prisma } from '@/lib/db/client';
import { DEFAULT_APPEARANCE, parseAppearance, type ShopAppearance } from '@/lib/chat-ui/appearance';

export async function getShopAppearance(shop: string): Promise<ShopAppearance> {
  if (!shop) return DEFAULT_APPEARANCE;
  try {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!row) return DEFAULT_APPEARANCE;
    return parseAppearance(row);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
