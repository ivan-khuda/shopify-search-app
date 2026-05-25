/**
 * RED scaffold for buildSearchableText (Phase 3, D-03).
 *
 * Pure function — no mocks, no vi.hoisted block.
 * Modelled on services/shopify/__tests__/ShopifyProductService.test.ts:36-50
 * (`describe('toDecimal')`).
 *
 * Import will fail to resolve until plan 03-02 creates services/search/searchableText.ts;
 * that is intentional RED. Vitest treats `it.todo` as not-yet-implemented (skipped, not failure).
 */
import { describe, it } from 'vitest';
import { buildSearchableText } from '../searchableText';

describe('buildSearchableText', () => {
  it.todo(
    'Title/Description/Tags/Vendor/Type/Options labels appear in output in that exact order',
  );

  it.todo(
    'Missing optional fields produce empty value after label (e.g. `Title: \\n`)',
  );

  it.todo(
    'Empty options array produces `Options: ` with no trailing comma or dangling separator',
  );

  it.todo(
    'Leading/trailing whitespace on title/description/vendor/productType is trimmed',
  );

  it.todo('options serialise as `name (v1/v2)` joined by `, `');
});
