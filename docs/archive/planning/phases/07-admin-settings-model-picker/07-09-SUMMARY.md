---
phase: 07-admin-settings-model-picker
plan: 09
subsystem: embedded-admin-nav
tags: [nav, embedded, settings, D-05]
requires:
  - app/(embedded)/EmbeddedProviders.tsx (Phase 6)
  - app/(embedded)/settings/page.tsx (Plan 07-08)
provides:
  - Embedded admin nav entry linking to /settings (D-05 complete)
affects:
  - app/(embedded)/EmbeddedProviders.tsx
tech-stack:
  added: []
  patterns:
    - "<s-link> child of <s-app-nav> for top-level admin navigation"
key-files:
  created: []
  modified:
    - app/(embedded)/EmbeddedProviders.tsx
decisions:
  - "D-05: Settings is a top-level nav entry appended after Onboarding (preserving Search rel='home' as the home anchor)"
metrics:
  duration: "<1m"
  completed: 2026-05-27
requirements: [ADM-03]
---

# Phase 7 Plan 9: Embedded Admin Nav — Settings Entry Summary

One-liner: Appends `<s-link href="/settings">Settings</s-link>` to the existing `<s-app-nav>` block in `EmbeddedProviders.tsx`, fulfilling D-05.

## Change

### Before

```tsx
<s-app-nav>
  <s-link href="/chat" rel="home">Search</s-link>
  <s-link href="/onboarding">Onboarding</s-link>
</s-app-nav>
```

### After

```tsx
<s-app-nav>
  <s-link href="/chat" rel="home">Search</s-link>
  <s-link href="/onboarding">Onboarding</s-link>
  <s-link href="/settings">Settings</s-link>
</s-app-nav>
```

Nav order preserved: Search (rel='home') → Onboarding → Settings. The `rel='home'` anchor remains on Search; no other attributes touched.

## D-05 Fulfillment

D-05 ("Settings is a top-level nav entry, route `/settings`, listed alongside Chat and Onboarding") is now complete:

- Route exists: `app/(embedded)/settings/page.tsx` (Plan 07-08).
- Nav entry exists: `<s-link href="/settings">Settings</s-link>` in `EmbeddedProviders.tsx` (this plan).
- Discoverable from any embedded page without manual URL entry.

## Verification

- `grep -c 'href="/settings"' app/(embedded)/EmbeddedProviders.tsx` → `1`.
- `bunx tsc --noEmit` produced no new errors referencing `EmbeddedProviders.tsx`. Pre-existing errors in unrelated files (test config, `@jenius/ui` imports in `components/ai-elements/reasoning.tsx`, `__tests__/shopify-toml.test.ts` regex flag) are out of scope for this plan.
- Order asserted: grep of `s-link` lines returns Search, Onboarding, Settings in that order on lines 5–7.
- No test file references `EmbeddedProviders` or `s-app-nav`; nothing to re-run at this layer.

## Deviations from Plan

None — plan executed exactly as written. One JSX line appended; no other files touched.

## Wave 3 Status

Wave 3 complete. Phase 7 ready for the verification gate (Plan 07-10).

## Self-Check: PASSED

- File modified: `app/(embedded)/EmbeddedProviders.tsx` — verified present, contains `href="/settings"` exactly once.
- Commit recorded below in completion output.
