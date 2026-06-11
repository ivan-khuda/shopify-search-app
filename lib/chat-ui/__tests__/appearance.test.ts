import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE_VARIANTS,
  CARD_DENSITIES,
  DEFAULT_APPEARANCE,
  parseAppearance,
  SD_ACCENT,
} from '../appearance';

describe('appearance module', () => {
  it('exposes the variant unions and defaults', () => {
    expect(EMPTY_STATE_VARIANTS).toEqual(['cards', 'minimal', 'hero']);
    expect(CARD_DENSITIES).toEqual(['compact', 'standard', 'hero']);
    expect(DEFAULT_APPEARANCE).toEqual({
      emptyStateVariant: 'cards',
      cardDensity: 'standard',
    });
    expect(SD_ACCENT).toBe('#5B4FE9');
  });

  it('parseAppearance falls back to defaults for unknown values', () => {
    expect(parseAppearance({ emptyStateVariant: 'hero', cardDensity: 'compact' }))
      .toEqual({ emptyStateVariant: 'hero', cardDensity: 'compact' });
    expect(parseAppearance({ emptyStateVariant: 'bogus', cardDensity: null }))
      .toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});
