/**
 * PATCH /api/settings/shop — single write path for the settings-page fields
 * outside model selection (/api/settings/model) and chat appearance
 * (/api/settings/appearance). Auth/idiom mirrors /api/settings/appearance.
 *
 * Response shape:
 *   - 200 → { ok: true, settings: ShopSettingsBundle }
 *   - 400 → { error: 'invalid_body' | 'cap_above_limit' }
 *   - 401 → { error: <code> } (from withShopifySession)
 *
 * CLAUDE.md constraints:
 *   - Zero log calls. Errors return structured codes only.
 *   - shop sourced from verified session context only — never from body
 *     (Body schema is .strict(), so a smuggled `shop` key is a 400).
 */
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';
import {
  DRAWER_ACCENT_PALETTE,
  MAX_GREETING,
  MAX_PROMPT_ICON,
  MAX_PROMPT_TEXT,
  MAX_SUGGESTED_PROMPTS,
  parseShopSettings,
} from '@/lib/settings/contract';
import { readEffectiveDefaultCap } from '@/services/chat/CapService';

const Body = z
  .object({
    drawerAccent: z.enum(DRAWER_ACCENT_PALETTE).optional(),
    greetingMessage: z.string().max(MAX_GREETING).nullable().optional(),
    suggestedPrompts: z
      .array(
        z
          .object({
            icon: z.string().min(1).max(MAX_PROMPT_ICON),
            text: z.string().min(1).max(MAX_PROMPT_TEXT),
          })
          .strict(),
      )
      .max(MAX_SUGGESTED_PROMPTS)
      .optional(),
    monthlyCapRequests: z.number().int().min(1).nullable().optional(),
    notificationEmail: z.email().nullable().optional(),
    drawerEnabled: z.boolean().optional(),
    editorPreviewVisible: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0);

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
  // Lowering-only cap override (spec): merchant may not raise above the
  // operator default while V1 is free.
  if (
    parsed.data.monthlyCapRequests != null &&
    parsed.data.monthlyCapRequests > readEffectiveDefaultCap()
  ) {
    return Response.json({ error: 'cap_above_limit' }, { status: 400 });
  }
  const fields = {
    ...parsed.data,
    // Empty-string greeting means "clear back to built-in copy".
    ...(parsed.data.greetingMessage === '' ? { greetingMessage: null } : {}),
  };
  const row = await shopSettingsRepository.upsertFields(shop, fields);
  return Response.json({ ok: true, settings: parseShopSettings(row) });
});
