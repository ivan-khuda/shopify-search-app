---
phase: 7
slug: admin-settings-model-picker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `07-RESEARCH.md` § Validation Architecture; planner fills the per-task table during PLAN.md generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <path>` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | full suite ~30s; per-task <5s |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run <changed file's __tests__ dir>` (1–3 files, <5s)
- **After every plan wave:** Run `bunx vitest run services/chat lib/db/repositories app/api/settings 'app/(embedded)/settings'` (~30s)
- **Before `/gsd-verify-work`:** Full suite (`bun test`) must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Per-task rows are populated by plan **07-10 Task 3** during the verification wave, once final task IDs crystallize during execution. Each PLAN.md already carries an `<automated>` verify command (or explicit Wave-0 RED dependency) per task; this map aggregates them post-execution for the Nyquist sign-off.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (populated by 07-10 Task 3) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/(embedded)/settings/__tests__/page.test.tsx` — covers SC1, SC2, SC3 (server-component pre-selection + catalog rendering)
- [ ] `app/(embedded)/settings/__tests__/settings-form.test.tsx` — covers SC1 (sort), SC2 (Save flow), and dirty-state Save disable
- [ ] `app/api/settings/model/__tests__/route.test.ts` — covers SC2 (auth + Zod body validation + catalog membership check + upsert)
- [ ] `services/chat/__tests__/model-catalog.test.ts` — covers SC1 (fetch + map + $/M conversion) + D-03 fallback ladder
- [ ] `services/chat/__tests__/getActiveChatModel.test.ts` — UPDATE existing (add DB-hit case for SC2, keep DB-miss case for SC3, add unknown-id fallback case)
- [ ] `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` — covers `get`/`upsert` contract
- [ ] No new framework install — vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| After Save in `/settings`, navigate to `/chat` and verify the banner shows the new model name | SC4 | Cross-route flow requires the embedded admin shell, App Bridge runtime, and a real Shopify session — out of jsdom's reach | 1) Open `/settings` in the embedded admin. 2) Pick a non-default model row. 3) Click Save → toast confirms. 4) Navigate to `/chat`. 5) Assert the banner reads `Model: <new displayName>`. |
| Cold-start catalog failure renders DEFAULT_MODEL-only row with Save disabled | SC1 (D-03 fallback) | Requires forcing a real fetch failure end-to-end | 1) Block egress to `ai-gateway.vercel.sh` (or stub the env in a preview deploy). 2) Open `/settings`. 3) Confirm only the DEFAULT_MODEL row renders and Save is visually disabled with the "Model catalog unavailable" banner. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
