---
phase: 04-searchservice-wire-chat
plan: 04
type: execute
wave: 3
depends_on:
  - 04-01
  - 04-02
files_modified:
  - app/api/proxy/chat/route.ts
autonomous: true
requirements:
  - EMB-07
must_haves:
  truths:
    - "POST /api/proxy/chat exists as a route handler that calls SearchService.hybridSearch"
    - "The stub returns 400 when ?shop= is missing (does not trust client-supplied shop without verification — Phase 6 will add HMAC)"
    - "Empty/whitespace queries return { products: [] } without calling SearchService"
    - "A valid (shop, query) pair returns the SearchService result wrapped as { products: ChatProduct[] }"
    - "The file carries a prominent TODO marker declaring this is a Phase 4 stub and Phase 6 owns the real HMAC+identity+streamText wiring"
    - "The stub does NOT use withShopifySession (App Proxy uses HMAC, not Bearer; this is intentionally different from /api/chat)"
  artifacts:
    - path: "app/api/proxy/chat/route.ts"
      provides: "Storefront chat stub satisfying EMB-07 success criterion #3"
      exports: ["POST"]
      contains: "TODO(Phase 6)"
      min_lines: 30
  key_links:
    - from: "app/api/proxy/chat/route.ts"
      to: "services/search/SearchService.ts"
      via: "import { hybridSearch } from '@/services/search/SearchService'"
      pattern: "from '@/services/search/SearchService'"
---

<objective>
Ship the storefront-side stub route `app/api/proxy/chat/route.ts` that calls `SearchService.hybridSearch` and returns JSON. This single file is the load-bearing artifact for EMB-07 success criterion #3: "both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call `SearchService.hybridSearch`". Without this file, the success criterion fails the verification gate even though the runtime never invokes this route (Phase 6 replaces it).

Purpose: Make EMB-07 provable at the source level today. Phase 6 will replace the body with the real HMAC-verified streaming chat; this plan ships only the contract: shape + dependency + TODO marker pointing at the Phase 6 work.

Output: A single new file `app/api/proxy/chat/route.ts` with a prominent TODO header, basic input validation, and a single call to `hybridSearch`. Turns the 04-01 RED scaffold `app/api/proxy/chat/__tests__/route.test.ts` GREEN.
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
@app/api/shopify/sync/route.ts

<interfaces>
<!-- Wave 2 output this plan consumes. -->

From services/search/SearchService.ts (Wave 2 — 04-02):
```typescript
export async function hybridSearch(
  shop: string,
  query: string,
  opts?: { priceMin?: number; priceMax?: number }
): Promise<ChatProduct[]>;
```

Web Fetch API surface used (Next.js 16 App Router native Request/Response):
- `new URL(req.url)` for query-param parsing
- `req.json()` for body parsing (must wrap in try/catch — body may be missing or malformed)
- `Response.json(body, init?)` for the response (Web-API form, simpler than NextResponse here)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create app/api/proxy/chat/route.ts as the Phase 4 stub calling SearchService.hybridSearch</name>
  <files>app/api/proxy/chat/route.ts</files>
  <read_first>
    - app/api/shopify/sync/route.ts (existing route handler pattern; the proxy stub does NOT use withShopifySession but the file shape/exports are analogous)
    - app/api/proxy/chat/__tests__/route.test.ts (the RED scaffold from 04-01 — the 5 test cases are the executable spec)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §domain item 6 (Phase 4 ships only the route file with a TODO marker so EMB-07 is provable today)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax" §7 (full stub template), §"File Plan" entry for `app/api/proxy/chat/route.ts`
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"app/api/proxy/chat/route.ts"
    - .planning/REQUIREMENTS.md EMB-07 + ROADMAP Phase 4 Success Criterion #3 (the literal text: "Both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call `SearchService.hybridSearch`")
  </read_first>
  <behavior>
    - POST /api/proxy/chat without ?shop= returns 400 with body { error: 'missing_shop' }
    - POST /api/proxy/chat?shop=s.myshopify.com with body `{ query: '' }` returns 200 with body `{ products: [] }` and DOES NOT call hybridSearch
    - POST /api/proxy/chat?shop=s.myshopify.com with body `{ query: '   ' }` returns `{ products: [] }` (whitespace short-circuit)
    - POST /api/proxy/chat?shop=s.myshopify.com with no body or malformed JSON returns `{ products: [] }` (the json() catch defaults to empty object → empty query → short-circuit)
    - POST /api/proxy/chat?shop=shop.myshopify.com with body `{ query: 'shoes' }` calls `hybridSearch('shop.myshopify.com', 'shoes')` exactly once and returns 200 with `{ products: <result> }`
  </behavior>
  <action>
    Create the new file `app/api/proxy/chat/route.ts` per RESEARCH.md §7 template. The file has three parts: header doc-block declaring stub status, imports, and a single POST handler.

    Header JSDoc block (long-form; this is the source-of-truth marker that prevents anyone from accidentally treating this as production storefront code):
    - Title: "Storefront chat endpoint — Phase 4 STUB."
    - Paragraph: Phase 4 ships only enough surface to satisfy EMB-07's "both routes call SearchService" success criterion. Real HMAC verification and visitor identity wiring belong to Phase 6.
    - TODO block listing what Phase 6 must add (so an executor in Phase 6 sees this list):
      1. App Proxy HMAC validation via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` (per STR-04 requirement)
      2. Anonymous visitor identity resolution from `visitor_id` (IDN-01: localStorage-passed, NOT cookie because App Proxy strips Set-Cookie per PROJECT.md "Storefront identity")
      3. Replace this JSON response with `streamText({ tools: { searchCatalog } })` using the same tool as `/api/chat`, sharing the chat-ui components extracted in Phase 5
      4. Verify per-shop hard cap (CAP-02) before invoking AI Gateway
    - Warning line: "DO NOT use this endpoint from production storefront drawer code until Phase 6."
    - Cross-reference: see `app/api/chat/route.ts` for the canonical pattern that Phase 6 will mirror here.

    Imports:
    - `import { hybridSearch } from '@/services/search/SearchService';`

    Exports — single POST handler in Next.js 16 App Router shape:
    - `export async function POST(req: Request): Promise<Response> { ... }`

    Handler body steps:
    1. Add inline `// TODO(Phase 6):` comment above this line: "Replace this stub with HMAC verification + streamText wiring (see header)."
    2. Parse query params: `const url = new URL(req.url); const shop = url.searchParams.get('shop');`
    3. Guard missing shop: `if (!shop) return Response.json({ error: 'missing_shop' }, { status: 400 });` — Phase 6 must replace this with `validateHmac`; today we treat the parameter as untrusted and fail-closed without crashing. Add a comment: "// Phase 4: ?shop= is UNTRUSTED here. Phase 6 will verify HMAC signature."
    4. Parse body with defensive fallback: `const body = await req.json().catch(() => ({})) as { query?: string };`
    5. Trim query and short-circuit: `const query = (body.query ?? '').trim(); if (!query) return Response.json({ products: [] });` (Mirrors SearchService.hybridSearch empty-query semantics — avoids an AI Gateway call for empty input.)
    6. Invoke SearchService: `const products = await hybridSearch(shop, query);` (no price filter parameters — Phase 6 will add tool-call wiring; today the stub passes only shop+query).
    7. Return: `return Response.json({ products });`

    Use `Response.json` (Web-API form, not `NextResponse.json`) per RESEARCH.md §7 Note ("Phase 6 will likely return SSE via `streamText`, dropping NextResponse entirely"). Keeping the stub close to the eventual production shape.

    No try/catch around hybridSearch — SearchService already catches and returns [] on DB error (per plan 04-02). If hybridSearch throws (which it shouldn't), the unhandled error surfaces naturally to the Next.js error handler.

    Zero `console.*` statements anywhere in this file (security: no secret leakage; CLAUDE.md constraint).

    DO NOT add GET, PUT, DELETE, or OPTIONS handlers. Per RESEARCH.md Open Question 4 lock: POST only.

    All 5 assertions in `app/api/proxy/chat/__tests__/route.test.ts` must pass after this file lands.
  </action>
  <verify>
    <automated>bunx vitest run app/api/proxy/chat/__tests__/route.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File app/api/proxy/chat/route.ts EXISTS
    - Command `grep -c "export async function POST" app/api/proxy/chat/route.ts` returns 1
    - Command `grep -c "from '@/services/search/SearchService'" app/api/proxy/chat/route.ts` returns 1
    - Command `grep -c "hybridSearch(shop, query)" app/api/proxy/chat/route.ts` returns 1
    - Command `grep -c "TODO(Phase 6)" app/api/proxy/chat/route.ts` returns at least 1 (TODO marker present)
    - Command `grep -c "STUB" app/api/proxy/chat/route.ts` returns at least 1 (header declares stub status)
    - Command `grep -c "missing_shop" app/api/proxy/chat/route.ts` returns at least 1 (400 error shape)
    - Command `grep -c "withShopifySession" app/api/proxy/chat/route.ts` returns 0 (intentionally NOT using Bearer wrapper — App Proxy uses HMAC, future work)
    - File MUST NOT contain `console.log`, `console.warn`, or `console.error`
    - File MUST NOT contain `streamText`, `tool(`, or `convertToModelMessages` (Phase 6 territory — keep the stub minimal so an executor in Phase 6 sees only what they need to replace)
    - Running `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` exits 0 with all 5 assertions passing
    - Running `bun lint` exits 0
    - Running `bunx tsc --noEmit` exits 0
    - File length: `wc -l app/api/proxy/chat/route.ts` reports >= 30 lines (header doc + import + handler body)
    - Directory `app/api/proxy/chat/` exists (was newly created if absent — Next.js App Router routing picks it up automatically)
  </acceptance_criteria>
  <done>The Phase 4 stub for /api/proxy/chat exists, the 04-01 proxy route test scaffold exits 0, EMB-07 success criterion #3 is provable at the source level via two grep commands targeting hybridSearch imports across both /api/chat and /api/proxy/chat, and the TODO header makes the Phase 6 work explicit for the next executor.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Public HTTP (untrusted) → /api/proxy/chat | NO authentication in Phase 4 stub; the ?shop= query param is intentionally untrusted (documented in code as Phase 6 TODO) |
| LLM / external caller → hybridSearch | NONE in Phase 4 stub — caller controls `query` directly without an LLM intermediary; the Zod tool-arg schema does NOT apply here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-14 | Spoofing | Caller forges `shop` query param to enumerate other shops' products | accept (Phase 4) / mitigate (Phase 6) | Phase 4 stub explicitly documents this gap in the file header. Production storefront code MUST NOT call this endpoint until Phase 6 adds HMAC verification per STR-04. The TODO marker is enforced by the acceptance criteria grep gate. |
| T-04-15 | Tampering | SQL injection via `query` body | mitigate | SearchService passes `query` through Prisma tagged-template binding (plan 04-02). No string concat. The stub itself does no SQL composition. |
| T-04-16 | Information Disclosure | Logging shop name or query | mitigate | Zero `console.*` statements (gate enforced). |
| T-04-17 | Denial of Service | Unbounded query length | accept (Phase 4) | No Zod validation in the stub (the LLM tool-arg constraints don't apply here). SearchService caps result candidates at 50+50→10. Phase 6's HMAC verification and Phase 8's hard cap close this together. Document gap in the TODO. |
| T-04-18 | Repudiation | Stub used in production accidentally | mitigate | File header includes "DO NOT use this endpoint from production storefront drawer code until Phase 6" in prominent prose. Acceptance gate `grep -c "STUB"` requires the marker to remain. |
</threat_model>

<verification>
After Task 1 completes:
1. `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` exits 0.
2. `bun lint` exits 0.
3. `bunx tsc --noEmit` exits 0.
4. EMB-07 success criterion #3 confirm via grep: both files reference hybridSearch.
   ```
   grep -l "hybridSearch" app/api/chat/route.ts app/api/proxy/chat/route.ts
   ```
   Must return both paths.
5. No production code outside `app/api/proxy/chat/route.ts` is touched.
</verification>

<success_criteria>
- app/api/proxy/chat/route.ts exists with proper stub semantics (400 on missing shop, empty-query short-circuit, hybridSearch call on valid input)
- 04-01 RED scaffold for the proxy route is GREEN
- TODO(Phase 6) marker visible at the source level so Phase 6 work is self-documenting
- EMB-07 success criterion #3 source-level proof: grep finds `hybridSearch` import in both routes
- Phase 4 stub is deliberately minimal — no streamText, no HMAC, no identity (those belong to Phase 6)
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-04-SUMMARY.md` when done. Include: line count of new file, confirmation of all 5 proxy test cases GREEN, the two grep results proving EMB-07 success criterion #3 at the source level, and a copy of the file header TODO block so Phase 6's executor sees it embedded in the SUMMARY chain.
</output>
</content>
</invoke>