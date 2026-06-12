import { describe, expect, it } from 'vitest';
import {
  DRAWER_ACCENT_PALETTE,
  DEFAULT_SHOP_SETTINGS,
  MAX_SUGGESTED_PROMPTS,
  parseShopSettings,
} from '../contract';

describe('shop settings contract', () => {
  it('exposes palette and defaults', () => {
    expect(DRAWER_ACCENT_PALETTE).toEqual(['#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A']);
    expect(MAX_SUGGESTED_PROMPTS).toBe(6);
    expect(DEFAULT_SHOP_SETTINGS).toMatchObject({
      emptyStateVariant: 'cards',
      cardDensity: 'standard',
      drawerAccent: '#5B4FE9',
      greetingMessage: null,
      suggestedPrompts: [],
      monthlyCapRequests: null,
      notificationEmail: null,
      drawerEnabled: true,
      editorPreviewVisible: true,
    });
  });

  it('parseShopSettings sanitises bad values to defaults', () => {
    expect(parseShopSettings({
      emptyStateVariant: 'hero',
      drawerAccent: '#008060',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
      drawerEnabled: false,
    })).toMatchObject({
      emptyStateVariant: 'hero',
      drawerAccent: '#008060',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
      drawerEnabled: false,
    });
    expect(parseShopSettings({
      drawerAccent: 'red',                       // not in palette → default
      suggestedPrompts: 'nope',                  // not array → []
      monthlyCapRequests: -5,                    // non-positive → null
    })).toMatchObject({
      drawerAccent: '#5B4FE9',
      suggestedPrompts: [],
      monthlyCapRequests: null,
    });
    expect(parseShopSettings(null)).toEqual(DEFAULT_SHOP_SETTINGS);
  });

  it('caps suggestedPrompts at MAX and drops malformed entries', () => {
    const prompts = Array.from({ length: 9 }, (_, i) => ({ icon: '✨', text: `p${i}` }));
    const parsed = parseShopSettings({ suggestedPrompts: [...prompts, { bad: true }] });
    expect(parsed.suggestedPrompts).toHaveLength(6);
    expect(parsed.suggestedPrompts[0]).toEqual({ icon: '✨', text: 'p0' });
  });
});
