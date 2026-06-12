import { prisma } from '@/lib/db/client';
import type { Prisma, ShopSettings } from '@/app/generated/prisma/client';

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
 * - `upsertAppearance(shop, fields)`: creates or updates only the appearance
 *   columns (emptyStateVariant / cardDensity). A create leaves
 *   `activeChatModelId` null — appearance-only rows are valid (see
 *   getActiveChatModel's null guard).
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

  async upsertAppearance(
    shop: string,
    fields: { emptyStateVariant?: string; cardDensity?: string },
  ): Promise<ShopSettings> {
    return this.upsertFields(shop, fields);
  }

  /**
   * Generalised partial upsert for the settings-page write path (PATCH
   * /api/settings/shop). Callers MUST validate `fields` (zod-strict body)
   * before reaching this layer — the repository trusts its input shape.
   * A create leaves untouched columns at their schema defaults.
   */
  async upsertFields(
    shop: string,
    fields: Record<string, unknown>,
  ): Promise<ShopSettings> {
    return prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, ...fields } as Prisma.ShopSettingsUncheckedCreateInput,
      update: fields as Prisma.ShopSettingsUncheckedUpdateInput,
    });
  }
}

export const shopSettingsRepository = new ShopSettingsRepository();
