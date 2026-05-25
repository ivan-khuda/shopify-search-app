---
phase: 4
slug: searchservice-wire-chat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Template-filled by /gsd:plan-phase; planner refines per-task rows.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom env, @testing-library/react) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test && bun lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test && bun lint`
- **Before `/gsd:verify-work`:** Full suite must be green; smoke shop seeded if Smoke test runs
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Planner fills this from PLAN.md tasks. Each row maps a task to its automated proof and references the requirement + threat (if any).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-EMB-05 | T-04-01 / — | shop param plumbed first, no LLM control | unit | `bunx vitest run services/search/__tests__/SearchService.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `services/search/__tests__/SearchService.test.ts` — stubs for EMB-05 (hybridSearch shape, RRF fusion, empty-query short-circuit)
- [ ] `services/chat/__tests__/getActiveChatModel.test.ts` — stub for ADM-05 (hardcoded default until Phase 7 swap)
- [ ] `app/api/chat/__tests__/route.test.ts` — stub for EMB-07/ADM-06 (AI Gateway routing, searchCatalog tool registered, MOCK_PRODUCTS gone)
- [ ] `components/chat/__tests__/chat-tool-result.test.tsx` — stub for ADM-06 (renders ProductCard from `tool-searchCatalog` `output-available` parts)
- [ ] `app/api/proxy/chat/__tests__/route.test.ts` — stub for EMB-07 (proxy stub calls SearchService.hybridSearch, returns JSON)

*Existing infra (vitest + jsdom + Phase 2/3 mock helpers) covers all rows above. No new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin chat playground at `/chat` returns real-catalog cards for "show me waterproof jackets under $100" | ADM-06 + ROADMAP SC #1 | End-to-end Shopify-embedded session-token flow requires live shop + seeded products | 1) Install app on dev store, 2) trigger sync, 3) navigate to /chat in embedded admin, 4) type the demo query, 5) verify ≥1 card surfaced, no MOCK_PRODUCTS in network response |
| Banner exactly reads `Preview mode — using your real catalog · Model: Gemini 2.5 Flash` above the tab strip | ADM-05 + ROADMAP SC #2 | Server-rendered text + typographic glyphs (em-dash, middle-dot) needs visual confirmation | Visit /chat in embedded admin; copy the banner text; assert byte-equal to the spec |
| Brand/SKU-style query (e.g., "Levi's 501") surfaces relevant products | ROADMAP SC #4 | Validates BM25 lexical contributes to RRF — requires a seeded brand string in the catalog | After seed, query "Levi's"; expect ≥1 result with the exact brand token; vector-only retrieval would not necessarily surface this |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test stubs above)
- [ ] No watch-mode flags (`bun test`, never `bun test --watch`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once planner finishes per-task map

**Approval:** pending
