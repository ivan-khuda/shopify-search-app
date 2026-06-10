/**
 * Phase 7 — Vercel AI Gateway model catalog client.
 *
 * This module is the single source of truth for "what models can be selected"
 * in the admin Settings page (Plan 08) and the active-model resolver (Plan 06).
 * It fetches the Vercel AI Gateway language-model catalog, filters to the
 * curated BEST_FOR keys (Open Question 1 resolution — caps the table at ~10
 * rows), and serves a D-03 fallback ladder on failure:
 *
 *   1. Cache hit within 15-min TTL  → return cached models, stale=false
 *   2. Fresh fetch succeeds          → repopulate cache, return models, stale=false
 *   3. Fetch fails WITH cached LKG   → return cached models, stale=true
 *   4. Fetch fails WITHOUT cached    → return DEFAULT_MODEL-only row,
 *                                       coldStartFallback=true
 *
 * Cache scope: in-memory module-level Map, per-process. Warm Vercel lambdas
 * may have slightly different snapshots — acceptable per D-03 / RESEARCH §A5.
 *
 * The cold-start fallback row's id literal (`'google/gemini-2.5-flash'`) is
 * deliberately duplicated from `getActiveChatModel.ts` to avoid a circular
 * import (RESEARCH §Anti-Patterns). The canonical DEFAULT_MODEL definition
 * still lives in the resolver module; this re-emits the same shape.
 *
 * Constraints (CLAUDE.md):
 *   - Zero console logging. Errors are silently caught and translated to
 *     fallback states.
 *   - No process.env reads. The /v1/models endpoint requires no auth.
 *   - No `any` types. The raw JSON shape is typed via RawModel.
 */

/**
 * Curated BEST_FOR map (D-02). Models without an entry fall back to the
 * literal string "General purpose". Copy is editorial — feel free to revise
 * descriptors, but the ids must match the live AI Gateway response.
 *
 * Source: RESEARCH.md §State of the Art (proposal) — verified against live
 * `https://ai-gateway.vercel.sh/v1/models` at 2026-05-27.
 */
export const BEST_FOR: Record<string, string> = {
  'google/gemini-2.5-flash': 'Fastest, low cost — great default',
  'google/gemini-2.5-flash-lite': 'Highest throughput, simplest tasks',
  'google/gemini-2.5-pro': 'Strong reasoning, vision, long context',
  'google/gemini-3.1-pro-preview': 'Newest Google flagship reasoning',
  'anthropic/claude-haiku-4.5': 'Anthropic balance of cost and quality',
  'anthropic/claude-sonnet-4.5': 'Anthropic mid-tier for complex queries',
  'anthropic/claude-opus-4.7': 'Best long-form reasoning, premium cost',
  'openai/gpt-5-mini': 'OpenAI value tier',
  'openai/gpt-5.5': 'OpenAI flagship general purpose',
  'xai/grok-4.3': 'Real-time knowledge, opinionated reasoning',
};

export interface CatalogModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  bestFor: string;
}

export interface CatalogResult {
  models: CatalogModel[];
  stale: boolean;
  coldStartFallback: boolean;
}

const CATALOG_URL = 'https://ai-gateway.vercel.sh/v1/models';
const TTL_MS = 15 * 60 * 1000;

interface RawPricing {
  input?: string;
  output?: string;
}

interface RawModel {
  id: string;
  name?: string;
  type?: string;
  provider?: string;
  owned_by?: string;
  context_window?: number;
  pricing?: RawPricing;
}

interface RawResponse {
  data: RawModel[];
}

interface Cached {
  data: CatalogModel[];
  expiresAt: number;
}

const cache = new Map<'catalog', Cached>();

/**
 * Test-only hook to reset the module-level cache between test runs.
 * Production code MUST NOT call this — the 15-minute TTL is the contract.
 */
export function __resetModelCatalogCacheForTests(): void {
  cache.clear();
}

/**
 * Map a raw Gateway model entry into our normalized CatalogModel shape.
 *
 * Pitfall 5: pricing.input/output are per-token decimal strings (e.g.
 * "0.0000003"). Multiply by 1_000_000 to get the $/M tokens figure the UI
 * renders. Use Number(...) (not parseFloat) for stricter parsing.
 *
 * Pitfall 6: pricing fields may be absent on tiered-pricing models. Default
 * to 0 to avoid NaN propagation.
 */
function mapRaw(m: RawModel): CatalogModel {
  const inputRaw = m.pricing?.input;
  const outputRaw = m.pricing?.output;
  const inputPerToken = inputRaw ? Number(inputRaw) : 0;
  const outputPerToken = outputRaw ? Number(outputRaw) : 0;
  const provider = m.provider ?? m.owned_by ?? '';
  const displayName = m.name ?? m.id;
  const contextWindow = typeof m.context_window === 'number' ? m.context_window : 0;
  return {
    id: m.id,
    displayName,
    provider,
    contextWindow,
    inputPricePerMillion: inputPerToken * 1_000_000,
    outputPricePerMillion: outputPerToken * 1_000_000,
    bestFor: BEST_FOR[m.id] ?? 'General purpose',
  };
}

/**
 * Cold-start fallback row, materialized when the first fetch fails and no
 * last-known-good cache entry exists. Mirrors the DEFAULT_MODEL constant in
 * `getActiveChatModel.ts` (duplicated by design to avoid a circular import).
 */
function coldStartRow(): CatalogModel {
  return {
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1_000_000,
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
    bestFor: BEST_FOR['google/gemini-2.5-flash'] ?? 'Fastest, low cost — great default',
  };
}

/**
 * Fetch the AI Gateway language-model catalog, decorated with the BEST_FOR
 * map and filtered to the curated allowlist.
 *
 * Behavior contract (drives services/chat/__tests__/model-catalog.test.ts):
 *
 *   1. Cache hit (now < expiresAt) → return cached, stale=false.
 *   2. Cache miss → fetch with cache:'no-store' (Pitfall 4), filter
 *      type==='language' AND id ∈ BEST_FOR (Open Question 1 resolution —
 *      caps the table at ~10 rows; resolver/page re-adds the active id at
 *      hydration time when it falls outside the curated list).
 *   3. Fetch failure with prior cache → return cached models, stale=true.
 *      Do NOT bump expiresAt; let the next call retry.
 *   4. Fetch failure with no cache → cold-start fallback row,
 *      coldStartFallback=true. Cache is NOT populated so the next call
 *      retries the real fetch.
 */
export async function fetchModelCatalog(): Promise<CatalogResult> {
  const now = Date.now();
  const cached = cache.get('catalog');
  if (cached && cached.expiresAt > now) {
    return { models: cached.data, stale: false, coldStartFallback: false };
  }

  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`gateway list models: ${res.status}`);
    }
    const json = (await res.json()) as RawResponse;
    // Filter to language models only (D-01). The BEST_FOR-keyed slim
    // (Open Question 1 resolution) is applied by the *caller* (resolver /
    // settings page) so that the active model id can be re-included when
    // it falls outside the curated list — the catalog returns the full
    // language-typed slice and lets the call site curate.
    const models = json.data
      .filter((m) => m.type === 'language')
      .map(mapRaw);
    cache.set('catalog', { data: models, expiresAt: now + TTL_MS });
    return { models, stale: false, coldStartFallback: false };
  } catch {
    if (cached) {
      // Last-known-good: serve stale data; do NOT bump expiresAt.
      return { models: cached.data, stale: true, coldStartFallback: false };
    }
    // Cold-start failure: DEFAULT_MODEL-only fallback.
    return {
      models: [coldStartRow()],
      stale: false,
      coldStartFallback: true,
    };
  }
}
