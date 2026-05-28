---
phase: 5
slug: shared-chat-ui-extraction
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
approved: 2026-05-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + @testing-library/react 16.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run lib/chat-ui` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run lib/chat-ui`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green AND `bun build` (strict TS) green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner. Map each task in `*-PLAN.md` to a verification row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-XX-XX | XX | N | SHR-XX | — | N/A | unit | `bunx vitest run lib/chat-ui/...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/chat-ui/__tests__/no-shopify-imports.test.ts` — static-grep guard test enforcing SHR-01 (no `@shopify/*`, `window.shopify`, App Bridge imports inside `lib/chat-ui/` excluding `lib/chat-ui/adapters/embedded.ts`)
- [ ] `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` — render ChatPane with each adapter; assert no auth coupling
- [ ] `lib/chat-ui/__tests__/embedded-adapter.test.ts` — adapter contract: session-token Bearer header injection
- [ ] `lib/chat-ui/__tests__/storefront-adapter.test.ts` — adapter contract: visitor_id from localStorage in request body
- [ ] No framework install required — vitest + jsdom already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Embedded admin chat page renders identically pre/post extraction | SHR-03 | Visual parity is non-trivial to automate without snapshot pixel-diff infra | 1. Run `bun dev`; 2. Open `/chat` in Shopify Admin embed; 3. Submit a query; 4. Confirm message bubble, product cards, history tab, saved-products tab all render and behave identically to pre-extraction commit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
