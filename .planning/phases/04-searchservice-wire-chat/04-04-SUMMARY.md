---
phase: 04-searchservice-wire-chat
plan: 04
subsystem: storefront-stub
tags: [storefront, app-proxy, stub, tdd-green, emb-07]
dependency_graph:
  requires:
    - "04-01 (RED scaffold app/api/proxy/chat/__tests__/route.test.ts)"
    - "04-02 (SearchService.hybridSearch implementation)"
  provides:
    - "EMB-07 success criterion #3 source-level proof (/api/proxy/chat imports hybridSearch)"
    - "Phase 6 hand-off marker — file header lists the four remaining storefront concerns"
  affects:
    - "Phase 6 storefront drawer (will replace this stub body wholesale)"
tech-stack:
  added: []
  patterns:
    - "Next.js 16 App Router POST route using Web-API Request/Response (Response.json) instead of NextResponse"
    - "Defensive req.json().catch(() => ({})) for missing/malformed bodies"
    - "Empty/whitespace short-circuit BEFORE the SearchService call (mirrors SearchService's own empty-query guard)"
    - "Long-form JSDoc header as a Phase 6 hand-off contract (STUB + TODO + WARNING markers enforced by acceptance-criteria greps)"
key-files:
  created:
    - app/api/proxy/chat/route.ts
    - .planning/phases/04-searchservice-wire-chat/deferred-items.md
  modified: []
decisions:
  - "Use Response.json (Web-API form) rather than NextResponse.json — keeps the stub close to the streaming shape Phase 6 will need."
  - "Trust ?shop= as-supplied in Phase 4 with explicit in-code comment that this is UNTRUSTED and Phase 6 owns the HMAC fix — fails closed only on the missing-shop case."
  - "No try/catch around hybridSearch — SearchService already swallows DB errors and returns []; an unhandled throw would surface naturally to Next.js."
  - "Intentionally do NOT wrap with the Bearer session helper used by /api/chat — App Proxy authenticates via HMAC, not Bearer, so the two routes diverge on auth even after Phase 6."
metrics:
  duration: ~3m
  completed: 2026-05-25
---

# Phase 4 Plan 4: /api/proxy/chat Phase 4 Stub Summary

One-liner: New POST route `app/api/proxy/chat/route.ts` that imports `hybridSearch` from `@/services/search/SearchService`, satisfying EMB-07 success criterion #3 at the source level today while a prominent JSDoc header reserves four concrete TODOs for Phase 6 (HMAC, visitor identity, real streaming-text wiring, hard cap).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create app/api/proxy/chat/route.ts as the Phase 4 stub calling SearchService.hybridSearch | `d63e817` | app/api/proxy/chat/route.ts |

## New File Stats

- `app/api/proxy/chat/route.ts`: **60 lines** (plan minimum: >= 30 — see `min_lines: 30` in plan frontmatter).
- Exports: `POST` (single Next.js 16 App Router handler).
- Imports: `import { hybridSearch } from '@/services/search/SearchService';` (single import, no console/streamText/etc).

## Test Outcome (RED → GREEN)

`bunx vitest run app/api/proxy/chat/__tests__/route.test.ts`:

```text
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

All 5 assertions from the 04-01 RED scaffold are now GREEN:

| # | Assertion | Status |
| - | --------- | ------ |
| 1 | 400 + `{ error: 'missing_shop' }` when `?shop=` is absent | PASS |
| 2 | Empty-string `query` body short-circuits to `{ products: [] }` (no hybridSearch call) | PASS |
| 3 | Whitespace-only `query` body short-circuits to `{ products: [] }` (no hybridSearch call) | PASS |
| 4 | Missing body or malformed JSON short-circuits to `{ products: [] }` (no hybridSearch call) | PASS |
| 5 | Valid `(shop, query)` calls `hybridSearch('shop.myshopify.com', 'shoes')` exactly once, returns `{ products: result }` | PASS |

Pre-implementation RED was confirmed first — `Failed to resolve import "@/app/api/proxy/chat/route"` (module-not-found is the canonical RED signal per the 04-01 contract).

## EMB-07 Success Criterion #3 — Source-Level Proof

The plan-level requirement is that BOTH routes reference `hybridSearch` at the source level. Plan 04-04 lands the proxy-route half.

```bash
$ grep -l "hybridSearch" app/api/proxy/chat/route.ts
app/api/proxy/chat/route.ts

$ grep -c "from '@/services/search/SearchService'" app/api/proxy/chat/route.ts
1

$ grep -c "hybridSearch(shop, query)" app/api/proxy/chat/route.ts
1
```

The `/api/chat` (admin) half of the dual-import EMB-07 grep is the responsibility of plan **04-03** (running in a parallel wave). The phase-level verification gate (`grep -l "hybridSearch" app/api/chat/route.ts app/api/proxy/chat/route.ts` returning both paths) becomes provable only after BOTH 04-03 and 04-04 land. This plan landed its half; 04-03 lands the other half.

## Acceptance Criteria Gate Results

All plan acceptance-criteria greps pass on `app/api/proxy/chat/route.ts`:

| Gate | Expect | Actual | Status |
| ---- | ------ | ------ | ------ |
| `grep -c "export async function POST"` | 1 | 1 | PASS |
| `grep -c "from '@/services/search/SearchService'"` | 1 | 1 | PASS |
| `grep -c "hybridSearch(shop, query)"` | 1 | 1 | PASS |
| `grep -c "TODO(Phase 6)"` | >= 1 | 2 | PASS |
| `grep -c "STUB"` | >= 1 | 1 | PASS |
| `grep -c "missing_shop"` | >= 1 | 1 | PASS |
| `grep -c "withShopifySession"` | 0 | 0 | PASS |
| `grep -cE 'console\.(log|warn|error)'` | 0 | 0 | PASS |
| `grep -c "streamText"` | 0 | 0 | PASS |
| `grep -c "tool("` | 0 | 0 | PASS |
| `grep -c "convertToModelMessages"` | 0 | 0 | PASS |
| `wc -l` | >= 30 | 60 | PASS |
| Directory `app/api/proxy/chat/` exists | YES | YES | PASS |
| `bunx vitest run …route.test.ts` exit 0 with 5/5 | YES | YES | PASS |

### Lint / TypeScript

- `bun lint` on `app/api/proxy/chat/route.ts`: **clean** (no warnings, no errors attributable to this file).
- `bunx tsc --noEmit` on `app/api/proxy/chat/route.ts`: **clean** (no diagnostics on this file).

A single pre-existing repo-wide lint error in `lib/shopify/auth.ts:14:27` (rule `@typescript-eslint/prefer-as-const`) and a cluster of pre-existing repo-wide tsc errors (missing `@/app/generated/prisma/client` because Prisma client hasn't been generated in this worktree; Phase 5 RED scaffold `components/chat/__tests__/message-parts.test.tsx`; component reasoning.tsx external `@jenius/ui/*` import paths; legacy `onboarding/page.tsx` global `shopify`) are out of scope per executor scope-boundary rule. Logged to `.planning/phases/04-searchservice-wire-chat/deferred-items.md`.

## File Header TODO Block (Verbatim, for the Phase 6 Executor)

The header below is captured here so the Phase 6 executor sees it embedded in the SUMMARY chain without having to grep:

```text
Storefront chat endpoint — Phase 4 STUB.

Phase 4 ships only enough surface here to satisfy EMB-07 success criterion #3:
"Both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call
`SearchService.hybridSearch`." The runtime storefront drawer does NOT invoke
this route in Phase 4 — it exists today as a source-level proof point so the
EMB-07 verification gate passes via two grep commands targeting `hybridSearch`
imports across both routes.

TODO(Phase 6): Replace this stub with the real storefront chat endpoint. The
Phase 6 executor must add ALL of the following before this route is wired to
the customer-facing drawer:

  1. App Proxy HMAC validation via
       shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })
     per STR-04. The `?shop=` query parameter is UNTRUSTED in Phase 4 — Phase 6
     must derive shop from the validated signature, NOT from the raw param.
  2. Anonymous visitor identity resolution from a `visitor_id` body field
     (IDN-01). Shopify's App Proxy strips Set-Cookie, so identity must be
     passed in the request payload (localStorage on the storefront), NOT via
     cookies — see PROJECT.md "Storefront identity".
  3. Replace this JSON response with the Vercel AI SDK streaming-text call
     (the same `searchCatalog` tool registration used by `app/api/chat/route.ts`),
     sharing the chat-ui components extracted in Phase 5. See that route for
     the canonical wiring shape Phase 6 must mirror here.
  4. Verify per-shop hard cap (CAP-02) before invoking the AI Gateway so
     storefront traffic cannot exhaust the free-tier monthly cap.

WARNING: DO NOT use this endpoint from production storefront drawer code
until Phase 6. The current implementation trusts the `?shop=` query parameter
as-supplied and performs zero authentication — it is a source-level
placeholder, not a callable storefront API.

Cross-reference: see `app/api/chat/route.ts` for the canonical pattern Phase 6
will mirror here. NOTE: this stub intentionally does NOT use the Bearer
session wrapper from `@/lib/shopify/auth` — App Proxy authenticates via HMAC,
not Bearer tokens, so the two routes will diverge on their auth wrapper even
after Phase 6 lands.
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded header to avoid forbidden literal substrings**

- **Found during:** Task 1 acceptance-criteria grep run.
- **Issue:** The plan's `<action>` block instructed the header to mention `streamText({ tools: { searchCatalog } })` literally and to note that the route intentionally does NOT use `withShopifySession`. BOTH literal substrings are independently FORBIDDEN by the acceptance criteria (`grep -c "withShopifySession"` must be `0` and `grep -c "streamText"` must be `0`). The two `<action>` instructions self-contradict the acceptance criteria.
- **Fix:** Reworded the relevant header sentences to preserve the Phase 6 hand-off intent without the literal forbidden tokens:
  - `streamText({ tools: { searchCatalog } })` → "the Vercel AI SDK streaming-text call (the same `searchCatalog` tool registration used by `app/api/chat/route.ts`)"
  - `withShopifySession wrapper is intentionally NOT used here` → "this stub intentionally does NOT use the Bearer session wrapper from `@/lib/shopify/auth`"
  - Inline comment `streamText wiring` → `streaming-text wiring`
- **Files modified:** `app/api/proxy/chat/route.ts` (header + inline TODO comment).
- **Commit:** `d63e817` (consolidated into the single Task 1 commit; the rewording happened before the first commit landed).
- **Why this is safe:** The Phase 6 executor reading the header still sees the literal SDK function-name hint (`searchCatalog` tool registration, Vercel AI SDK streaming-text) and the exact cross-reference path (`@/lib/shopify/auth`) needed to find the canonical pattern in `app/api/chat/route.ts`. The acceptance-criteria greps exist precisely to keep Phase 6's new wiring textually grep-able in `/api/chat` only until Phase 6 explicitly migrates the proxy file; satisfying those greps as written is the correct precedence over the `<action>` block's wording suggestion.

### Out-of-Scope Findings

Logged to `.planning/phases/04-searchservice-wire-chat/deferred-items.md`:

1. Pre-existing lint error in `lib/shopify/auth.ts:14:27` (`@typescript-eslint/prefer-as-const`).

Multiple pre-existing tsc errors (missing `@/app/generated/prisma/client`, Phase 5 RED scaffold expecting a yet-to-land prop, `@jenius/ui/*` imports in `reasoning.tsx`, legacy `shopify` global in `onboarding/page.tsx`) are also out of scope — none touch `app/api/proxy/chat/route.ts`.

## Threat Compliance

| Threat ID | Status | Evidence |
| --------- | ------ | -------- |
| T-04-14 (Spoofing — forged `?shop=` query param) | **accept (Phase 4) / mitigate (Phase 6)** | File header explicitly documents the gap with a WARNING line and a TODO(Phase 6) referencing STR-04 HMAC validation; `grep -c "STUB"` and `grep -c "TODO(Phase 6)"` acceptance gates enforce the markers stay in place. |
| T-04-15 (Tampering — SQL injection via query) | mitigated | The stub itself composes no SQL; `body.query` is passed only as the second positional argument to `hybridSearch`, which (per plan 04-02) binds the value via Prisma tagged-template substitution — no concatenation. |
| T-04-16 (Information Disclosure — log leakage) | mitigated | `grep -cE 'console\.(log|warn|error)'` returns `0`. CLAUDE.md log-hygiene constraint satisfied. |
| T-04-17 (DoS — unbounded query length) | accept (Phase 4) | No Zod validation in the stub; the LLM tool-arg constraints from `/api/chat` don't apply here because no LLM is in the loop. Phase 6's HMAC gate + Phase 8's hard cap close this together. Documented in the header TODO. |
| T-04-18 (Repudiation — stub used in production) | mitigated | Header contains "Phase 4 STUB" title and "DO NOT use this endpoint from production storefront drawer code until Phase 6" warning prose. Acceptance-criteria gate `grep -c "STUB"` enforces the marker remains. |

## Known Stubs

`app/api/proxy/chat/route.ts` itself is, by design, the entirety of the Phase 4 stub for the storefront chat endpoint. The stub is intentional and documented exhaustively in the file header; Phase 6 owns the replacement. No additional unrelated stubs were introduced.

## Self-Check: PASSED

- `app/api/proxy/chat/route.ts` FOUND
- `.planning/phases/04-searchservice-wire-chat/deferred-items.md` FOUND
- Commit `d63e817` FOUND in `git log` (Task 1)
