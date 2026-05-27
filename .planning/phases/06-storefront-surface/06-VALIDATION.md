---
phase: 6
slug: storefront-surface
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
approved: 2026-05-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (jsdom env) — existing |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <path>` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~30–60s (jsdom suite); +~10s for integration tests against test DB |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run <touched-paths>` (sub-second per file)
- **After every plan wave:** Run `bun test` full suite
- **Before `/gsd:verify-work`:** Full suite green + `bun build` + manual smoke against dev store
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| STR-01 | `extensions/chat-drawer/` scaffold exists (blocks/, assets/, shopify.extension.toml) | structural | `bunx vitest run __tests__/extension-structure.test.ts` | ❌ W0 | ⬜ pending |
| STR-02 | App Embed schema declares `enabled`, `accent_color`, `fab_position` | structural (parse liquid `{% schema %}`) | `bunx vitest run __tests__/app-embed-schema.test.ts` | ❌ W0 | ⬜ pending |
| STR-03 | `shopify.app.toml` contains `[app_proxy]` with url/subpath/prefix | structural | `bunx vitest run __tests__/shopify-toml.test.ts` | ❌ W0 | ⬜ pending |
| STR-04 | Every `/api/proxy/*` route rejects requests without valid HMAC | unit + integration | `bunx vitest run app/api/proxy` | ❌ W0 | ⬜ pending |
| STR-04 | `withAppProxyHmac` derives `shop` from signed query, not raw param | unit | `bunx vitest run lib/shopify/__tests__/app-proxy-auth.test.ts` | ❌ W0 | ⬜ pending |
| STR-04 | Tampered signature rejects; HMAC fuzz cases handled | unit (fuzz) | `bunx vitest run lib/shopify/__tests__/app-proxy-auth.fuzz.test.ts` | ❌ W0 | ⬜ pending |
| STR-05 | FAB 56px, drawer 400px desktop / full-width mobile | manual UAT | Theme Editor preview on Dawn/Sense/Craft | manual | ⬜ pending |
| STR-06 | Drawer empty state renders 4 chips matching UI-SPEC strings | unit (render-and-assert) | `bunx vitest run extensions/chat-drawer/src/components/__tests__/PromptChips.test.tsx` | ❌ W0 | ⬜ pending |
| STR-07 | `Shopify.designMode === true` prevents drawer auto-open on FAB click | unit | `bunx vitest run extensions/chat-drawer/__tests__/loader.test.ts` | ❌ W0 | ⬜ pending |
| STR-07 | Z-index 2000+ on drawer/scrim/FAB; no theme collisions | structural CSS + manual | unit + manual on Dawn/Sense/Craft | manual | ⬜ pending |
| STR-08 | StorefrontAdapter only hits `/apps/smartdiscovery/*` (no cross-origin) | unit (mock fetch, assert URLs) | `bunx vitest run lib/chat-ui/adapters/__tests__/storefront.test.ts` | ⚠️ extend existing | ⬜ pending |
| IDN-01 | `visitor_id` UUID generated + persisted in localStorage on first call | unit | existing Phase 5 test | ✅ | ⬜ pending |
| IDN-02 | `customer_id` included in request body when `window.Shopify.customer` present | unit | extend `lib/chat-ui/adapters/__tests__/storefront.test.ts` | ⚠️ extend existing | ⬜ pending |
| IDN-02 | Handler verifies `body.customer_id === signed query.logged_in_customer_id`; mismatch → 403 | unit + integration | `bunx vitest run lib/shopify/__tests__/app-proxy-auth.test.ts` + `app/api/proxy/chat/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| IDN-03 | `Conversation` model migration applies cleanly | structural | `prisma migrate dev` + `bun db:indexes` | manual | ⬜ pending |
| IDN-04 | `GET /api/proxy/conversations/:id` returns full messages JSONB | unit | `bunx vitest run app/api/proxy/conversations/[id]/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| IDN-04 | `GET /api/proxy/conversations` returns paginated list with cursor | unit | `bunx vitest run app/api/proxy/conversations/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| IDN-05 | `SavedProduct` model + partial unique indexes apply | structural | `prisma migrate dev` + `bun db:indexes` + EXPLAIN INDEX | manual | ⬜ pending |
| IDN-05 | Toggle save is idempotent under repeated POST | integration | `bunx vitest run app/api/proxy/saved-products/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| IDN-06 | Merge transaction unions anon data into customer rows; second merge is no-op | integration (real test DB) | `bunx vitest run __tests__/merge-integration.test.ts` | ❌ W0 | ⬜ pending |
| IDN-06 | After merge: `VisitorCustomerLink` row exists; next request short-circuits | integration | same as above | ❌ W0 | ⬜ pending |
| D-02 | `DbBackedHistoryStore` + `DbBackedSavedProductsStore` implement Phase 5 store interfaces | unit | `bunx vitest run lib/chat-ui/stores/__tests__/db-backed.test.ts` | ❌ W0 | ⬜ pending |
| D-07 | `retentionSweep` deletes Conversations with `lastMessageAt < now() - 180d` | integration (`@inngest/test`) | `bunx vitest run inngest/functions/__tests__/retention-sweep.test.ts` | ❌ W0 | ⬜ pending |
| D-08 | Rate limit returns 429 after 30 chat messages / 5 min per visitor | unit | `bunx vitest run lib/rate-limit/__tests__/memory.test.ts` | ❌ W0 | ⬜ pending |
| D-08 | Rate limit returns 429 after 60 conversations/saved-products req / min | unit | same file | ❌ W0 | ⬜ pending |
| D-13/D-14 | `bun run prebuild` produces `public/storefront-bundle-*.js` + valid manifest | build-pipeline | `bunx vitest run __tests__/bundle-build.test.ts` (calls prebuild via execSync) | ❌ W0 | ⬜ pending |
| D-15 | Loader paints skeleton drawer before bundle finishes loading | unit | `extensions/chat-drawer/__tests__/loader.test.ts` (assertion on DOM after click) | ❌ W0 | ⬜ pending |
| D-19 | `onFinish` writes assistant + user msg atomically; mid-stream failure discards | integration | `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| Phase smoke | End-to-end on a real dev store: install → FAB appears → click → drawer mounts → query "warm winter clothes" → real products → reload → history visible | manual UAT | Phase 6 verification gate checklist | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 installs test infrastructure and creates stub test files before any implementation begins. All ❌ W0 items above resolve here.

- [ ] `lib/shopify/__tests__/app-proxy-auth.test.ts` — STR-04 HMAC verification + IDN-02 customer_id cross-check
- [ ] `lib/shopify/__tests__/app-proxy-auth.fuzz.test.ts` — STR-04 HMAC tamper + replay cases
- [ ] `lib/rate-limit/__tests__/memory.test.ts` — D-08 sliding-window math
- [ ] `app/api/proxy/conversations/__tests__/route.test.ts` — IDN-03/04 list+create
- [ ] `app/api/proxy/conversations/[id]/__tests__/route.test.ts` — IDN-04 resume + append
- [ ] `app/api/proxy/saved-products/__tests__/route.test.ts` — IDN-05 toggle save
- [ ] `app/api/proxy/chat/__tests__/route.test.ts` — STR-04 HMAC + D-19 onFinish write + IDN-02 cross-check
- [ ] `__tests__/merge-integration.test.ts` — IDN-06 merge transaction + VisitorCustomerLink idempotency (real test DB)
- [ ] `inngest/functions/__tests__/retention-sweep.test.ts` — D-07 (uses `@inngest/test`)
- [ ] `lib/chat-ui/stores/__tests__/db-backed.test.ts` — D-02 DbBacked* store interfaces
- [ ] `lib/chat-ui/adapters/__tests__/storefront.test.ts` — EXTEND existing for IDN-02 customer_id reading
- [ ] `extensions/chat-drawer/__tests__/loader.test.ts` — STR-07 designMode guard + D-15 skeleton
- [ ] `extensions/chat-drawer/src/components/__tests__/StorefrontDrawer.test.tsx` — drawer shell composition
- [ ] `extensions/chat-drawer/src/components/__tests__/PromptChips.test.tsx` — STR-06 4 chips
- [ ] `__tests__/app-embed-schema.test.ts` — STR-02 schema settings
- [ ] `__tests__/shopify-toml.test.ts` — STR-03 `[app_proxy]` block
- [ ] `__tests__/extension-structure.test.ts` — STR-01 scaffold
- [ ] `__tests__/bundle-build.test.ts` — D-13/D-14 prebuild outputs
- [ ] `@inngest/test` dev dependency installed (if not already)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FAB renders 56px and drawer 400px on a real storefront | STR-05 | Visual + viewport-dependent | Install extension on Dawn/Sense/Craft dev stores; toggle App Embed on; verify FAB position and drawer width per UI-SPEC |
| No z-index collision on Dawn, Sense, Craft themes | STR-07 | Theme-specific layering not detectable without a real browser running theme JS | Open each theme; verify drawer/FAB sit above sticky header, cart drawer, and mobile menu |
| `Shopify.designMode` guard works in Theme Editor | STR-07 | Theme Editor injects `designMode`; difficult to reproduce in jsdom faithfully | Open Theme Editor for a dev store; click FAB; verify drawer does NOT auto-open; confirm bundle is not requested in Network tab |
| Prisma migration + manual indexes apply cleanly | IDN-03 / IDN-05 | Requires real Postgres + `bun db:indexes` round-trip | `bunx prisma migrate dev` then `bun db:indexes`; verify partial indexes exist with `EXPLAIN`; rerun `bun db:indexes` and confirm idempotent |
| End-to-end smoke against dev store | Phase gate | Sync → drawer → real catalog query → resume after reload | Phase 6 verification checklist (see ROADMAP success criteria 1–5) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags (`vitest run`, never `vitest`)
- [ ] Feedback latency < 60s for incremental, < 120s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after planner closes ❌ items into Wave 0 tasks

**Approval:** pending
