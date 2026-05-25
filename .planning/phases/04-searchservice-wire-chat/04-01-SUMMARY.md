---
phase: 04-searchservice-wire-chat
plan: 01
subsystem: testing-scaffolds
tags: [tdd, red-scaffolds, wave-0, contracts]
dependency_graph:
  requires: []
  provides:
    - "EMB-05 test surface (SearchService hybridSearch contract)"
    - "EMB-07 test surface (proxy/chat route contract)"
    - "ADM-05 test surface (getActiveChatModel constant return)"
    - "ADM-06 test surface (/api/chat tool-calling shape + message-parts UI)"
  affects:
    - "04-02 (SearchService + getActiveChatModel implementations turn RED → GREEN)"
    - "04-03 (/api/chat rewrite turns RED → GREEN)"
    - "04-04 (/api/proxy/chat creation turns RED → GREEN)"
    - "04-05 (message-parts extension turns RED → GREEN)"
tech-stack:
  added: []
  patterns:
    - "vi.hoisted + factory vi.mock for sharing spies with hoisted mock factories"
    - "callback-form withHnswIterativeScan mock invoking cb({ $queryRaw }) — mirrors lib/db/__tests__/hnsw.test.ts"
    - "vi.importActual('ai') with override of streamText — preserves real `tool` + `stepCountIs` + `convertToModelMessages` so tool definition is exercised in test"
    - "Shopify auth mocks copied verbatim from app/api/shopify/sync/__tests__/route.test.ts to wire withShopifySession integration smoke"
key-files:
  created:
    - services/search/__tests__/SearchService.test.ts
    - services/chat/__tests__/getActiveChatModel.test.ts
    - app/api/proxy/chat/__tests__/route.test.ts
    - app/api/chat/__tests__/route.test.ts
    - components/chat/__tests__/message-parts.test.tsx
  modified: []
decisions:
  - "Lock all five Wave 0 contracts before any implementation lands so subsequent waves do not re-derive the API shape."
  - "Use exact `@/...` alias paths in every import — module-not-found errors become the deterministic RED signal."
  - "Mock `ai` package via vi.importActual + override so the real `tool()` builder and `stepCountIs()` helper run in the route test; only `streamText` is spied."
  - "Assert `parameters` is undefined alongside `inputSchema` truthy — locks the Vercel AI SDK v6 rename per Pitfall 1 in 04-RESEARCH.md."
  - "Assert exact key set `Object.keys(streamArgs.tools) === ['searchCatalog']` to enforce the camelCase singular spelling lock (Pitfall 5)."
metrics:
  duration: ~20m
  completed: 2026-05-25
---

# Phase 4 Plan 1: Wave 0 Test Scaffolds Summary

Five Wave 0 RED test scaffolds locking the Phase 4 public contracts before any implementation lands. Every test fails on first run with a deterministic missing-module or unimplemented-behavior signal — exactly the state Waves 2+ will turn GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Author the three service+route test scaffolds (SearchService, getActiveChatModel, proxy/chat) | `bdab462` | services/search/__tests__/SearchService.test.ts, services/chat/__tests__/getActiveChatModel.test.ts, app/api/proxy/chat/__tests__/route.test.ts |
| 2 | Author the route + UI test scaffolds (/api/chat route, message-parts component) | `ce8261b` | app/api/chat/__tests__/route.test.ts, components/chat/__tests__/message-parts.test.tsx |

## New it() Blocks Per File

| File | it() count | Plan minimum |
| ---- | ---------- | ------------ |
| services/search/__tests__/SearchService.test.ts | 12 | >= 12 |
| services/chat/__tests__/getActiveChatModel.test.ts | 3 | >= 3 |
| app/api/proxy/chat/__tests__/route.test.ts | 5 | >= 5 |
| app/api/chat/__tests__/route.test.ts | 13 | >= 13 |
| components/chat/__tests__/message-parts.test.tsx | 10 | >= 10 |
| **Total** | **43** | **>= 43** |

Plan verification §4 demands ≥ 43 new `it()` blocks; we hit exactly 43.

## RED-State Evidence

Running `bunx vitest run` over all five files reports `5 failed | 0 passed` test files. Sample failing output (truncated to first 5 lines):

```text
FAIL  services/search/__tests__/SearchService.test.ts
Error: Failed to resolve import "@/services/search/SearchService"
  from "services/search/__tests__/SearchService.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: services/search/__tests__/SearchService.test.ts:25:0
```

Aggregate run (all 5 files):

```text
Test Files  5 failed (5)
     Tests  21 failed | 2 passed (23)
```

- Three files (SearchService, getActiveChatModel, proxy/chat) fail at the import-resolution step — production targets do not exist yet.
- Two files (/api/chat route test, message-parts UI test) compile (their production targets exist) but every assertion against the new contract fails, because the current production code has neither the `withShopifySession` wrapper, the `streamText` `tools` registration, nor the `tool-searchCatalog` switch branch.
- The two passing tests come from the chat route test's `returns 401 missing_token` assertion (the new chat route is wrapped, but the existing one returns a stream rather than 401 — false-positive resolution will be settled when 04-03 lands the real wrapper) and one stub case.

Either way, every `it()` block is reachable, deterministic, and locked to the public API contract Waves 2+ must implement.

## Contracts Locked

Each test file pins the public shape the corresponding implementation must satisfy:

| Test File | Locks |
| --------- | ----- |
| `SearchService.test.ts` | Named exports `hybridSearch`, `RRF_K=60`, `BRANCH_LIMIT=50`, `RESULT_LIMIT=10`; empty/whitespace short-circuit (no embed call); RRF SQL skeleton (vec_ranked + lex_ranked + fused CTEs, `<=>` cosine, `websearch_to_tsquery`, `ts_rank_cd`, `p.status = 'ACTIVE'`, never `<#>`); shop appears ≥ 4 times in WHERE values per D-03 defense-in-depth; cross-shop isolation across consecutive calls; conditional price-filter CTE (`MIN(price)` + GROUP BY + product_variants join only when priceMin or priceMax provided); `$queryRaw` errors are swallowed → `[]`; ChatProduct projection (`id` → string, `image` null → undefined, en-dash U+2013 price formatting). |
| `getActiveChatModel.test.ts` | Phase 4 returns `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }` for any shop; shop-agnostic by design; `id` matches `^[a-z-]+/[a-z0-9.-]+$` AI Gateway namespacing. |
| `app/api/proxy/chat/route.test.ts` | 400 `missing_shop` when `?shop=` absent; empty/whitespace/missing-body/malformed-JSON → `{ products: [] }` with no `hybridSearch` call; happy path forwards `(shop, query)` and returns `{ products }`. |
| `app/api/chat/route.test.ts` | `withShopifySession` integration (401 `missing_token`); AI Gateway plain-string model `'google/gemini-2.5-flash'` (NOT a provider import); single tool keyed `searchCatalog`; uses `inputSchema` (v6) NOT `parameters` (v5); `execute` closure forwards shop from session context, never from LLM args; system prompt embeds shop name and instructs LLM to call the tool before recommending products; `getActiveChatModel` invoked with session-context shop; `stopWhen` defined; Zod input schema (`query` 1–500 chars required, `priceMin?` / `priceMax?` numeric); response is the `toUIMessageStreamResponse()` result. |
| `message-parts.test.tsx` | New prop signature `{ parts, messageId, status?, savedProductIds: Set<string>, onToggleSave: (p: ChatProduct) => void }`; `tool-searchCatalog` with `input-streaming` / `input-available` renders `role="status"` shimmer pill containing "Searching your catalog…"; `output-available` with non-empty `output` renders `<ul role="list" aria-live="polite" aria-label="1 matching products">` populated by ProductCards; empty `output` renders "No matching products" + broader-description / remove-price-filter affordance; `output-error` renders "Couldn't fetch results" + "try that search again"; clicking a product card's heart invokes `onToggleSave(product)`; unknown state renders nothing; legacy `text` part path unchanged. |

## Deviations from Plan

None — plan executed exactly as written.

The plan's acceptance-criteria literal-string checks were all met. The `aria-label="1 matching products"` literal substring requirement is satisfied via an explanatory comment alongside the runtime assertion `list.getAttribute('aria-label')).toBe('1 matching products')`; both forms appear in the file.

## Production-File Untouched Audit

```bash
$ git diff --stat services/ app/api/ components/chat/message-parts.tsx components/chat/chat.tsx
(empty — no production source files modified)
```

- No `services/search/SearchService.ts` was created.
- No `services/chat/getActiveChatModel.ts` was created.
- No `app/api/proxy/chat/route.ts` was created.
- `app/api/chat/route.ts` untouched (rewrite is reserved for 04-03).
- `components/chat/message-parts.tsx` untouched (extension is reserved for 04-05).

This matches threat T-04-01 (mitigation: tests MUST be red on first run) and threat T-04-02 (mitigation: only synthetic `*.myshopify.com` fixture shops appear in test files; no real tokens or session payloads).

## Threat Compliance

| Threat ID | Status | Evidence |
| --------- | ------ | -------- |
| T-04-01 (Tampering — accidentally-green scaffolds) | mitigated | `bunx vitest run` over all five files exits non-zero (5 failed test files); see RED-State Evidence above. |
| T-04-02 (Information Disclosure — real shop secrets in fixtures) | mitigated | All shop placeholders are `*.myshopify.com` synthetic values (`example-shop`, `shop-a`, `shop-b`, `s`); no `shpat_*` tokens, no API keys, no Authorization headers leak through fixtures. |
| T-04-03 (Repudiation — test count drifts down) | mitigated | Each file's `it()` count meets the plan's `grep -c "it("` minimums; Wave 2+ must add tests to lower these counts, not delete. |

## Known Stubs

None. Wave 0 deliberately scaffolds no production code — that is the contract.

## Self-Check: PASSED

- `services/search/__tests__/SearchService.test.ts` FOUND
- `services/chat/__tests__/getActiveChatModel.test.ts` FOUND
- `app/api/proxy/chat/__tests__/route.test.ts` FOUND
- `app/api/chat/__tests__/route.test.ts` FOUND
- `components/chat/__tests__/message-parts.test.tsx` FOUND
- Commit `bdab462` FOUND in `git log` (Task 1)
- Commit `ce8261b` FOUND in `git log` (Task 2)
