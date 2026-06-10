# Phase 7: Admin Settings + Model Picker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 7-admin-settings-model-picker
**Areas discussed:** Model catalog source, Settings page UX, Save semantics, Default seeding strategy

---

## Model catalog source

### Q1 — Where does the list of available chat models come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Static curated list in repo | TypeScript constant; deterministic, easy to test/PR-review; pricing can go stale; new model = code release | |
| Fetch from AI Gateway at runtime | Hit AI Gateway model-list endpoint per /settings request; fresh pricing; adds runtime dep; endpoint existence needs research | ✓ |
| Hybrid — static + live pricing | Static catalog hydrated with API pricing; most accurate, most code | |

**User's choice:** Fetch from AI Gateway at runtime.
**Notes:** Researcher must verify the exact AI Gateway model-list endpoint and response shape. If no endpoint exists, fall back to hybrid (static curated list + live hydration where possible).

### Q2 — Where does the "best for" descriptor come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated map in repo, keyed by model id | TypeScript Record; we control the language; fallback "General purpose" for absent ids | ✓ |
| Omit the field if missing | Show "best for" only for curated models; uneven UI | |
| Use AI Gateway model description if present | Whatever the gateway exposes; less work, less voice control | |

**User's choice:** Curated map in repo, keyed by model id.
**Notes:** Researcher proposes initial copy for the top ~10 expected models (Gemini Flash, Gemini Pro, Claude Sonnet, Claude Opus, GPT-4o, etc.). Fallback string: `"General purpose"`.

---

## Settings page UX

### Q3 — How should the model picker render?

| Option | Description | Selected |
|--------|-------------|----------|
| Table with radio select per row | Dense, sortable, side-by-side pricing comparison; matches Polaris convention | ✓ |
| Card grid (2 columns) | Visual; "best for" headline prominent; harder to compare pricing | |
| Dropdown + detail panel | Small footprint; forces clicks to compare | |

**User's choice:** Table with radio select per row.
**Notes:** Sortable on Context window and pricing columns. Columns: Model · Provider · Context · $/M in · $/M out · Best for · Active.

### Q4 — Where does the settings page live in the embedded admin nav?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level `/settings` route | Adds a "Settings" nav entry; Phase 8 + billing will eventually nest here | ✓ |
| Nested `/settings/model` | Reserves `/settings` as a future index; more future-proof structurally, more clicks today | |
| Inline in `/chat` (sidebar or modal) | Removes navigation; picker is one-time-per-quarter, not chat-adjacent | |

**User's choice:** Top-level `/settings` route.
**Notes:** For V1 the model picker IS `/settings` — no intermediate index page. Future nesting handled when more categories ship.

---

## Save semantics

### Q5 — When does a model selection actually persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Save button with toast | Disabled until selection differs; supports undo before commit; Polaris convention | ✓ |
| Auto-save on radio change | Immediate PATCH; no undo affordance | |
| Optimistic auto-save with inline 'undo' | Immediate PATCH + 5s undo affordance; snappier; more code | |

**User's choice:** Explicit Save button with toast.
**Notes:** Toast on success: `Model updated to <Display Name>`. Inline error banner on failure with the API error code. Matches the Shopify admin merchant mental model.

### Q6 — How tight is "playground reflects active model immediately"?

| Option | Description | Selected |
|--------|-------------|----------|
| Next chat request reflects new model | Resolver called per-request; no client-state plumbing | ✓ |
| Live update via shared store | Snappy banner re-render while looking at settings tab; requires zustand/SWR plumbing | |
| Hard page reload after Save | Simplest; feels janky | |

**User's choice:** Next playground chat request reflects the new model.
**Notes:** The Phase 4 "Active model: X" banner re-renders on the next stream automatically because `getActiveChatModel(shop)` reads DB per-request. No new client coordination required.

---

## Default seeding strategy

### Q7 — When does a shop's ShopSettings row first get written?

| Option | Description | Selected |
|--------|-------------|----------|
| Never — rely on resolver fallback | Phase 4 already returns DEFAULT_MODEL when row absent; first Save creates the row | ✓ |
| Lazy: create on first /settings page visit | First GET /settings writes the default row | |
| Eager: seed on install via OAuth post-callback | Every shop has a row from day one; needs install hook + idempotency | |

**User's choice:** Never — rely on getActiveChatModel's existing fallback.
**Notes:** Zero install-hook work; satisfies all 4 ROADMAP success criteria because the resolver's per-request DB read + DB-absent fallback already does the job. Active row pre-selection on the settings page just calls `getActiveChatModel(shop)` and matches the returned `.id` against rendered rows.

---

## Claude's Discretion

These were captured in CONTEXT.md `<decisions>` under "Claude's Discretion" — flagged here for the audit trail:

- API endpoint shape (`/api/settings/model` GET+PATCH vs `/api/settings` GET+PATCH with `{ activeChatModelId }` body)
- `model-catalog.ts` module location (`services/chat/` vs `lib/ai/`)
- AI Gateway HTTP client implementation (`fetch` directly vs a tiny client helper)
- Server-side rendering vs client-side fetching of the model list inside the settings page
- Default sort column on the table (provider alphabetical vs price ascending)

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` for future phases:

- Per-conversation model override
- Model usage analytics (alongside Phase 8 hard-cap counter)
- A/B comparison playground (side-by-side response from two models)
- Per-environment model overrides (staging vs production)
- Model search/filter on /settings (only needed if catalog > ~30 models)
- Granular admin user permissions ("only shop owner can change model")
- ShopSettingsHistory audit log table
