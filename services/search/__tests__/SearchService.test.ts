// Phase 4 RED scaffold for EMB-05 (D-01, D-02, D-03, D-08).
// Implementation target: services/search/SearchService.ts (created in plan 04-02).
// Until that file exists, every test in this file fails with a "module not found" error — this is the deterministic RED state.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { embedMock, queryRawMock } = vi.hoisted(() => ({
  embedMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock('@/services/embeddings/EmbeddingService', () => ({
  embed: embedMock,
}));

vi.mock('@/lib/db/hnsw', () => ({
  withHnswIterativeScan: vi.fn(async (cb: (tx: { $queryRaw: typeof queryRawMock }) => Promise<unknown>) =>
    cb({ $queryRaw: queryRawMock }),
  ),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

import {
  hybridSearch,
  RRF_K,
  BRANCH_LIMIT,
  RESULT_LIMIT,
} from '@/services/search/SearchService';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeVector(): number[] {
  return new Array(1536).fill(0);
}

describe('hybridSearch', () => {
  it('exports RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10', () => {
    expect(RRF_K).toBe(60);
    expect(BRANCH_LIMIT).toBe(50);
    expect(RESULT_LIMIT).toBe(10);
  });

  it('returns [] without calling embed when query is empty string', async () => {
    const result = await hybridSearch('shop.myshopify.com', '');
    expect(embedMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns [] without calling embed when query is whitespace-only', async () => {
    const result = await hybridSearch('shop.myshopify.com', '   \n  ');
    expect(embedMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('calls EmbeddingService.embed exactly once with the trimmed query when query is non-empty', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', '  shoes  ');

    expect(embedMock.mock.calls.length).toBe(1);
    expect(embedMock.mock.calls[0][0]).toBe('shoes');
  });

  it('SQL skeleton includes vec_ranked + lex_ranked + fused CTEs and uses <=> cosine operator and websearch_to_tsquery', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', 'shoes');

    const call = queryRawMock.mock.calls[0];
    const sqlSkeleton = (call[0] as readonly string[]).join('?');

    expect(sqlSkeleton).toMatch(/WITH vec_ranked AS[\s\S]*lex_ranked AS[\s\S]*fused AS/);
    expect(sqlSkeleton).toContain('::vector');
    expect(sqlSkeleton).toContain('<=>');
    expect(sqlSkeleton).toContain('websearch_to_tsquery');
    expect(sqlSkeleton).toContain('ts_rank_cd');
    expect(sqlSkeleton).toContain("p.status = 'ACTIVE'");
    expect(sqlSkeleton).not.toContain('<#>');
  });

  it('shop appears at least twice in vec_ranked WHERE clause (defense-in-depth per D-03)', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', 'shoes');

    const call = queryRawMock.mock.calls[0];
    const values = call.slice(1);
    const shopOccurrences = values.filter((v: unknown) => v === 'shop.myshopify.com').length;
    // Two branches (vec_ranked + lex_ranked) × two scoping checks each = at least 4.
    // Minimum requirement to prove D-03 enforcement is >= 2; we assert the stronger >= 4.
    expect(shopOccurrences).toBeGreaterThanOrEqual(4);
  });

  it('cross-shop isolation: shop value swaps cleanly between consecutive calls', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);
    await hybridSearch('shop-a.myshopify.com', 'shoes');

    vi.clearAllMocks();

    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);
    await hybridSearch('shop-b.myshopify.com', 'shoes');

    const call = queryRawMock.mock.calls[0];
    const values = call.slice(1);
    const hasShopA = values.some((v: unknown) => v === 'shop-a.myshopify.com');
    const hasShopB = values.some((v: unknown) => v === 'shop-b.myshopify.com');
    expect(hasShopA).toBe(false);
    expect(hasShopB).toBe(true);
  });

  it('price filter omitted when opts.priceMin and opts.priceMax are both undefined — sqlSkeleton does NOT contain MIN(price)', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', 'q');

    const call = queryRawMock.mock.calls[0];
    const sqlSkeleton = (call[0] as readonly string[]).join('?');
    expect(sqlSkeleton).not.toMatch(/MIN\(price\)/);
  });

  it('price filter included when opts.priceMin is provided — sqlSkeleton contains MIN(price) and GROUP BY and product_variants', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', 'q', { priceMin: 50 });

    const call = queryRawMock.mock.calls[0];
    const sqlSkeleton = (call[0] as readonly string[]).join('?');
    expect(sqlSkeleton).toContain('MIN(price)');
    expect(sqlSkeleton).toContain('GROUP BY');
    expect(sqlSkeleton).toContain('product_variants');
  });

  it('price filter included when opts.priceMax is provided — same MIN(price) join', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([]);

    await hybridSearch('shop.myshopify.com', 'q', { priceMax: 200 });

    const call = queryRawMock.mock.calls[0];
    const sqlSkeleton = (call[0] as readonly string[]).join('?');
    expect(sqlSkeleton).toContain('MIN(price)');
    expect(sqlSkeleton).toContain('GROUP BY');
    expect(sqlSkeleton).toContain('product_variants');
  });

  it('returns [] when $queryRaw throws (no error propagation, no secret leak)', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockRejectedValueOnce(new Error('connection refused'));

    const result = await hybridSearch('shop.myshopify.com', 'shoes');
    expect(result).toEqual([]);
  });

  it('projects RankedProductRow rows to ChatProduct shape (id is string, image undefined for null DB value, price formatted as $min – $max with en-dash U+2013 when min!==max)', async () => {
    embedMock.mockResolvedValueOnce(makeVector());
    queryRawMock.mockResolvedValueOnce([
      {
        id: 42,
        title: 'X',
        description: 'D',
        handle: 'x',
        priceMin: '10.00',
        priceMax: '20.00',
        tags: ['a'],
        vendor: 'V',
        productType: 'C',
        image: null,
        rrf_score: 0.5,
      },
    ]);

    const result = await hybridSearch('shop.myshopify.com', 'shoes');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('42');
    expect(typeof result[0].id).toBe('string');
    expect(result[0].image).toBeUndefined();
    expect(result[0].price).toBe('$10.00 – $20.00');
  });
});
