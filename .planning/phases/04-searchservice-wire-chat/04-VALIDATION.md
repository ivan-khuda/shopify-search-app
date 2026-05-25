---
phase: 4
slug: searchservice-wire-chat
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-25
updated: 2026-05-25
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

> Planner-filled. Each row maps a task to its automated proof and references the requirement + threat (if any). One row per implementation task across all 6 plans.
>
> Sampling-rate legend:
> - **after-commit:** Run the test immediately after the task lands. Expected signal documented in Expected-Signal column.
> - **after-wave:** Run as part of the wave-completion gate (after all parallel plans in the wave finish). Expected signal: continuity (all GREEN, no regressions).
> - **phase-end:** Run during Plan 04-06's verification gate (Task 3). Expected signal: full-suite GREEN + manual smoke approved.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Sampling Rate | Expected Signal | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|---------------|-----------------|-------------|--------|
| 04-01-T1 | 01 | 1 | EMB-05, EMB-07, ADM-05, ADM-06 | (Wave 0 scaffolds — covers all phase requirements with RED tests) | n/a — scaffolds are intentionally failing | unit (Wave 0 RED) | `bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts app/api/chat/__tests__/route.test.ts app/api/proxy/chat/__tests__/route.test.ts components/chat/__tests__/message-parts.test.tsx` | after-commit | RED transition: each new test file lands with at least one failing it() block. After commit, `wave_0_complete: true` flips in this frontmatter. | ❌ W0 | ⬜ pending |
| 04-02-T1 | 02 | 2 | EMB-05 | T-04-01, T-04-02, T-04-03, T-04-04 | shop param plumbed first, no LLM control; both retriever branches WHERE shop = $1; empty-query short-circuit before embed; err.message-only logging | unit | `bunx vitest run services/search/__tests__/SearchService.test.ts` | after-commit | RED → GREEN: the 12+ assertions in SearchService.test.ts flip from RED to GREEN. The `lex_ranked` branch test confirms BM25 contribution to RRF (W8 fix anchor — empirical brand-name verification deferred to 04-06-T2). | ⬜ pending | ⬜ pending |
| 04-02-T2 | 02 | 2 | ADM-05 | (no specific threat; stub returns hardcoded model id) | shop-first signature contract; Phase 7 body-only swap anchor; private DEFAULT_MODEL constant | unit | `bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts` | after-commit | RED → GREEN: all 3 assertions in getActiveChatModel.test.ts pass | ⬜ pending | ⬜ pending |
| 04-03-T1 | 03 | 3 | ADM-06, EMB-07 | T-04-07, T-04-08, T-04-09, T-04-10, T-04-11, T-04-12, T-04-13 | withShopifySession wraps POST; shop from closure not LLM args; AI Gateway plain-string model; v6 inputSchema (Pitfall 1); real z.object schema (W10 fix); no MOCK_PRODUCTS reference | unit | `bunx vitest run app/api/chat/__tests__/route.test.ts` | after-commit | RED → GREEN: the 13+ assertions in route.test.ts flip from RED to GREEN. Defense-in-depth gate: `grep -c "z.object" app/api/chat/route.ts` returns ≥1 (W10 fix). | ⬜ pending | ⬜ pending |
| 04-04-T1 | 04 | 3 | EMB-07 (SC #3 — proxy also calls SearchService) | (storefront-side threats stubbed; full mitigation deferred to Phase 6) | proxy stub imports SearchService.hybridSearch; declares the public contract for Phase 6 wiring; HMAC verification + cookie identity deferred | unit | `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` | after-commit | RED → GREEN: the proxy stub test passes — confirms route exists, returns JSON, calls hybridSearch (mocked). Phase 6 will replace stub with full implementation. | ⬜ pending | ⬜ pending |
| 04-05-T1 | 05 | 4 | ADM-06 | T-04-19, T-04-20, T-04-21, T-04-22 | render only `part.output` from `tool-searchCatalog`; discriminator-narrowing (no `as ToolUIPart` cast — W6 fix); fixed UI copy for error affordance; React auto-escapes product fields | unit | `bunx vitest run components/chat/__tests__/message-parts.test.tsx` | after-commit | RED → GREEN: the 10+ assertions in message-parts.test.tsx pass (running pill, products grid, zero-results, error affordance, ARIA roles). Anti-pattern gate: `grep -c "as ToolUIPart" components/chat/message-parts.tsx` returns 0 (W6 fix). | ⬜ pending | ⬜ pending |
| 04-05-T2 | 05 | 4 | EMB-07 | T-04-23 | MOCK_PRODUCTS deleted from disk; greeting copy reflects price-filter feature; integration test rewritten to mock tool-searchCatalog output-available | integration | `bunx vitest run components/chat/chat.integration-test.tsx components/chat/__tests__/product-card.test.tsx components/chat/__tests__/message-parts.test.tsx` | after-commit | RED → GREEN: integration test passes with TEST_PRODUCT fixture (no MOCK_PRODUCTS); recursive grep `grep -rn "MOCK_PRODUCTS\|buildMockResults" app components services lib types` returns zero matches. | ⬜ pending | ⬜ pending |
| 04-06-T1 | 06 | 5 | ADM-05 | T-04-24, T-04-25, T-04-26 | server-rendered banner with dynamic `{model.displayName}` interpolation (NOT literal 'Gemini 2.5 Flash'); aria-live='off' (static); aria-label exact UI-SPEC.md phrase; em-dash U+2014 + middle-dot U+00B7 byte-precise; integration-test deterministic handling (update OR delete) | unit + structural | `bunx vitest run && bun lint && bunx tsc --noEmit` + structural greps | after-commit | RED → GREEN: full suite passes (>= 150 tests). Structural gates pass: `grep -c "{model.displayName}" page.tsx` returns 1; `grep -c "Model: Gemini 2.5 Flash" page.tsx` returns 0 (B1 fix); `grep -c 'aria-live="off"' page.tsx` returns 1 AND `grep -c 'aria-live="polite"' message-parts.tsx` returns ≥1 (B2 fix); `grep -c "Chat playground preview mode banner" page.tsx` returns 1 (W5 fix); integration-test directive exclusively passes one of Option (i) or Option (ii) (B3 fix). | ⬜ pending | ⬜ pending |
| 04-06-T2 | 06 | 5 | ADM-05 + ADM-06 + ROADMAP SC #1, #2, #4 | T-04-26, T-04-27 | manual smoke test confirms: (1) banner glyphs U+2014 + U+00B7, (2) demo query returns real-catalog cards (no MOCK_PRODUCTS titles), (3) brand-name query returns ≥1 result (BM25/RRF contribution proof — W8 fix empirical verification), (4) nonsense query renders no-results affordance | manual smoke (blocking human checkpoint) | n/a — operator interaction; resume signal: 'approved' or 'issue: ...' | phase-end | Operator confirms all four test sub-cases. If 'issue:' returned, Task 3 surfaces `## VERIFICATION BLOCKED` to orchestrator instead of completing. | n/a | ⬜ pending |
| 04-06-T3 | 06 | 5 | EMB-05, EMB-07, ADM-05, ADM-06 (all phase requirements) | (none specific — gate authoring task) | VERIFICATION.md cites BOTH /api/chat AND /api/proxy/chat for EMB-07 (B4 dependency-correctness fix); ADM-05 row cites both dynamic-binding gate AND aria-label-text gate (W5 fix); STATE.md and ROADMAP.md reflect Phase 4 completion | structural (gate authoring) | `test -f .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md && grep -c "Phase 4 verification gate: PASS" .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md && grep -c "completed_phases: 4" .planning/STATE.md && grep -E "^- \[x\] \*\*Phase 4:" .planning/ROADMAP.md` | phase-end | All four structural gates pass; full vitest suite + bun lint + bunx tsc --noEmit all GREEN. If Task 2 'issue:' was raised, this task instead returns `## VERIFICATION BLOCKED`. | ⬜ pending | ⬜ pending |

**Continuity check:** No three consecutive tasks in the table above lack an `<automated>` verify command. Every task either has an `after-commit` test, an `after-wave` continuity check, or a `phase-end` structural gate. The single manual-smoke task (04-06-T2) is sandwiched between structural-gate tasks (04-06-T1 and 04-06-T3) per the planner-sampling-rules.md continuity rule.

---

## Wave 0 Requirements

- [ ] `services/search/__tests__/SearchService.test.ts` — stubs for EMB-05 (hybridSearch shape, RRF fusion, empty-query short-circuit, lex_ranked branch survives RRF — W8 anchor)
- [ ] `services/chat/__tests__/getActiveChatModel.test.ts` — stub for ADM-05 (hardcoded default until Phase 7 swap)
- [ ] `app/api/chat/__tests__/route.test.ts` — stub for EMB-07/ADM-06 (AI Gateway routing, searchCatalog tool registered with v6 inputSchema and real z.object schema (W10 fix), MOCK_PRODUCTS gone)
- [ ] `components/chat/__tests__/message-parts.test.tsx` — stub for ADM-06 (renders ProductCard from `tool-searchCatalog` `output-available` parts; discriminator narrowing not direct cast — W6 fix)
- [ ] `app/api/proxy/chat/__tests__/route.test.ts` — stub for EMB-07 (proxy stub calls SearchService.hybridSearch, returns JSON; Plan 04-06 EMB-07 evidence cites BOTH this side AND /api/chat — B4 dependency fix)

*Existing infra (vitest + jsdom + Phase 2/3 mock helpers) covers all rows above. No new framework install required.*

*`wave_0_complete` flips to `true` in the frontmatter only after Plan 04-01 lands, all five test files exist, and each contains at least one RED (failing) it() block.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin chat playground at `/chat` returns real-catalog cards for "show me waterproof jackets under $100" | ADM-06 + ROADMAP SC #1 | End-to-end Shopify-embedded session-token flow requires live shop + seeded products | 1) Install app on dev store, 2) trigger sync, 3) navigate to /chat in embedded admin, 4) type the demo query, 5) verify ≥1 card surfaced, no MOCK_PRODUCTS in network response |
| Banner exactly reads `Preview mode — using your real catalog · Model: Gemini 2.5 Flash` above the tab strip | ADM-05 + ROADMAP SC #2 | Server-rendered text + typographic glyphs (em-dash, middle-dot) needs visual confirmation | Visit /chat in embedded admin; copy the banner text; assert byte-equal to the spec |
| Brand/SKU-style query (e.g., "Levi's 501" or a synced vendor name) surfaces relevant products | ROADMAP SC #4 | Validates BM25 lexical contributes to RRF — requires a seeded brand string in the catalog. W8 fix anchors the structural truth in Plan 04-02; this row is the empirical verification deferred to Plan 04-06 Task 2 sub-case #3. | After seed, query a brand name present in the dev catalog; expect ≥1 result with the brand token surfaced; pure semantic retrieval would not necessarily match this token. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (verified in the per-task map above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual-smoke task 04-06-T2 is sandwiched between structural-gate tasks 04-06-T1 and 04-06-T3)
- [x] Wave 0 covers all MISSING references (5 test stubs above)
- [x] No watch-mode flags (`bun test`, never `bun test --watch`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (planner has finished per-task map)
- [ ] `wave_0_complete: true` — flips after Plan 04-01 lands its five RED scaffold files

**Approval:** pending (will flip to approved when Plan 04-06-T3 writes 04-VERIFICATION.md with PASS status)
</content>
