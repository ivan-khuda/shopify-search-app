// lib/chat-ui/appearance.ts
// Shared appearance contract for both chat surfaces (admin + storefront).
// Persisted per-shop in ShopSettings; parseAppearance is the single
// tolerant decoder used by services, API routes, and the drawer fetch.

export const EMPTY_STATE_VARIANTS = ['cards', 'minimal', 'hero'] as const;
export const CARD_DENSITIES = ['compact', 'standard', 'hero'] as const;

export type EmptyStateVariant = (typeof EMPTY_STATE_VARIANTS)[number];
export type CardDensity = (typeof CARD_DENSITIES)[number];

export interface ShopAppearance {
  emptyStateVariant: EmptyStateVariant;
  cardDensity: CardDensity;
}

export const DEFAULT_APPEARANCE: ShopAppearance = {
  emptyStateVariant: 'cards',
  cardDensity: 'standard',
};

// Design-handoff accent (matches the landing page indigo).
export const SD_ACCENT = '#5B4FE9';

export function parseAppearance(raw: unknown): ShopAppearance {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const variant = EMPTY_STATE_VARIANTS.includes(obj.emptyStateVariant as EmptyStateVariant)
    ? (obj.emptyStateVariant as EmptyStateVariant)
    : DEFAULT_APPEARANCE.emptyStateVariant;
  const density = CARD_DENSITIES.includes(obj.cardDensity as CardDensity)
    ? (obj.cardDensity as CardDensity)
    : DEFAULT_APPEARANCE.cardDensity;
  return { emptyStateVariant: variant, cardDensity: density };
}
