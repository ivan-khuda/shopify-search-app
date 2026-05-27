# SmartDiscovery AI

## What This Is

SmartDiscovery AI is a Shopify-embedded app that adds AI-powered product discovery to any storefront. A storefront visitor opens a chat drawer (injected via Theme App Extension), describes what they're looking for in natural language, and immediately sees relevant products from the merchant's catalog. Behind the scenes the app syncs the merchant's catalog into pgvector, runs hybrid semantic + full-text search, and streams answers grounded in real product cards. Shipped v1.0 covers install → background sync → admin chat playground → live storefront drawer with conversation history and saved products, plus per-shop model picker and a hard request cap that protects unit economics before billing ships.

## Core Value

**A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.**

This is the unchanged V1 thesis. v1.0 validated it end-to-end across the install → sync → drawer → chat flow. Bundle size and operator smokes are the remaining polish.

## Current State

- **Shipped:** v1.0 SmartDiscovery AI MVP — 2026-05-27
- **Scope:** 9 phases (Foundation, Sync Pipeline, Embeddings + Search, SearchService + Chat, Shared Chat UI, Storefront Surface, Admin Settings + Model Picker, Email + Hard Cap, v1.0 Gap Closure)
- **LOC:** ~26,200 TypeScript across 179 source files
- **Tests:** 425/425 vitest passing
- **Requirements:** 54/54 v1 requirements satisfied
- **See:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/MILESTONES.md`

## Next Milestone Goals (v1.1 — TBD)

**Primary candidate — Storefront Bundle Optimization:** The first finding from v1.0 close is the storefront bundle exceeding the 250KB cap (currently 1420KB) after wiring real chat components into `extensions/chat-drawer/src/entry.tsx`. Resolution path: code-split the entry to lazy-load `ChatPane`/`HistoryPanel`/`SavedProductsPanel` on FAB click, or revisit the cap with a measured ceiling.

**Other candidates to prioritize during `/gsd-new-milestone`:**
- Resolve seven deferred human smokes (live extension deploy, real Resend sends, cap-reached cross-route behavior, anonymous-direct-hit redirect tests).
- Billing surface (Shopify Billing API + plans + credit ledger) — deferred from v1.0.
- Bundle observability + size budget enforcement in CI.
- Multimodal embeddings (text + image / CLIP) for verticals where image search matters.
- Multi-language drawer UI.

## Requirements

### Validated (v1.0)

All 54 v1 requirements satisfied — see `.planning/milestones/v1.0-REQUIREMENTS.md` for the final traceability table. Highlights:

- ✓ Multi-tenant Prisma schema with shop scoping on every row — v1.0
- ✓ Shopify session-token Bearer auth on embedded routes; App Proxy HMAC on storefront — v1.0
- ✓ Inngest cursor-resumable sync; `SyncRun` state machine; onboarding progress UI — v1.0
- ✓ `ProductEmbedding` with pgvector + HNSW + frozen `modelVersion` — v1.0
- ✓ RRF hybrid search; admin playground on real catalog (MOCK_PRODUCTS removed) — v1.0
- ✓ `@/lib/chat-ui` barrel with `ChatPane`/`HistoryPanel`/`SavedProductsPanel` + DbBacked stores — v1.0
- ✓ Theme App Extension with FAB + drawer; anonymous visitor identity via signed cookie — v1.0
- ✓ Per-shop model picker via Vercel AI Gateway catalog — v1.0
- ✓ Resend success/failure emails with retry deep link — v1.0
- ✓ Per-shop monthly hard cap on chat requests — v1.0

### Active (v1.1 candidates — to be confirmed during `/gsd-new-milestone`)

- [ ] Storefront bundle < 250KB (code-split entry.tsx) — carried tech debt from v1.0
- [ ] Live deployment smokes (storefront extension deploy, Resend live sends, anonymous redirect verification)
- [ ] Bundle size budget enforced in CI (not just a unit test)

### Out of Scope (unchanged from v1.0 unless v1.1 promotes)

- **Billing / monetization** — Shopify Billing API, plans, credit ledger. Deferred from v1.0; candidate for v1.1 or v2.0.
- **Multimodal embeddings (text + image / CLIP)** — text-only embedding adequate for V1; revisit per-vertical.
- **Voice / audio input** — text-only input.
- **Bulk operations API** — overkill for 5k SKU target; revisit at 50k+.
- **Recommendations engine based on purchase history** — distinct product from search by intent.
- **Shopify Plus exclusive features** — broad-market focus.
- **Customer wishlist integration / metafield sync for Saved** — Saved is our own bookmark list.
- **Self-hosted / BYO-LLM-key option** — Vercel AI Gateway is the sole provider.
- **Multi-language UI** — single English locale.
- **App Store listing optimization** — engineering milestone, not marketing.

## Context

**Codebase state (post v1.0):**

- 26,200 LOC TypeScript across 179 source files
- Tech stack: Next.js 16 App Router + bun + Prisma 7 + PostgreSQL + pgvector + Tailwind 4 + Vercel AI Gateway + Inngest + Resend
- 425/425 vitest tests passing
- Storefront bundle: 1420KB (over the 250KB target — tracked for v1.1)

**Observed during v1.0:**

- The original audit (2026-05-27) found 4 blockers, 3 warnings, and 22 hygiene items hidden behind passing per-phase verifications. Cross-phase integration check is essential before milestone close — a follow-up gap-closure phase (8.1) was required.
- StorefrontDrawer started as placeholder JSX in Phase 6 and got wired to real components in Phase 8.1. The 250KB bundle cap from Phase 6 became an architectural inconsistency once real composition landed.
- `human_verify_mode: end-of-phase` deferred 5+ manual smokes that should be batched into a single live-deploy validation in v1.1.

## Constraints

- **Tech stack**: Locked to Next.js 16 App Router + bun + TypeScript strict + Prisma 7 + PostgreSQL + pgvector + Tailwind 4 + shadcn-style primitives. No framework migrations.
- **Package manager**: bun only — never npm/pnpm/yarn commands.
- **AI provider**: Vercel AI Gateway is the sole runtime entry point for chat completions and embeddings. No direct OpenAI/Anthropic/Google SDKs in shipped code paths.
- **Email provider**: Resend with React Email templates.
- **Catalog scale**: ~5k products per shop. Bulk Operations API and queue infrastructure remain out of scope.
- **Storefront integration**: Theme App Extension + Shopify App Proxy — no theme-file edits, no third-party CDN scripts.
- **Storefront identity**: Anonymous visitor (signed cookie) with optional customer-id upgrade — no login wall.
- **Sync architecture**: Background job (Inngest) + status polling — no synchronous Vercel functions over 60s.
- **Auth**: Shopify session-token Bearer auth on embedded API routes; App Proxy HMAC verification on storefront routes; edge middleware/proxy guard enforcing redirect on anonymous direct hits.
- **Hard cap**: Per-shop monthly cap on chat requests enforced server-side until billing ships.
- **Security**: No secrets, no session tokens, no auth headers in logs.
- **Hosting**: Vercel-first; remain deployable to standard Node.
- **No multi-tenant data leaks**: Every product/embedding/conversation row carries shop scoping; queries always filter by shop.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Theme App Extension + App Proxy for storefront drawer | Standard Shopify pattern; signed same-origin endpoint; zero-touch theme integration | ✓ Good — works end-to-end after 8.1 routing fixes (v1.0) |
| Vercel AI Gateway as sole AI provider | Unified billing/observability/fallback; AI SDK first-class support | ✓ Good — no provider lock-in surprises (v1.0) |
| Defer billing to later milestone | V1 free + hard cap validates discovery loop before payment friction | ✓ Good — `CapService` ships with cap; billing now v1.1+ candidate (v1.0) |
| Target ~5k products in V1 | Covers SMB Shopify shops; skips bulk-ops + distributed queue work | ✓ Good — Inngest cursor-resumable batches handle scale (v1.0) |
| Text-only embeddings + hybrid (vector + tsvector) | Cheaper, simpler, covers brand/SKU edge cases that pure vector misses | ✓ Good — RRF re-rank delivers expected quality (v1.0) |
| Resend for transactional email | Best Next.js DX, React Email templates, generous free tier | ✓ Good — pending live-send smoke (v1.0) |
| FAB trigger for storefront drawer | Works on any OS 2.0 theme without merchant editing Liquid | ✓ Good — App Embed block toggle is the only merchant action (v1.0) |
| Hybrid anonymous + customer-linked identity | Maximum reach (no login wall) with cross-device history when logged in | ✓ Good — signed visitor cookie + optional customer upgrade (v1.0) |
| Dynamic Vercel AI Gateway model catalog in admin | Merchants pick price/quality tradeoff without us re-deploying | ✓ Good — `ShopSettings.activeModel` per shop (v1.0) |
| Background job + status polling for sync | Survives Vercel timeouts, tab close, cold starts | ✓ Good — Inngest step functions handle resumption (v1.0) |
| Shared chat-UI package between admin and storefront | Existing admin chat mirrors storefront design — duplication would diverge | ⚠️ Revisit — extraction worked, but bundling `@/lib/chat-ui` into the storefront entry blew the 250KB cap (v1.0 → v1.1) |
| History = conversations, Saved = our own bookmark list | Avoids collision with installed Shopify wishlist apps | ✓ Good — DbBacked stores keyed by visitor + optional customer (v1.0) |
| `human_verify_mode: end-of-phase` | Batches manual smokes to end of phase rather than mid-execution | ⚠️ Revisit — deferred 7+ smokes across phases; consider batched live-deploy validation in v1.1 |
| Edge auth guard via App Proxy `proxy.ts` matcher | Empirically auto-registered by Next.js 16.1.6 (verified in 8.1-01) | ✓ Good — single-line matcher covers /onboarding, /chat, /settings (v1.0 close) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-28 after v1.0 milestone*
