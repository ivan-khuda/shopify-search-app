import { prisma } from '@/lib/db/client';
import type { ShopSettings } from '@/app/generated/prisma/client';

/**
 * ShopSettingsRepository — thin Prisma wrapper for the `shop_settings` table.
 *
 * Contract (Phase 7 D-10):
 * - `get(shop)`: returns the row for `shop` or `null` when none exists. Callers
 *   (e.g. the chat model resolver in Plan 06) treat `null` as "no override —
 *   fall back to DEFAULT_MODEL".
 * - `upsert(shop, activeChatModelId)`: creates or updates the row keyed by
 *   `shop` (PK). `updatedAt` is `@updatedAt`-managed by Prisma; it MUST NOT be
 *   set manually.
 *
 * Multi-tenancy: `shop` is the primary key, so every query is structurally
 * scoped to a single shop. The shop must be derived from a verified session
 * token at the caller (Plan 07's PATCH route enforces this via
 * `withShopifySession`).
 *
 * Consumers:
 * - Plan 07 PATCH `/api/settings/model` — primary write site (uses `upsert`)
 * - Plan 06 `getActiveChatModel(shop)` resolver — may call `prisma.shopSettings`
 *   directly to skip the indirection; the repository is required only for
 *   mockability in route tests.
 */
export class ShopSettingsRepository {
  async get(shop: string): Promise<ShopSettings | null> {
    return prisma.shopSettings.findUnique({ where: { shop } });
  }

  async upsert(shop: string, activeChatModelId: string): Promise<ShopSettings> {
    return prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, activeChatModelId },
      update: { activeChatModelId },
    });
  }
}

export const shopSettingsRepository = new ShopSettingsRepository();
