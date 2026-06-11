/**
 * PATCH /api/settings/appearance — the single write path for
 * ShopSettings.emptyStateVariant / cardDensity.
 *
 * Auth, multi-tenancy, and error-shape contract mirror
 * app/api/settings/model/route.ts (shop from session only; zero logging).
 *
 * Response shape:
 *   - 200 → { ok: true, appearance: ShopAppearance }
 *   - 400 → { error: 'invalid_body' }
 *   - 401 → { error: <code> } (from withShopifySession)
 *
 * CLAUDE.md constraints:
 *   - Zero log calls. Errors return structured codes only.
 *   - shop sourced from verified session context only — never from body.
 */
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';
import {
  EMPTY_STATE_VARIANTS,
  CARD_DENSITIES,
  parseAppearance,
} from '@/lib/chat-ui/appearance';

const Body = z
  .object({
    emptyStateVariant: z.enum(EMPTY_STATE_VARIANTS).optional(),
    cardDensity: z.enum(CARD_DENSITIES).optional(),
  })
  .strict()
  .refine((b) => b.emptyStateVariant !== undefined || b.cardDensity !== undefined);

export const PATCH = withShopifySession(async ({ shop, req }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const row = await shopSettingsRepository.upsertAppearance(shop, parsed.data);
  return Response.json({ ok: true, appearance: parseAppearance(row) });
});
