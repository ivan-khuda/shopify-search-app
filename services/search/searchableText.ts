import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';

/**
 * ASYMMETRY (D-03 vs D-04):
 *
 * This embed-input string INCLUDES `options` (e.g. `Options: Size (S/M/L)`)
 * because semantic search benefits from option vocabulary appearing in the
 * vector input.
 *
 * The tsvector column (`products.searchable`, populated by raw SQL per D-04
 * in plan 03-05) DOES NOT include options — only Title/Description/Tags/
 * Vendor/Type are concatenated for full-text search.
 *
 * Phase 4's SearchService relies on this asymmetry:
 *   - Embedding queries match against text that knows about options.
 *   - Lexical (tsvector) queries do NOT match against options to avoid
 *     diluting BM25 scores with high-frequency option-name tokens like
 *     "Size", "Color" that appear across nearly every product.
 *
 * DO NOT add options to the tsvector composition without re-deriving D-04.
 * DO NOT remove options from this helper without re-deriving D-03.
 */
export function buildSearchableText(product: ProductUpsertInput): string {
  const lines = [
    `Title: ${product.title?.trim() ?? ''}`,
    `Description: ${product.description?.trim() ?? ''}`,
    `Tags: ${(product.tags ?? []).join(', ')}`,
    `Vendor: ${product.vendor?.trim() ?? ''}`,
    `Type: ${product.productType?.trim() ?? ''}`,
    `Options: ${(product.options ?? [])
      .map((o) => `${o.name} (${o.values.join('/')})`)
      .join(', ')}`,
  ];
  return lines.join('\n');
}
