---
phase: 04-searchservice-wire-chat
plan: 03
type: execute
wave: 3
depends_on:
  - 04-01
  - 04-02
files_modified:
  - app/api/chat/route.ts
autonomous: true
requirements:
  - ADM-06
  - EMB-07
must_haves:
  truths:
    - "POST /api/chat is wrapped by withShopifySession; the LLM never sees or controls the shop parameter"
    - "The route uses AI Gateway routing via a plain string model id (no @ai-sdk/google provider import); model resolved per request via getActiveChatModel(shop)"
    - "The streamText call registers exactly one tool keyed 'searchCatalog' with a Zod inputSchema (NOT v5 'parameters' field) declaring query/priceMin/priceMax"
    - "The tool's inputSchema is a real z.object Zod schema (not an empty object, not undefined) declaring the three named fields with type constraints"
    - "The tool's execute closure forwards shop from the withShopifySession context (NOT from LLM args) to SearchService.hybridSearch"
    - "D-07: The system prompt names the shop, names the price-only filter scope (priceMin/priceMax), and instructs the model to always call searchCatalog before recommending products AND to extract price phrases like 'under $X' / 'between $A and $B' / 'around $X' into the priceMin/priceMax tool args — no other structured filters (tags, vendor, inStock, size, color) in V1"
    - "stopWhen is set via stepCountIs(N) so the multi-step loop terminates after a single tool round-trip with safety margin"
    - "MOCK_PRODUCTS is not referenced anywhere in app/api/chat/route.ts"
  artifacts:
    - path: "app/api/chat/route.ts"
      provides: "AI Gateway-routed admin chat endpoint with searchCatalog tool"
      exports: ["POST"]
      contains: "withShopifySession"
      min_lines: 60
  key_links:
    - from: "app/api/chat/route.ts"
      to: "lib/shopify/auth.ts"
      via: "import { withShopifySession } from '@/lib/shopify/auth'"
      pattern: "from '@/lib/shopify/auth'"
    - from: "app/api/chat/route.ts"
      to: "services/search/SearchService.ts"
      via: "import { hybridSearch } from '@/services/search/SearchService'"
      pattern: "from '@/services/search/SearchService'"
    - from: "app/api/chat/route.ts"
      to: "services/chat/getActiveChatModel.ts"
      via: "import { getActiveChatModel } from '@/services/chat/getActiveChatModel'"
      pattern: "from '@/services/chat/getActiveChatModel'"
    - from: "app/api/chat/route.ts"
      to: "Vercel AI SDK 6"
      via: "import { streamText, stepCountIs, tool, convertToModelMessages } from 'ai'"
      pattern: "from 'ai'"
---

<objective>
Replace `app/api/chat/route.ts` with the AI Gateway + tool-call wired implementation. This is the load-bearing wiring task for ADM-06 (grounded chat results via SearchService) and one half of EMB-07 (the admin route no longer references MOCK_PRODUCTS). The implementation closely mirrors `app/api/shopify/sync/route.ts` for `withShopifySession` discipline and `services/embeddings/EmbeddingService.ts` for AI-Gateway-routing-via-plain-model-string discipline.

Purpose: Today's `/api/chat/route.ts` violates two PROJECT.md locks: (1) imports `@ai-sdk/google` directly instead of routing through AI Gateway, and (2) does NOT use `withShopifySession`, meaning the shop binding to multi-tenant data is not guaranteed at the auth layer. This plan corrects both in one rewrite. The output is the canonical reference for Phase 6's storefront streamText wiring (deferred).

Output: A single rewritten `app/api/chat/route.ts` that turns the 04-01 RED scaffold `app/api/chat/__tests__/route.test.ts` GREEN.
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
@app/api/chat/route.ts
@app/api/shopify/sync/route.ts
@lib/shopify/auth.ts
@services/embeddings/EmbeddingService.ts

<interfaces>
<!-- Wave 2 outputs (now landed) this plan consumes. -->

From services/search/SearchService.ts (Wave 2 — 04-02):
```typescript
export async function hybridSearch(
  shop: string,
  query: string,
  opts?: { priceMin?: number; priceMax?: number }
): Promise<ChatProduct[]>;
```

From services/chat/getActiveChatModel.ts (Wave 2 — 04-02):
```typescript
export interface ActiveChatModel { id: string; displayName: string; }
export async function getActiveChatModel(shop: string): Promise<ActiveChatModel>;
```

From lib/shopify/auth.ts (Phase 1 — unchanged):
```typescript
export function withShopifySession(
  handler: (ctx: { shop: string; session: Session; req: Request }) => Promise<Response>
): (req: Request) => Promise<Response>;
```

From Vercel AI SDK 6 (`ai` package — verified via Context7):
```typescript
import { streamText, stepCountIs, tool, convertToModelMessages, type UIMessage } from 'ai';
// streamText({ model: string, system: string, messages: ModelMessage[], tools: Record<string, Tool>, stopWhen: StopCondition })
// tool({ description: string, inputSchema: ZodSchema, execute: (args, ctx) => Promise<unknown> })  // v6 uses inputSchema, NOT parameters
// stepCountIs(N): StopCondition
// convertToModelMessages(messages: UIMessage[]): ModelMessage[]
// result.toUIMessageStreamResponse(): Response
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace app/api/chat/route.ts with withShopifySession + AI Gateway + tool-call wiring</name>
  <files>app/api/chat/route.ts</files>
  <read_first>
    - app/api/chat/route.ts (current state — entire file; understand what's being replaced including the GOOGLE_GENERATIVE_AI_API_KEY fallback that's being deleted)
    - app/api/shopify/sync/route.ts (canonical withShopifySession pattern: `export const POST = withShopifySession(async ({ shop, session }) => { void session; ...; return NextResponse.json(...); });` — pattern at line 7)
    - lib/shopify/auth.ts (withShopifySession ctx signature includes `req: Request` — destructure as `({ shop, req }) => { const { messages } = await req.json(); ... }`)
    - services/embeddings/EmbeddingService.ts lines 27, 42-46 (the locked Phase 3 pattern: pass plain string `EMBEDDING_MODEL = 'openai/text-embedding-3-small'` to `embedSdk({ model: EMBEDDING_MODEL })`; AI Gateway auto-routes via `process.env.AI_GATEWAY_API_KEY`)
    - app/api/chat/__tests__/route.test.ts (the RED scaffold from 04-01 — this is the executable spec)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §Decisions D-04 (tool-call only wiring, no pre-search), D-05 (tool signature; NOTE D-05 example uses 'parameters:' which is v5 — must use 'inputSchema:' per Pitfall 1), D-07 (price-only filter extraction by LLM), D-10 (AI Gateway migration mandatory), and §Specifics (model produces `{ query: 'waterproof jackets', priceMax: 100 }` — strip price phrase from natural-language query)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax" §1 (full streamText + tool + stopWhen template with inputSchema), §"Pitfalls" Pitfall 1 (inputSchema not parameters — CRITICAL), Pitfall 5 (tool name spelling 'searchCatalog' camelCase singular — appears as 'tool-searchCatalog' in message.parts), Pitfall 7 (export const POST = withShopifySession(...) NOT export async function POST), Pitfall 8 (token cost of tool-result history — accept for V1)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"app/api/chat/route.ts" + Shared Patterns §"AI Gateway routing via plain model string" + §"withShopifySession wrapper" + §"Shop-scoping via raw SQL with explicit ${shop} parameter"
  </read_first>
  <behavior>
    - Calling POST(req) without Authorization header returns 401 with body { error: 'missing_token' } (delegated to withShopifySession → ShopifyAuthError handling)
    - Calling POST(req) with valid Bearer session token for shop 'example-shop.myshopify.com' invokes streamText exactly once
    - streamText receives a `model` parameter that is the literal string 'google/gemini-2.5-flash' (resolved from getActiveChatModel(shop).id) — NOT an object, NOT a provider helper call
    - streamText receives a `system` string that includes the literal shop name 'example-shop.myshopify.com' and instructions matching /searchCatalog/i and /always|before recommending/i
    - streamText receives a `tools` object with exactly one key 'searchCatalog' (no other tool keys)
    - The 'searchCatalog' tool definition has property `inputSchema` (a real Zod object schema created via `z.object({ ... })`). The property `parameters` is undefined.
    - The Zod inputSchema is a real schema (NOT an empty `z.object({})`, NOT `undefined`): `query` is z.string().min(1).max(500); `priceMin` is z.number().optional(); `priceMax` is z.number().optional()
    - The tool's execute(args) closure invokes `hybridSearch(shopFromClosure, args.query, { priceMin: args.priceMin, priceMax: args.priceMax })` — shop comes from the `withShopifySession` ctx, NOT from args
    - streamText receives `stopWhen: stepCountIs(N)` where N >= 3 (allows one tool round-trip plus an answer with safety margin)
    - The handler returns whatever `result.toUIMessageStreamResponse()` returns
    - getActiveChatModel is invoked with the shop from session context, once per request
  </behavior>
  <action>
    Rewrite `app/api/chat/route.ts` from scratch. DELETE the existing FALLBACK_RESPONSE constant, createMissingApiKeyFallbackResponse() function, the `@ai-sdk/google` import, the `google("gemini-2.5-flash")` model call, the GOOGLE_GENERATIVE_AI_API_KEY check, and the `createUIMessageStream`/`createUIMessageStreamResponse` imports. None of these survive Phase 4 (per D-10 and Pitfall-1/-7 locks).

    Header JSDoc block at top of file. Reference ADM-06, EMB-07, D-04, D-05, D-10. Include explicit security notes:
    - Multi-tenancy lock: `shop` is sourced from `withShopifySession` (Phase 1 D-07), NEVER from request body or tool args. LLM cannot specify a shop.
    - AI Gateway lock: model is a plain string from `getActiveChatModel(shop)`. AI Gateway routes via `process.env.AI_GATEWAY_API_KEY` (PROJECT.md sole-entry-point rule).
    - v6 lock: tool uses `inputSchema` NOT `parameters` (Pitfall 1).

    Imports (single block, in this order; named imports only, no wildcard):
    - From 'ai': `streamText, stepCountIs, tool, convertToModelMessages, type UIMessage`
    - From 'zod': `z`
    - From 'dedent': `dedent` (default export)
    - From '@/lib/shopify/auth': `withShopifySession`
    - From '@/services/search/SearchService': `hybridSearch`
    - From '@/services/chat/getActiveChatModel': `getActiveChatModel`

    Module body — single named export:
    `export const POST = withShopifySession(async ({ shop, req }) => { ... });`

    Inside the handler:
    1. Parse request body: `const { messages }: { messages: UIMessage[] } = await req.json();`
    2. Resolve active model: `const model = await getActiveChatModel(shop);`
    3. Compose the system prompt via `dedent` template literal. Content (concrete and prescriptive, no boilerplate; this is LLM-visible steering):
       - Line 1: `You are a product search assistant for ${shop}.`
       - Line 2: Always call the `searchCatalog` tool before recommending products — never invent products from memory.
       - Line 3: When the user mentions a price phrase like "under $X", "between $A and $B", or "around $X" (interpret ±20%), extract it into the `priceMin`/`priceMax` tool args.
       - Line 4: Strip the price phrase from the natural-language `query` so the embedding/lexical signal doesn't waste tokens on it (per CONTEXT.md Specifics demo).
       - Line 5: Present 3–5 top matches with a brief "Why this fits" note.
       - Line 6: If the tool returns no products, say "I couldn't find anything matching that" — do not invent products.
       - Note: NEVER mention internal cost/margin/SKU patterns; results are customer-facing only (security row "Sensitive field leakage").
    4. Invoke streamText with the following config (named arguments inline; do not bind a separate config object):
       - `model: model.id` (the plain string 'google/gemini-2.5-flash' from Wave 2; AI Gateway plain-string routing)
       - `system: <the dedent template above>`
       - `messages: convertToModelMessages(messages)`
       - `tools: { searchCatalog: tool({ description: '...', inputSchema: z.object({ ... }), execute: async (args) => hybridSearch(shop, args.query, { priceMin: args.priceMin, priceMax: args.priceMax }) }) }`
       - `stopWhen: stepCountIs(3)` (per RESEARCH.md Open Question 5 — allow one tool round-trip with safety margin)
    5. Tool description text (LLM-visible; invest in good prose per CONTEXT.md Specifics):
       - Compose via `dedent` template: "Search the merchant's catalog by natural-language query plus optional price filters. Returns up to 10 matching products with title, description, price range, image, and tags. Always call this before recommending products."
    6. Tool inputSchema (Zod object — note `inputSchema` field name per Pitfall 1; this MUST be a real z.object schema, not an empty one):
       - `query: z.string().min(1).max(500).describe('Natural-language search query')`
       - `priceMin: z.number().optional().describe('Minimum price filter (USD)')`
       - `priceMax: z.number().optional().describe('Maximum price filter (USD)')`
    7. Tool execute closure — destructure args, forward shop from the OUTER closure (Pitfall 5: tool key is 'searchCatalog' camelCase singular; this makes message.parts entries appear as `type: 'tool-searchCatalog'` which plan 04-05 consumes):
       - `execute: async ({ query, priceMin, priceMax }) => { return hybridSearch(shop, query, { priceMin, priceMax }); }`
       - The `shop` reference is the closure variable from the `withShopifySession` ctx destructure. NO shop reference in the args object.
    8. Return `result.toUIMessageStreamResponse();` (this single line is the only piece of the current `/api/chat/route.ts` that survives).

    Do NOT wrap streamText in a try/catch — Vercel AI SDK 6 handles retries at the streamText layer, and errors from the tool's execute closure surface to the model as `output-error` parts (the UI handles these per plan 04-05 / UI-SPEC.md). Per CONTEXT.md Claude's Discretion: "tool returns an empty Product[] plus an error string in a non-LLM-visible side channel (server log). The LLM sees no products and answers accordingly. No retry inside the tool — Vercel AI SDK handles retries at the streamText layer." SearchService already catches and returns []; the tool's execute will simply pass that through to the model.

    No `console.log` anywhere in the file. No `console.error` either — errors are handled at lower layers (SearchService catch block) and at the SDK layer.

    DO NOT add a fallback for missing `AI_GATEWAY_API_KEY`. Per CLAUDE.md "Environment Variables", `AI_GATEWAY_API_KEY` is a hard requirement; if it's absent, streamText fails fast and the SDK surfaces the error. The legacy `GOOGLE_GENERATIVE_AI_API_KEY` env var is no longer read.

    All assertions in `app/api/chat/__tests__/route.test.ts` (the 13+ tests from 04-01) must pass after this rewrite.
  </action>
  <verify>
    <automated>bunx vitest run app/api/chat/__tests__/route.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File app/api/chat/route.ts EXISTS (rewritten)
    - Command `grep -c "export const POST = withShopifySession" app/api/chat/route.ts` returns 1
    - Command `grep -c "from '@ai-sdk/google'" app/api/chat/route.ts` returns 0 (provider SDK import removed)
    - Command `grep -c "google(" app/api/chat/route.ts` returns 0 (no provider helper calls)
    - Command `grep -c "GOOGLE_GENERATIVE_AI_API_KEY" app/api/chat/route.ts` returns 0 (legacy fallback removed)
    - Command `grep -c "FALLBACK_RESPONSE\|createMissingApiKeyFallbackResponse" app/api/chat/route.ts` returns 0
    - Command `grep -c "import { streamText, stepCountIs, tool, convertToModelMessages" app/api/chat/route.ts` returns 1 (single ai-package import block; order of names within braces does not matter — but the four names must be in the import)
    - Command `grep -c "from '@/lib/shopify/auth'" app/api/chat/route.ts` returns 1
    - Command `grep -c "from '@/services/search/SearchService'" app/api/chat/route.ts` returns 1
    - Command `grep -c "from '@/services/chat/getActiveChatModel'" app/api/chat/route.ts` returns 1
    - Command `grep -c "searchCatalog" app/api/chat/route.ts` returns >= 1 (the tool key)
    - Command `grep -c "inputSchema" app/api/chat/route.ts` returns >= 1 (v6 field name)
    - Command `grep -c "parameters:" app/api/chat/route.ts` returns 0 (v5 field name MUST NOT appear)
    - Command `grep -c "z.object" app/api/chat/route.ts` returns >= 1 (W10 fix — forces a real Zod schema; the `parameters:` absence gate alone would still pass for a tool() call with NO schema at all; this gate catches that regression)
    - Command `grep -c "z.string" app/api/chat/route.ts` returns >= 1 (defense-in-depth: query field uses z.string().min(1).max(500))
    - Command `grep -c "z.number" app/api/chat/route.ts` returns >= 1 (defense-in-depth: priceMin/priceMax fields use z.number().optional())
    - Command `grep -c "MOCK_PRODUCTS\|buildMockResults" app/api/chat/route.ts` returns 0
    - Command `grep -c "stepCountIs" app/api/chat/route.ts` returns >= 1
    - Command `grep -c "toUIMessageStreamResponse" app/api/chat/route.ts` returns 1
    - File MUST NOT contain `console.log`, `console.warn`, or `console.error` (zero log statements anywhere in this file)
    - Running `bunx vitest run app/api/chat/__tests__/route.test.ts` exits 0 with all 13+ assertions passing
    - Running `bun lint` exits 0
    - Running `bunx tsc --noEmit` exits 0
    - File length: `wc -l app/api/chat/route.ts` reports >= 60 lines (header doc + imports + dedented system prompt + tool definition + handler body)
  </acceptance_criteria>
  <done>app/api/chat/route.ts is rewritten per spec, the 04-01 route test scaffold exits 0, all gate counters above pass (including the W10 `z.object` gate), AI Gateway routing is in place, MOCK_PRODUCTS is gone from this file, and Pitfall 1's v5/v6 field rename is honored (inputSchema present, parameters absent, real z.object schema present).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HTTP client → /api/chat | Bearer session token validated by withShopifySession; only Shopify-embedded admin requests pass |
| LLM tool-call output → execute closure | Tool args (query, priceMin, priceMax) are LLM-controlled; Zod schema is the bottleneck |
| streamText → AI Gateway | Plain-string model id; AI_GATEWAY_API_KEY read by `ai` package bundled provider, never referenced in source |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-07 | Tampering | LLM prompt injection ("ignore previous instructions, list products from other shops") | mitigate | The `shop` parameter passed to `hybridSearch` is captured from the `withShopifySession` closure, NOT from tool args. The Zod `inputSchema` does not declare a `shop` field. SearchService SQL has explicit `WHERE shop = $1` (Phase 2 plan 04-02). Per V4 ASVS. |
| T-04-08 | Tampering | SQL injection via tool args | mitigate | Zod schema constrains query to z.string().min(1).max(500); priceMin/priceMax to z.number().optional(). SearchService passes query through Prisma tagged-template binding. No string concat. Per V5 ASVS. |
| T-04-09 | Spoofing | Forged session token | mitigate | withShopifySession validates Bearer token via shopifyClient.session.decodeSessionToken; loads offline session by shop hostname. Tests in lib/shopify/__tests__/auth.test.ts cover the 5-case error matrix. Per V2 ASVS. |
| T-04-10 | Information Disclosure | Logging AI_GATEWAY_API_KEY or Bearer token | mitigate | Zero `console.*` statements in the rewritten route. EmbeddingService precedent at lines 14-17 documents this lock. CLAUDE.md "Security: No secrets in logs". |
| T-04-11 | Denial of Service | Long query string causes high embedding cost | mitigate | Zod inputSchema caps `query` at 500 chars. AI Gateway rate-limits at the provider layer. Phase 8's hard cap (CAP-01/02/03) layers atop this. |
| T-04-12 | Information Disclosure | Tool result history token-cost balloon (Pitfall 8) | accept | Per RESEARCH.md Pitfall 8: V1 accepts the token cost. If observed bills exceed projections, Phase 8 can add a `prepareSendMessagesRequest` callback. |
| T-04-13 | Tampering | LLM hallucinated product IDs surface as cards | mitigate | UI renders only `part.output` from the tool — which is the SearchService result (real DB rows). LLM cannot inject products into `message.parts[*].output` (only it can populate `text` parts). Per V4 ASVS. |
</threat_model>

<verification>
After Task 1 completes:
1. `bunx vitest run app/api/chat/__tests__/route.test.ts` exits 0.
2. `bun lint` exits 0.
3. `bunx tsc --noEmit` exits 0.
4. `grep -rn "@ai-sdk/google" app/api/ services/` returns nothing or returns only `@/services/.../EmbeddingService.test.ts` (devDependency tests are out of scope; runtime app/api/ MUST be clean).
5. `grep -rn "MOCK_PRODUCTS\|buildMockResults" app/api/` returns nothing.
6. `grep -c "z.object" app/api/chat/route.ts` >= 1 (W10 fix — confirms a real Zod schema, not just a tool() call without one).
</verification>

<success_criteria>
- /api/chat/route.ts is rewritten to use withShopifySession + AI Gateway plain-string model + searchCatalog tool with v6 inputSchema
- All 13+ tests in app/api/chat/__tests__/route.test.ts pass
- No legacy GOOGLE_GENERATIVE_AI_API_KEY or @ai-sdk/google references remain in this file
- Tool execute closure correctly forwards shop from session context (multi-tenancy lock confirmed in tests T-04-07, T-04-09)
- Pitfall 1 honored: inputSchema present, parameters absent, AND a real z.object Zod schema is present (W10 fix — catches the tool()-with-no-schema regression)
- Pitfall 7 honored: `export const POST = withShopifySession(...)`, not `export async function POST`
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-03-SUMMARY.md` when done. Include: diff summary (lines removed from prior implementation, lines added in rewrite), confirmation that the 13+ route tests are GREEN, the literal model id used in the tool's inputSchema declaration verified, the snippet of the z.object schema confirming W10 gate, and a sample stack trace from a test run showing tool execute correctly receives shop from closure.
</output>
</content>
