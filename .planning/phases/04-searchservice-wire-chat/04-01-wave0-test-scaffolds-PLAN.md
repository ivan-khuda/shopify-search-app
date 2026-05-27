---
phase: 04-searchservice-wire-chat
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - services/search/__tests__/SearchService.test.ts
  - services/chat/__tests__/getActiveChatModel.test.ts
  - app/api/chat/__tests__/route.test.ts
  - app/api/proxy/chat/__tests__/route.test.ts
  - components/chat/__tests__/message-parts.test.tsx
autonomous: true
requirements:
  - EMB-05
  - EMB-07
  - ADM-05
  - ADM-06
must_haves:
  truths:
    - "Wave 0 test scaffolds exist and import the (not-yet-existing) production files they target"
    - "Every test file fails on first run with a deterministic 'module not found' or 'expected behavior unimplemented' signal (RED state confirmed)"
    - "Test files reference the exact public API contracts subsequent waves must implement (hybridSearch signature, getActiveChatModel signature, tool-searchCatalog part type string, POST handler exports)"
  artifacts:
    - path: "services/search/__tests__/SearchService.test.ts"
      provides: "EMB-05 test surface: empty-query short-circuit, RRF SQL skeleton assertions, shop-scoping double-WHERE, price-filter CTE conditional, EmbeddingService.embed mock"
      contains: "describe('hybridSearch'"
    - path: "services/chat/__tests__/getActiveChatModel.test.ts"
      provides: "ADM-05/D-09 test surface: hardcoded constant returned for any shop"
      contains: "describe('getActiveChatModel"
    - path: "app/api/chat/__tests__/route.test.ts"
      provides: "ADM-06/D-04/D-05/D-10 test surface: AI Gateway plain-string model, tool registration as searchCatalog with inputSchema (not parameters), shop closure into execute, system prompt shop binding"
      contains: "describe('POST /api/chat"
    - path: "app/api/proxy/chat/__tests__/route.test.ts"
      provides: "EMB-07 stub test surface: 400 on missing shop, empty-query short-circuit, forwards (shop, query) to hybridSearch"
      contains: "describe('POST /api/proxy/chat"
    - path: "components/chat/__tests__/message-parts.test.tsx"
      provides: "D-06/ADM-06 UI test surface: tool-searchCatalog renders ProductCard grid on output-available, shimmer pill on input-streaming, zero-results affordance on empty output, error affordance on output-error"
      contains: "describe('MessageParts — tool-searchCatalog"
  key_links:
    - from: "services/search/__tests__/SearchService.test.ts"
      to: "services/search/SearchService.ts"
      via: "import { hybridSearch, RRF_K, BRANCH_LIMIT, RESULT_LIMIT } from '@/services/search/SearchService'"
      pattern: "from '@/services/search/SearchService'"
    - from: "services/chat/__tests__/getActiveChatModel.test.ts"
      to: "services/chat/getActiveChatModel.ts"
      via: "import { getActiveChatModel } from '@/services/chat/getActiveChatModel'"
      pattern: "from '@/services/chat/getActiveChatModel'"
    - from: "app/api/chat/__tests__/route.test.ts"
      to: "app/api/chat/route.ts"
      via: "import { POST } from '@/app/api/chat/route'"
      pattern: "from '@/app/api/chat/route'"
    - from: "app/api/proxy/chat/__tests__/route.test.ts"
      to: "app/api/proxy/chat/route.ts"
      via: "import { POST } from '@/app/api/proxy/chat/route'"
      pattern: "from '@/app/api/proxy/chat/route'"
    - from: "components/chat/__tests__/message-parts.test.tsx"
      to: "components/chat/message-parts.tsx"
      via: "import { MessageParts } from '@/components/chat/message-parts'"
      pattern: "from '@/components/chat/message-parts'"
---

<objective>
Author the five Wave 0 RED test scaffolds that lock down the Phase 4 public contracts BEFORE any implementation lands. Each test file imports its target production file (which does not yet exist for the new files, or has not yet been rewritten for `/api/chat/route.ts` and `components/chat/message-parts.tsx`). Running `bun test` produces deterministic failures — this is the RED state Wave 2+ turns GREEN.

Purpose: Phase 4 is operating with `workflow.nyquist_validation: true` (.planning/config.json). Per-task feedback latency is gated on test files existing first. This plan is the "lock the contracts" wave; subsequent waves only have to make these assertions pass without re-deriving the API shape.

Output: Five test files in their canonical locations, each red on first run, each importing the target file by its `@/...` alias path.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md
@.planning/phases/04-searchservice-wire-chat/04-RESEARCH.md
@.planning/phases/04-searchservice-wire-chat/04-PATTERNS.md
@.planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md
@.planning/phases/04-searchservice-wire-chat/04-VALIDATION.md
@services/embeddings/__tests__/EmbeddingService.test.ts
@app/api/shopify/sync/__tests__/route.test.ts
@lib/db/__tests__/hnsw.test.ts
@components/chat/__tests__/product-card.test.tsx
@services/search/__tests__/searchableText.test.ts

<interfaces>
<!-- Public API contracts the test scaffolds must lock in. Sourced from 04-RESEARCH.md §Concrete Syntax + 04-PATTERNS.md. -->

From services/search/SearchService.ts (to be created by 04-02):
- Named exports: hybridSearch, RRF_K, BRANCH_LIMIT, RESULT_LIMIT
- Constants: RRF_K = 60, BRANCH_LIMIT = 50, RESULT_LIMIT = 10
- Signature: async function hybridSearch(shop: string, query: string, opts?: { priceMin?: number; priceMax?: number }): Promise<ChatProduct[]>

From services/chat/getActiveChatModel.ts (to be created by 04-02):
- Named exports: getActiveChatModel, ActiveChatModel (type)
- Signature: async function getActiveChatModel(shop: string): Promise<{ id: string; displayName: string }>
- Phase 4 returns: { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }

From app/api/chat/route.ts (to be rewritten by 04-03):
- Named export: POST = withShopifySession(async ({ shop, req }) => Response)
- Calls streamText with model: 'google/gemini-2.5-flash' (plain string, AI Gateway routing)
- Registers tools: { searchCatalog: tool({ inputSchema: z.object({ query, priceMin, priceMax }), execute }) }
- Returns: result.toUIMessageStreamResponse()

From app/api/proxy/chat/route.ts (to be created by 04-04):
- Named export: POST(req: Request): Promise<Response>
- 400 on missing ?shop=
- Returns { products: [] } on empty/whitespace query
- Otherwise calls hybridSearch(shop, query) and returns { products }

From components/chat/message-parts.tsx (to be modified by 04-05):
- Existing export: MessageParts (component)
- New prop shape: { parts, messageId, status, savedProductIds: Set<string>, onToggleSave: (p: ChatProduct) => void }
- Renders switch on part.type === 'tool-searchCatalog' with sub-switch on part.state
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the three service+route test scaffolds (SearchService, getActiveChatModel, proxy/chat)</name>
  <files>services/search/__tests__/SearchService.test.ts, services/chat/__tests__/getActiveChatModel.test.ts, app/api/proxy/chat/__tests__/route.test.ts</files>
  <read_first>
    - services/embeddings/__tests__/EmbeddingService.test.ts (canonical vi.hoisted + vi.mock('ai') + vi.mock('@/lib/db/client') + executeRaw shop-double-occurrence assertion pattern — copy structure exactly)
    - services/search/__tests__/searchableText.test.ts (pure-function test pattern, no mocks, used as analog for getActiveChatModel.test.ts)
    - lib/db/__tests__/hnsw.test.ts:11-33 (transactionMock callback-form pattern; SearchService.test.ts mocks `@/lib/db/hnsw` withHnswIterativeScan to invoke its callback with a tx object exposing queryRawMock)
    - app/api/shopify/sync/__tests__/route.test.ts (helper makeRequest() pattern for proxy route test; vi.mock('@/lib/db/client') + vi.hoisted handles)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md sections "services/search/__tests__/SearchService.test.ts" and "services/chat/__tests__/getActiveChatModel.test.ts" and "app/api/proxy/chat/__tests__/route.test.ts"
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Validation Architecture" Phase Requirements→Test Map rows for EMB-05 and EMB-07
    - types/product.ts (ChatProduct shape used in test fixtures)
  </read_first>
  <action>
    Create three vitest files following the analog patterns. All three files use the `vi.hoisted` + factory mock pattern from EmbeddingService.test.ts. Files MUST be deterministically red on first run.

    File 1 — services/search/__tests__/SearchService.test.ts (per D-01, D-02, D-03, D-08, EMB-05):
    - Imports: `describe, it, expect, vi, beforeEach` from 'vitest'; `hybridSearch, RRF_K, BRANCH_LIMIT, RESULT_LIMIT` from '@/services/search/SearchService'
    - vi.hoisted block produces { embedMock, queryRawMock } as vi.fn()
    - vi.mock('@/services/embeddings/EmbeddingService', () => ({ embed: embedMock }))
    - vi.mock('@/lib/db/hnsw', () => ({ withHnswIterativeScan: vi.fn(async (cb) => cb({ $queryRaw: queryRawMock })) }))
    - vi.mock('@/lib/db/client', () => ({ prisma: {} })) — defensive, prevents real Prisma init
    - beforeEach(() => vi.clearAllMocks())
    - Test cases (each `it` block exists and asserts a behavior; no test should be xit/skipped):
      1. `exports RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10` — assertions on imported constants
      2. `returns [] without calling embed when query is empty string` — call hybridSearch('shop.myshopify.com', ''); expect embedMock not called; expect result === []
      3. `returns [] without calling embed when query is whitespace-only` — same with '   \n  '
      4. `calls EmbeddingService.embed exactly once with the trimmed query when query is non-empty` — embedMock.mockResolvedValueOnce(new Array(1536).fill(0)); queryRawMock.mockResolvedValueOnce([]); await hybridSearch; expect embedMock.mock.calls.length === 1; expect embedMock.mock.calls[0][0] === trimmed query
      5. `SQL skeleton includes vec_ranked + lex_ranked + fused CTEs and uses <=> cosine operator and websearch_to_tsquery` — embedMock.mockResolvedValueOnce(vector); queryRawMock.mockResolvedValueOnce([]); await hybridSearch; extract `const call = queryRawMock.mock.calls[0]; const sqlSkeleton = (call[0] as readonly string[]).join('?');` then assert sqlSkeleton matches /WITH vec_ranked AS[\s\S]*lex_ranked AS[\s\S]*fused AS/ AND contains '::vector', '<=>', 'websearch_to_tsquery', 'ts_rank_cd', "p.status = 'ACTIVE'", and does NOT contain '<#>'
      6. `shop appears at least twice in vec_ranked WHERE clause (defense-in-depth per D-03)` — call hybridSearch('shop.myshopify.com', 'shoes'); extract `const values = call.slice(1);` (everything after the tagged-template strings array); count occurrences of 'shop.myshopify.com' in values; expect count >= 4 (twice for vec_ranked, twice for lex_ranked, total 4 across both branches; >= 2 minimum proves D-03 enforcement)
      7. `cross-shop isolation: shop value swaps cleanly between consecutive calls` — call once with 'shop-a.myshopify.com', clearMocks, call again with 'shop-b.myshopify.com'; assert values from second call contain only 'shop-b.myshopify.com' (no 'shop-a' leak)
      8. `price filter omitted when opts.priceMin and opts.priceMax are both undefined — sqlSkeleton does NOT contain MIN(price)` — call hybridSearch('shop', 'q'); assert sqlSkeleton does not match /MIN\(price\)/
      9. `price filter included when opts.priceMin is provided — sqlSkeleton contains MIN(price) and GROUP BY` — call hybridSearch('shop', 'q', { priceMin: 50 }); assert sqlSkeleton contains 'MIN(price)' and 'GROUP BY' and 'product_variants'
      10. `price filter included when opts.priceMax is provided — same MIN(price) join` — symmetrical test for priceMax only
      11. `returns [] when $queryRaw throws (no error propagation, no secret leak)` — embedMock.mockResolvedValueOnce(vector); queryRawMock.mockRejectedValueOnce(new Error('connection refused')); await hybridSearch returns [] (per CONTEXT.md Claude's Discretion error path)
      12. `projects RankedProductRow rows to ChatProduct shape (id is string, image undefined for null DB value, price formatted as $min – $max with en-dash U+2013 when min!==max)` — queryRawMock.mockResolvedValueOnce([{ id: 42, title: 'X', description: 'D', handle: 'x', priceMin: '10.00', priceMax: '20.00', tags: ['a'], vendor: 'V', productType: 'C', image: null, rrf_score: 0.5 }]); await hybridSearch; assert result[0].id === '42' (string), result[0].image === undefined, result[0].price === '$10.00 – $20.00'
    - At the top of the file add this comment block:
      `// Phase 4 RED scaffold for EMB-05 (D-01, D-02, D-03, D-08).`
      `// Implementation target: services/search/SearchService.ts (created in plan 04-02).`
      `// Until that file exists, every test in this file fails with a "module not found" error — this is the deterministic RED state.`

    File 2 — services/chat/__tests__/getActiveChatModel.test.ts (per D-09, ADM-05):
    - Imports: `describe, it, expect` from 'vitest'; `getActiveChatModel` from '@/services/chat/getActiveChatModel'
    - No mocks. Pure function under test.
    - Test cases:
      1. `returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' } for any shop`
      2. `returns the same constant for two different shops (Phase 4 is shop-agnostic by design; Phase 7 will diverge)`
      3. `id field is the AI Gateway provider/model namespaced string format` — assert result.id matches /^[a-z-]+\/[a-z0-9.-]+$/
    - Header comment block: `// Phase 4 RED scaffold for ADM-05 / D-09. Implementation target: services/chat/getActiveChatModel.ts (created in plan 04-02).`

    File 3 — app/api/proxy/chat/__tests__/route.test.ts (per EMB-07 success criterion #3):
    - Imports: `describe, it, expect, vi, beforeEach` from 'vitest'; `POST` from '@/app/api/proxy/chat/route'
    - vi.hoisted block produces { hybridSearchMock } as vi.fn()
    - vi.mock('@/services/search/SearchService', () => ({ hybridSearch: hybridSearchMock }))
    - Helper: `function makeRequest(url: string, body?: object): Request` constructing a `new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })`
    - Test cases:
      1. `returns 400 with { error: 'missing_shop' } when ?shop= is missing` — call POST(makeRequest('http://localhost/api/proxy/chat')); expect status === 400; expect body.error === 'missing_shop'
      2. `returns { products: [] } without calling hybridSearch when query body is empty string` — call POST(makeRequest('http://localhost/api/proxy/chat?shop=s.myshopify.com', { query: '' })); expect hybridSearchMock not called; expect body.products === []
      3. `returns { products: [] } without calling hybridSearch when query body is whitespace-only` — same with { query: '   ' }
      4. `returns { products: [] } without calling hybridSearch when body is missing or non-JSON` — call POST with no body / malformed JSON
      5. `calls hybridSearch('shop.myshopify.com', 'shoes') and returns its result wrapped in { products }` — hybridSearchMock.mockResolvedValueOnce([{ id: '1', title: 'X', price: '$5', description: 'D' }]); call POST(makeRequest('http://localhost/api/proxy/chat?shop=shop.myshopify.com', { query: 'shoes' })); expect hybridSearchMock called with ('shop.myshopify.com', 'shoes'); expect body.products to match the mocked return
    - Header comment block: `// Phase 4 RED scaffold for EMB-07 success criterion #3 (both routes call SearchService). Implementation target: app/api/proxy/chat/route.ts (created in plan 04-04). Phase 6 will replace this stub with HMAC + streamText.`

    All three test files MUST use absolute alias paths (`@/...`), exactly match the import-path convention used in existing tests. Wave 0 success: `bun test` fails for each new file with deterministic missing-module errors. Do NOT scaffold any production files in this plan.
  </action>
  <verify>
    <automated>bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts app/api/proxy/chat/__tests__/route.test.ts 2>&amp;1 | grep -E "(Cannot find module|Module not found|failed)" | head -20</automated>
  </verify>
  <acceptance_criteria>
    - File services/search/__tests__/SearchService.test.ts EXISTS and contains the literal strings: `from '@/services/search/SearchService'`, `vi.mock('@/services/embeddings/EmbeddingService'`, `vi.mock('@/lib/db/hnsw'`, `describe('hybridSearch`
    - File services/chat/__tests__/getActiveChatModel.test.ts EXISTS and contains: `from '@/services/chat/getActiveChatModel'`, `Gemini 2.5 Flash`, `google/gemini-2.5-flash`
    - File app/api/proxy/chat/__tests__/route.test.ts EXISTS and contains: `from '@/app/api/proxy/chat/route'`, `vi.mock('@/services/search/SearchService'`, `missing_shop`
    - Command `grep -c "it(" services/search/__tests__/SearchService.test.ts` returns >= 12 (the 12 listed test cases)
    - Command `grep -c "it(" services/chat/__tests__/getActiveChatModel.test.ts` returns >= 3
    - Command `grep -c "it(" app/api/proxy/chat/__tests__/route.test.ts` returns >= 5
    - Running `bunx vitest run services/search/__tests__/SearchService.test.ts` exits non-zero with output mentioning the missing module `@/services/search/SearchService`
    - No production file `services/search/SearchService.ts` is created or modified by this task
    - No production file `services/chat/getActiveChatModel.ts` is created or modified by this task
    - No production file `app/api/proxy/chat/route.ts` is created or modified by this task
  </acceptance_criteria>
  <done>Three vitest test files exist at the listed paths, each contains the test count above, each fails on `bunx vitest run` with the expected RED state, and no production source files have been touched.</done>
</task>

<task type="auto">
  <name>Task 2: Author the route + UI test scaffolds (/api/chat route, message-parts component)</name>
  <files>app/api/chat/__tests__/route.test.ts, components/chat/__tests__/message-parts.test.tsx</files>
  <read_first>
    - app/api/shopify/sync/__tests__/route.test.ts (full file: copy the `vi.mock('@/lib/shopify/client')` block at lines 9-31, the `vi.mock('@/lib/shopify/session-storage')` block, the auth-error matrix tests at lines 62-112, the makeRequest helper at lines 50-55)
    - lib/shopify/__tests__/auth.test.ts (existing parametrized it.each block already covers the withShopifySession auth-error matrix at the helper level — we test the WIRING here, not the matrix again)
    - lib/shopify/auth.ts (verify withShopifySession ctx signature: { shop, session, req })
    - components/chat/__tests__/product-card.test.tsx (RTL render/screen/fireEvent pattern — analog for message-parts test)
    - components/chat/message-parts.tsx (current shape of MessageParts component; the test scaffolds the new prop signature including savedProductIds + onToggleSave)
    - types/product.ts (ChatProduct shape for fixtures)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md section "app/api/chat/__tests__/route.test.ts" and "components/chat/__tests__/message-parts.test.tsx"
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax" §1 (tool inputSchema NOT parameters) and §2 (tool-${name} state enum) and §Pitfalls Pitfall 1 (inputSchema rename)
    - .planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md §Copywriting Contract (tool-running pill text 'Searching your catalog…', zero-results 'No matching products', error 'Couldn\'t fetch results')
  </read_first>
  <action>
    Create two vitest files. Both files MUST be red on first run because their import targets either don't exist (chat route test imports modules from a route handler that no longer compiles after auth wrapping is added) OR the production file lacks the new code paths the test asserts (message-parts.test.tsx asserts a tool-searchCatalog switch branch that does not exist yet).

    File 1 — app/api/chat/__tests__/route.test.ts (per D-04, D-05, D-10, ADM-06):
    - Imports: `describe, it, expect, vi, beforeEach` from 'vitest'; `POST` from '@/app/api/chat/route'
    - Copy the Shopify auth mocks verbatim from app/api/shopify/sync/__tests__/route.test.ts lines 9-31 (shopifyClient.session.decodeSessionToken, getOfflineId; sessionStorage.loadSession)
    - Add three additional vi.hoisted + vi.mock blocks for chat-specific deps:
      - vi.hoisted block produces { streamTextMock, hybridSearchMock, getActiveChatModelMock } as vi.fn()
      - vi.mock('ai', async () => { const actual = await vi.importActual<typeof import('ai')>('ai'); return { ...actual, streamText: streamTextMock }; }) — preserves real `tool`, `stepCountIs`, `convertToModelMessages` so the tool definition is exercised
      - vi.mock('@/services/search/SearchService', () => ({ hybridSearch: hybridSearchMock }))
      - vi.mock('@/services/chat/getActiveChatModel', () => ({ getActiveChatModel: getActiveChatModelMock }))
    - Helper: `function makeRequest(headers: Record<string, string> = {}, body: object = { messages: [] }): Request` returning `new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })`
    - In beforeEach: vi.clearAllMocks(); set up streamTextMock to return a default `{ toUIMessageStreamResponse: () => new Response('ok') }`; set up getActiveChatModelMock to return `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`; set up the Shopify decode mock to return a payload that resolves to shop 'example-shop.myshopify.com' (mirror sync/route.test.ts happy-path setup)
    - Test cases:
      1. `returns 401 missing_token when no Authorization header` — call POST(makeRequest()); expect status 401, body.error === 'missing_token' (wrapper integration smoke)
      2. `passes the AI Gateway plain-string model 'google/gemini-2.5-flash' to streamText (NOT a provider import)` — happy-path call; extract `const streamArgs = streamTextMock.mock.calls[0][0]`; assert `streamArgs.model === 'google/gemini-2.5-flash'` and assert `typeof streamArgs.model === 'string'`
      3. `registers a tool keyed exactly 'searchCatalog' (camelCase, singular)` — assert `streamArgs.tools` has own property 'searchCatalog' and no other tool keys (per Pitfall 5 spelling lock)
      4. `the searchCatalog tool uses inputSchema (Vercel AI SDK v6), NOT parameters (v5)` — assert `streamArgs.tools.searchCatalog.inputSchema` is defined (truthy); assert `streamArgs.tools.searchCatalog.parameters` is undefined (per Pitfall 1 and RESEARCH.md State of the Art row 1)
      5. `tool execute closure forwards shop from withShopifySession context (NOT from LLM args)` — invoke `await streamArgs.tools.searchCatalog.execute({ query: 'shoes', priceMax: 100 }, { toolCallId: 't1', messages: [], abortSignal: new AbortController().signal })`; assert hybridSearchMock called once with ('example-shop.myshopify.com', 'shoes', { priceMin: undefined, priceMax: 100 })
      6. `tool execute forwards both priceMin and priceMax when present` — same with { query: 'q', priceMin: 10, priceMax: 50 }
      7. `tool execute forwards undefined priceMin/priceMax when not present in tool args` — call with { query: 'q' }; expect hybridSearchMock called with ('example-shop.myshopify.com', 'q', { priceMin: undefined, priceMax: undefined })
      8. `system prompt contains the shop name (steers the LLM per D-04)` — assert `typeof streamArgs.system === 'string'` and `streamArgs.system.includes('example-shop.myshopify.com')`
      9. `system prompt instructs the LLM to call searchCatalog before recommending products` — assert streamArgs.system matches /searchCatalog/i AND matches /(always|before recommending)/i
      10. `getActiveChatModel is called with shop from session context` — assert getActiveChatModelMock called with 'example-shop.myshopify.com'
      11. `stopWhen is set (single tool round-trip with safety margin, per RESEARCH.md Open Question 5)` — assert streamArgs.stopWhen is defined (a function from stepCountIs)
      12. `tool inputSchema accepts query (1-500 chars), priceMin?, priceMax? — Zod validation contract` — extract the Zod schema; use `safeParse` to verify: `{ query: 'shoes', priceMax: 100 }` parses successfully; `{ query: '' }` fails (min(1)); `{ query: 'a'.repeat(501) }` fails (max(500)); `{ priceMin: 10 }` fails (query required); `{ query: 'q', priceMin: 'not-a-number' }` fails (z.number())
      13. `returns the streamText().toUIMessageStreamResponse() result as the handler response` — assert the response constructed is the same instance returned by the mocked toUIMessageStreamResponse
    - Header comment block: `// Phase 4 RED scaffold for ADM-06 / D-04, D-05, D-10. Implementation target: app/api/chat/route.ts (rewritten in plan 04-03).`

    File 2 — components/chat/__tests__/message-parts.test.tsx (per D-06, ADM-06, UI-SPEC.md Locked Discretion Resolutions):
    - Imports: `describe, it, expect, vi` from 'vitest'; `render, screen` from '@testing-library/react'; `MessageParts` from '@/components/chat/message-parts'; `type { ChatProduct }` from '@/types/product'; `type { UIMessage }` from 'ai'
    - Fixture: `const sampleProducts: ChatProduct[] = [{ id: '1', title: 'Test Sneakers', price: '$89.00 – $129.00', description: 'A test product.' }]`
    - Helper: `function renderParts(parts: unknown[])` invoking `render(<MessageParts parts={parts as UIMessage['parts']} messageId="m1" savedProductIds={new Set()} onToggleSave={vi.fn()} />)`. Note the helper uses `unknown[]` and casts because the test parts are constructed as plain objects (tool-part runtime shape).
    - Test cases:
      1. `renders 'Searching your catalog…' inline pill when part.state === 'input-streaming'` — renderParts([{ type: 'tool-searchCatalog', state: 'input-streaming', input: { query: 'shoes' }, toolCallId: 't1' }]); assert `screen.getByRole('status')` text matches /Searching your catalog/i
      2. `renders 'Searching your catalog…' inline pill when part.state === 'input-available'` — same with 'input-available'
      3. `renders ProductCard <ul role="list"> when state === 'output-available' with products[].length > 0` — renderParts([{ type: 'tool-searchCatalog', state: 'output-available', output: sampleProducts, input: {}, toolCallId: 't1' }]); assert `screen.getByRole('list')` exists; assert it has attribute `aria-label="1 matching products"`; assert text 'Test Sneakers' is in document
      4. `renders zero-results affordance when state === 'output-available' with empty output` — renderParts([{ type: 'tool-searchCatalog', state: 'output-available', output: [], input: {}, toolCallId: 't1' }]); assert text 'No matching products' is in document; assert text matches /broader description|remove the price filter/i
      5. `renders quiet error affordance when state === 'output-error'` — renderParts([{ type: 'tool-searchCatalog', state: 'output-error', errorText: 'boom', input: {}, toolCallId: 't1' }]); assert text matches /Couldn(?:'|&apos;)t fetch results/i; assert text matches /try that search again/i
      6. `the ProductCard grid <ul> uses role="list" and aria-live="polite" (a11y from UI-SPEC.md)` — same as test 3, additionally assert the `<ul>` has attribute aria-live="polite"
      7. `the tool-running pill uses role="status" (a11y from UI-SPEC.md)` — same setup as test 1, assert the element with the pill text has role="status"
      8. `clicking the heart on a product card invokes onToggleSave with the product` — `const onToggleSave = vi.fn(); render(<MessageParts parts={[{ type: 'tool-searchCatalog', state: 'output-available', output: sampleProducts, input: {}, toolCallId: 't1' } as unknown as UIMessage['parts'][number]]} messageId="m1" savedProductIds={new Set()} onToggleSave={onToggleSave} />); fireEvent.click(screen.getByRole('button', { name: /save product/i })); expect(onToggleSave).toHaveBeenCalledWith(sampleProducts[0]);` — also import `fireEvent` from @testing-library/react
      9. `does not render anything for tool-searchCatalog parts with unknown state` — renderParts with state='approval-requested' or some unknown string; assert no matching products, no spinner, no error affordance is rendered
      10. `still renders text parts unchanged (regression check)` — renderParts([{ type: 'text', text: 'hello world' }]); assert 'hello world' is in document
    - Header comment block: `// Phase 4 RED scaffold for D-06 / ADM-06. Implementation target: components/chat/message-parts.tsx (extended in plan 04-05). Until 04-05 lands, the tool-searchCatalog switch branch does not exist; these tests fail by finding no matching elements in the DOM.`

    Both files use the existing vitest + jsdom + RTL infra. No new framework install. Do NOT create or modify production source files in this plan.
  </action>
  <verify>
    <automated>bunx vitest run app/api/chat/__tests__/route.test.ts components/chat/__tests__/message-parts.test.tsx 2>&amp;1 | grep -E "(failed|FAIL|Cannot find|no matching)" | head -10</automated>
  </verify>
  <acceptance_criteria>
    - File app/api/chat/__tests__/route.test.ts EXISTS and contains the literal strings: `from '@/app/api/chat/route'`, `vi.mock('@/services/search/SearchService'`, `vi.mock('@/services/chat/getActiveChatModel'`, `inputSchema`, `parameters`, `google/gemini-2.5-flash`, `example-shop.myshopify.com`, `searchCatalog`
    - File components/chat/__tests__/message-parts.test.tsx EXISTS and contains: `from '@/components/chat/message-parts'`, `tool-searchCatalog`, `Searching your catalog`, `No matching products`, `aria-label="1 matching products"`, `savedProductIds`, `onToggleSave`
    - Command `grep -c "it(" app/api/chat/__tests__/route.test.ts` returns >= 13
    - Command `grep -c "it(" components/chat/__tests__/message-parts.test.tsx` returns >= 10
    - Running `bunx vitest run app/api/chat/__tests__/route.test.ts` exits non-zero (the current /api/chat/route.ts does not export a `withShopifySession`-wrapped POST nor does it call `streamText` with `tools`, so multiple assertions fail; this is the deterministic RED state)
    - Running `bunx vitest run components/chat/__tests__/message-parts.test.tsx` exits non-zero (the current message-parts.tsx has no tool-searchCatalog branch and the prop signature does not include `savedProductIds` or `onToggleSave`; TS or assertion failures expected)
    - No production source files are modified by this task (`git diff --stat app/api/chat/route.ts components/chat/message-parts.tsx` shows no changes)
  </acceptance_criteria>
  <done>Two vitest test files exist at the listed paths, each contains the test count above, each fails on `bunx vitest run` with the expected RED state, and no production source files have been touched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test files → CI runner | test files run in vitest sandbox; no network, no FS writes outside test scope |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | Test scaffold accidentally green | mitigate | Tests MUST fail on first run; acceptance criteria assert `bunx vitest run` exits non-zero. A green Wave 0 means the contract was not actually red — fail the plan in that case. |
| T-04-02 | Information Disclosure | Test fixture contains real shop secrets | mitigate | All shop names use synthetic `*.myshopify.com` placeholders (`example-shop`, `shop-a`, `shop-b`); no real shop tokens, API keys, or session payloads appear in test files. |
| T-04-03 | Repudiation | Wave 0 test count later drifts down | mitigate | Acceptance criteria pin specific `grep -c "it("` minimum counts per file. Future plans cannot delete tests without bumping the contract here. |
</threat_model>

<verification>
After both tasks complete:
1. All 5 new test files exist at their canonical paths.
2. `bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts app/api/chat/__tests__/route.test.ts app/api/proxy/chat/__tests__/route.test.ts components/chat/__tests__/message-parts.test.tsx` exits non-zero.
3. `git diff --stat services/ app/api/ components/chat/message-parts.tsx components/chat/chat.tsx` shows only the five new `__tests__/*.test.{ts,tsx}` files; no production sources modified.
4. Total Phase 4 test cases added: >= 12 + 3 + 13 + 5 + 10 = 43 new `it()` blocks across the five files.
</verification>

<success_criteria>
- Five test files exist at canonical paths
- Each file's first run reports a deterministic failure (missing module or unimplemented behavior)
- No production source files have been created or modified
- All test files use the analog patterns from Phase 1–3 (vi.hoisted + vi.mock + alias imports)
- Subsequent waves (04-02, 04-03, 04-04, 04-05) implement the production files; once they land, the same vitest commands MUST go green.
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-01-SUMMARY.md` when done. Summary includes: count of new `it()` blocks per file, sample of one failing test output (truncated to 5 lines), confirmation that no production files were modified.
</output>
</content>
</invoke>