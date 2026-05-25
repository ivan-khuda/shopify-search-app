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

  it('Missing optional fields produce empty value after label (e.g. `Title: \\n`)', () => {
    const out = buildSearchableText(baseInput({ title: 'T' }));
    // Each label still appears with an empty value after the colon.
    expect(out).toContain('Title: T\n');
    expect(out).toContain('Description: \n');
    expect(out).toContain('Tags: \n');
    expect(out).toContain('Vendor: \n');
    expect(out).toContain('Type: \n');
    // Trailing line has no trailing newline; assert via endsWith.
    expect(out.endsWith('Options: ')).toBe(true);
  });

  it('Empty options array produces `Options: ` with no trailing comma or dangling separator', () => {
    const out = buildSearchableText(
      baseInput({ title: 'T', options: [] }),
    );
    expect(out.endsWith('Options: ')).toBe(true);
    expect(out).not.toContain('undefined');
  });

  it('Leading/trailing whitespace on title/description/vendor/productType is trimmed', () => {
    const out = buildSearchableText(
      baseInput({
        title: '  Hello  ',
        description: '  D  ',
        vendor: '  V  ',
        productType: '  P  ',
      }),
    );
    expect(out).toContain('Title: Hello\n');
    expect(out).toContain('Description: D\n');
    expect(out).toContain('Vendor: V\n');
    expect(out).toContain('Type: P\n');
    expect(out).not.toContain('Title:   Hello  ');
    expect(out).not.toContain('Title: Hello \n');
  });

  it('options serialise as `name (v1/v2)` joined by `, `', () => {
    const out = buildSearchableText(
      baseInput({
        title: 'T',
        options: [
          { name: 'Size', position: 1, values: ['S', 'M', 'L'] },
          { name: 'Color', position: 2, values: ['Red', 'Blue'] },
        ],
      }),
    );
    expect(out).toContain('Options: Size (S/M/L), Color (Red/Blue)');
  });

  it('produces no "undefined" literal in any output', () => {
    // Build a minimal input — everything that can be null/empty is.
    const out = buildSearchableText(baseInput());
    expect(out).not.toContain('undefined');
    // Every label still appears even when every value is empty.
    expect(out).toContain('Title: ');
    expect(out).toContain('Description: ');
    expect(out).toContain('Tags: ');
    expect(out).toContain('Vendor: ');
    expect(out).toContain('Type: ');
    expect(out).toContain('Options: ');
  });
});
