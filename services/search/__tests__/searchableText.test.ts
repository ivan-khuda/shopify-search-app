/**
 * Unit tests for buildSearchableText (Phase 3, D-03).
 *
 * Pure function — no mocks, no vi.hoisted block.
 * Modelled on services/shopify/__tests__/ShopifyProductService.test.ts:36-50
 * (`describe('toDecimal')`).
 */
import { describe, it, expect } from 'vitest';
import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';
import { buildSearchableText } from '../searchableText';

function baseInput(overrides: Partial<ProductUpsertInput> = {}): ProductUpsertInput {
  return {
    title: '',
    handle: 'handle',
    description: null,
    descriptionHtml: null,
    vendor: null,
    productType: null,
    status: 'ACTIVE',
    tags: [],
    publishedAt: null,
    updatedAtShopify: null,
    variants: [],
    images: [],
    options: [],
    ...overrides,
  };
}

describe('buildSearchableText', () => {
  it('Title/Description/Tags/Vendor/Type/Options labels appear in output in that exact order', () => {
    const out = buildSearchableText(
      baseInput({
        title: 'T',
        description: 'D',
        tags: ['a', 'b'],
        vendor: 'V',
        productType: 'P',
        options: [{ name: 'Size', position: 1, values: ['S', 'M'] }],
      }),
    );
    expect(out).toBe(
      'Title: T\nDescription: D\nTags: a, b\nVendor: V\nType: P\nOptions: Size (S/M)',
    );
  });
});
