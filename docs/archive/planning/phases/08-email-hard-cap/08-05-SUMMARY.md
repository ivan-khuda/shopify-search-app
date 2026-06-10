---
phase: 08-email-hard-cap
plan: 05
subsystem: email
tags: [phase-08, email, react-email, templates]
requires:
  - 08-01 (Wave 0 RED template tests)
  - 08-04 (stub templates that resolved the EmailService import-analysis)
provides:
  - lib/email/templates/SyncSuccessEmail.tsx (real React Email component, replaces stub)
  - lib/email/templates/SyncFailureEmail.tsx (real React Email component, replaces stub)
  - SyncSuccessEmailProps interface (shop, productCount, adminUrl)
  - SyncFailureEmailProps interface (shop, syncRunId, errorMessage, retryUrl)
affects:
  - Wave 0 template tests (lib/email/templates/__tests__/): RED → GREEN (12/12 passing)
  - Wave 4a EmailService (08-04): no change — already imports these modules; behaviour shift is template body only
tech-stack:
  added: []  # @react-email/components and @react-email/render already in package.json from 08-04
  patterns:
    - "React Email primitives only (Html/Head/Body/Container/Section/Text/Button/Hr)"
    - "Inline style objects (React Email convention — NO className)"
    - "Auto-escaped Text node children — never dangerouslySetInnerHTML"
key-files:
  created: []
  modified:
    - lib/email/templates/SyncSuccessEmail.tsx
    - lib/email/templates/SyncFailureEmail.tsx
decisions:
  - "Inline V1 omits any wordmark/image entirely per D-07 (deferred to polish iteration)"
  - "syncRunId prop accepted in SyncFailureEmail but unrendered — reserved for future observability surface"
metrics:
  duration: ~5 min
  completed: 2026-05-27
requirements: [NOT-01, NOT-02, NOT-03]
---

# Phase 8 Plan 05: React Email Templates Summary

Replaced 08-04 stub templates with real React Email components matching D-07 minimal-transactional brief; both Wave 0 template test files flipped RED → GREEN.

## What Changed

**`lib/email/templates/SyncSuccessEmail.tsx`** — Now renders:
- `Html` → `Head` → `Body` → `Container` hierarchy
- "Catalog sync complete" heading (20px, semibold)
- Body line: "SmartDiscovery AI synced {productCount} products from {shop}."
- "View in admin" Button with `href={adminUrl}` (brand color #008060)
- `Hr` + footer "SmartDiscovery AI · transactional notification" (#9ca3af, 12px)

**`lib/email/templates/SyncFailureEmail.tsx`** — Now renders:
- Same layout shell, but heading "Catalog sync failed" is red (#b91c1c)
- One-line apology referencing {shop}
- `{errorMessage}` rendered as a boxed Text node (#f3f4f6 background, 12px padding) — auto-escaped by React Email
- "Retry sync" Button with `href={retryUrl}` (D-06 retry pattern; URL itself constructed by the 08-12 Inngest function as `${HOST}/onboarding?retry=${syncRunId}`)
- Matching footer

Both files use `@react-email/components` primitives exclusively. No `lucide-react`, no `radix`, no `tailwind`, no `next`. Inline style objects only — zero `className=`.

## Verification

| Check                                                          | Result          |
| -------------------------------------------------------------- | --------------- |
| `bunx vitest run lib/email/templates/__tests__/`               | 12/12 GREEN     |
| `bunx tsc --noEmit` (filtered to lib/email/templates)          | clean           |
| `grep "console\."` in templates                                | empty           |
| `grep "dangerouslySetInnerHTML\s*=` (JSX attribute) in templates | empty         |
| `grep "className=` in templates                                | empty           |

All success criteria from PLAN met:
- [x] NOT-03 satisfied (templates at `lib/email/templates/` as React Email components)
- [x] D-07 minimal-transactional brief honored (no images, no marketing copy)
- [x] D-06 retry pattern (template receives precomputed retryUrl; doesn't construct)
- [x] V5 Input Validation / T-08-05-T1 mitigated (Text-node auto-escape; no `dangerouslySetInnerHTML`)
- [x] Wave 0 template tests RED → GREEN (12 cases across both files)

## Deviations from Plan

None — plan executed exactly as written. Style values, copy strings, brand color #008060, and prop shapes all match 08-RESEARCH §Code Examples verbatim.

## Threat Mitigations Applied

| Threat ID    | Mitigation                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-08-05-T1   | `{errorMessage}` rendered as React Email `Text` child — auto-escaped by `@react-email/render`. JSDoc comment in `SyncFailureEmail.tsx` documents the prohibition. Grep verified. |
| T-08-05-T2   | Subjects ("Catalog sync complete — N products", "Catalog sync failed") composed in EmailService (08-04), not in templates. No header injection surface here.                  |

## Commits

- `68fc7b6` feat(08-05-01): replace stub with SyncSuccessEmail React Email template (NOT-01, D-07)
- `53ccc77` feat(08-05-02): replace stub with SyncFailureEmail React Email template (NOT-02, D-06, D-07)

## TDD Gate Compliance

Templates depended on RED tests from Wave 0 (Plan 08-01), so the test-first ordering was already in place when this plan ran. Both `feat(...)` commits flip the existing RED tests to GREEN — no new test commits needed in this plan.

## Self-Check: PASSED

- [x] `lib/email/templates/SyncSuccessEmail.tsx` exists with `SyncSuccessEmail` + `SyncSuccessEmailProps` exports
- [x] `lib/email/templates/SyncFailureEmail.tsx` exists with `SyncFailureEmail` + `SyncFailureEmailProps` exports
- [x] Commit `68fc7b6` present in `git log`
- [x] Commit `53ccc77` present in `git log`
- [x] 12/12 template tests passing
- [x] No `dangerouslySetInnerHTML` JSX attribute in either template
- [x] No `console.*` in either template
- [x] No `className=` in either template
