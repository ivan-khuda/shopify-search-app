// Phase 7 Wave 0 RED scaffold.
// Pins the contract for services/chat/model-catalog.ts (D-01, D-02, D-03,
// RESEARCH §Pitfall 4 + Pitfall 5). Implementation lands in Plan 04.
//
// Contract assertions:
//   - fetchModelCatalog() calls Vercel AI Gateway /v1/models with cache:'no-store'
//     (Pitfall 4 — Next.js data-cache leakage across requests is forbidden)
//   - Filters response.data to entries with type === 'language' only (D-01)
//   - Maps pricing.input/.output (per-token strings) → input/outputPricePerMillion
//     numbers by multiplying by 1e6 (Pitfall 5 — $/M vs $/token must be explicit)
//   - Decorates rows with BEST_FOR[id] descriptor, falling back to 'General purpose' (D-02)
//   - Caches successful results in-memory for 15 minutes (D-03)
//   - Stale fallback: returns last-known-good with stale:true after a failed re-fetch (D-03)
//   - Cold-start fallback: returns a DEFAULT_MODEL-only row with coldStartFallback:true
//     when no LKG exists AND the very first fetch fails (D-03)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BEST_FOR,
  fetchModelCatalog,
  __resetModelCatalogCacheForTests,
  type CatalogModel,
  type CatalogResult,
} from '@/services/chat/model-catalog';

interface GatewayPricing {
  input: string;
  output: string;
}

interface GatewayModel {
  id: string;
  name?: string;
  type?: string;
  provider?: string;
  context_window?: number;
  pricing?: GatewayPricing;
}

interface GatewayResponse {
  data: GatewayModel[];
}

function makeFetchMock(response: GatewayResponse | Error) {
  if (response instanceof Error) {
    return vi.fn().mockRejectedValue(response);
  }
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  } as Response);
}

const baseGemini: GatewayModel = {
  id: 'google/gemini-2.5-flash',
  name: 'Gemini 2.5 Flash',
  type: 'language',
  provider: 'google',
  context_window: 1_048_576,
  pricing: { input: '0.0000003', output: '0.0000025' },
};

beforeEach(() => {
  __resetModelCatalogCacheForTests();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchModelCatalog — filtering + mapping (D-01, Pitfall 5)', () => {
  it('fetches /v1/models, filters type === "language", and converts pricing per-token → $/M', async () => {
    const fetchMock = makeFetchMock({
      data: [
        baseGemini,
        {
          id: 'openai/text-embedding-3-small',
          type: 'embedding',
          provider: 'openai',
          pricing: { input: '0.00000002', output: '0' },
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result: CatalogResult = await fetchModelCatalog();

    expect(result.models).toHaveLength(1);
    const [model] = result.models;
    expect(model.id).toBe('google/gemini-2.5-flash');
    // Pricing × 1e6: 0.0000003 * 1_000_000 = 0.3, 0.0000025 * 1_000_000 = 2.5
    expect(model.inputPricePerMillion).toBeCloseTo(0.3, 6);
    expect(model.outputPricePerMillion).toBeCloseTo(2.5, 6);
  });
});

describe('fetchModelCatalog — BEST_FOR decoration (D-02)', () => {
  it('decorates rows with BEST_FOR descriptor, falling back to "General purpose"', async () => {
    const unknownId = 'someprovider/model-with-no-curated-copy-xyz';
    const fetchMock = makeFetchMock({
      data: [
        baseGemini,
        {
          id: unknownId,
          type: 'language',
          provider: 'someprovider',
          context_window: 8192,
          pricing: { input: '0.0000001', output: '0.0000002' },
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchModelCatalog();
    const known = result.models.find((m: CatalogModel) => m.id === 'google/gemini-2.5-flash');
    const unknown = result.models.find((m: CatalogModel) => m.id === unknownId);

    expect(known?.bestFor).toBe(BEST_FOR['google/gemini-2.5-flash']);
    expect(unknown?.bestFor).toBe('General purpose');
  });
});

describe('fetchModelCatalog — failure fallback ladder (D-03)', () => {
  it('returns stale:true with last-known-good when re-fetch rejects after a prior success', async () => {
    const okMock = makeFetchMock({ data: [baseGemini] });
    vi.stubGlobal('fetch', okMock);
    const first = await fetchModelCatalog();
    expect(first.stale).not.toBe(true);
    expect(first.coldStartFallback).not.toBe(true);

    // Bust the 15-minute cache so the next call goes to fetch again.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
    const failMock = makeFetchMock(new Error('upstream 503'));
    vi.stubGlobal('fetch', failMock);

    const second = await fetchModelCatalog();
    expect(second.stale).toBe(true);
    expect(second.models).toEqual(first.models);
  });

  it('returns coldStartFallback:true with a DEFAULT_MODEL-only row when first fetch fails', async () => {
    const failMock = makeFetchMock(new Error('network down'));
    vi.stubGlobal('fetch', failMock);

    const result = await fetchModelCatalog();
    expect(result.coldStartFallback).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].id).toBe('google/gemini-2.5-flash');
  });
});

describe('fetchModelCatalog — caching (D-03)', () => {
  it('caches successful fetches for 15 minutes (skips fetch on second call within window)', async () => {
    const fetchMock = makeFetchMock({ data: [baseGemini] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchModelCatalog();
    await fetchModelCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
    await fetchModelCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses cache:"no-store" on every fetch (Pitfall 4 — Next.js data-cache must not silently cache cross-request)', async () => {
    const fetchMock = makeFetchMock({ data: [baseGemini] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchModelCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(init?.cache).toBe('no-store');
  });
});

// RED: implementation lands in Plan 04 (services/chat/model-catalog.ts).
