// lib/settings/contract.ts
// Full per-shop settings contract. Superset of lib/chat-ui/appearance.ts:
// appearance stays the chat-surface subset; this module owns everything the
// settings page and the drawer meta endpoint exchange. parseShopSettings is
// the single tolerant decoder (DB row → typed bundle, defaults on garbage).
import {
  DEFAULT_APPEARANCE,
  parseAppearance,
  type ShopAppearance,
} from '@/lib/chat-ui/appearance';

export const DRAWER_ACCENT_PALETTE = [
  '#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A',
] as const;
export type DrawerAccent = (typeof DRAWER_ACCENT_PALETTE)[number];

export const MAX_SUGGESTED_PROMPTS = 6;
export const MAX_PROMPT_TEXT = 120;
export const MAX_PROMPT_ICON = 8;
export const MAX_GREETING = 200;

export interface SuggestedPrompt {
  icon: string;
  text: string;
}

export interface ShopSettingsBundle extends ShopAppearance {
  drawerAccent: DrawerAccent;
  greetingMessage: string | null;
  suggestedPrompts: SuggestedPrompt[];
  monthlyCapRequests: number | null;
  notificationEmail: string | null;
  drawerEnabled: boolean;
  editorPreviewVisible: boolean;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettingsBundle = {
  ...DEFAULT_APPEARANCE,
  drawerAccent: '#5B4FE9',
  greetingMessage: null,
  suggestedPrompts: [],
  monthlyCapRequests: null,
  notificationEmail: null,
  drawerEnabled: true,
  editorPreviewVisible: true,
};

function parsePrompts(raw: unknown): SuggestedPrompt[] {
  if (!Array.isArray(raw)) return [];
  const out: SuggestedPrompt[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SUGGESTED_PROMPTS) break;
    if (
      item && typeof item === 'object' &&
      typeof (item as SuggestedPrompt).icon === 'string' &&
      typeof (item as SuggestedPrompt).text === 'string'
    ) {
      out.push({
        icon: (item as SuggestedPrompt).icon.slice(0, MAX_PROMPT_ICON),
        text: (item as SuggestedPrompt).text.slice(0, MAX_PROMPT_TEXT),
      });
    }
  }
  return out;
}

export function parseShopSettings(raw: unknown): ShopSettingsBundle {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const appearance = parseAppearance(obj);
  const accent = DRAWER_ACCENT_PALETTE.includes(obj.drawerAccent as DrawerAccent)
    ? (obj.drawerAccent as DrawerAccent)
    : DEFAULT_SHOP_SETTINGS.drawerAccent;
  const cap = typeof obj.monthlyCapRequests === 'number' &&
    Number.isInteger(obj.monthlyCapRequests) && obj.monthlyCapRequests > 0
    ? obj.monthlyCapRequests
    : null;
  return {
    ...appearance,
    drawerAccent: accent,
    greetingMessage:
      typeof obj.greetingMessage === 'string' && obj.greetingMessage.length > 0
        ? obj.greetingMessage.slice(0, MAX_GREETING)
        : null,
    suggestedPrompts: parsePrompts(obj.suggestedPrompts),
    monthlyCapRequests: cap,
    notificationEmail:
      typeof obj.notificationEmail === 'string' && obj.notificationEmail.includes('@')
        ? obj.notificationEmail
        : null,
    drawerEnabled: obj.drawerEnabled === false ? false : true,
    editorPreviewVisible: obj.editorPreviewVisible === false ? false : true,
  };
}
