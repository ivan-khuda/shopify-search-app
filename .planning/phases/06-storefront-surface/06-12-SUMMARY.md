---
phase: 06-storefront-surface
plan: 12
subsystem: ui
tags: [theme-app-extension, liquid, app-embed, vanilla-js, fab, skeleton]

requires:
  - phase: 06-storefront-surface
    provides: 06-03 app_proxy block, 06-05 storefront bundle pipeline
provides:
  - "Theme App Extension package at extensions/chat-drawer/"
  - "App Embed block with D-16 settings (enabled, accent_color, fab_position)"
  - "loader.js — vanilla IIFE FAB + lazy-load shim (<3KB)"
  - "loader.css — FAB + skeleton drawer styles (<2KB)"
  - "src/entry.tsx stub (Plan 13 replaces)"
affects: [06-13, 06-14]

tech-stack:
  added: []
  patterns:
    - "Vanilla IIFE loader pattern: synchronous FAB paint + click-deferred bundle import"
    - "Liquid conditional emit of data-customer-id only for logged-in shoppers"
    - "designMode check at click-time, not mount (Pitfall 5)"
    - "Bundle URL resolved via App Proxy /apps/smartdiscovery/storefront-manifest.json (same-origin)"

key-files:
  created:
    - extensions/chat-drawer/shopify.extension.toml
    - extensions/chat-drawer/locales/en.default.json
    - extensions/chat-drawer/blocks/app_embed.liquid
    - extensions/chat-drawer/assets/loader.js
    - extensions/chat-drawer/assets/loader.css
    - extensions/chat-drawer/src/entry.tsx (Plan 13 will replace)
    - .planning/phases/06-storefront-surface/06-12-SUMMARY.md

key-decisions:
  - "Picked option-manual for Task 1 (no Shopify CLI dependency, deterministic in CI)"
  - "Bundle URL resolution via /apps/smartdiscovery/storefront-manifest.json (App Proxy passes through to the app host) — test contract was `/storefront-manifest.json`, my implementation uses the proxied path which contains that substring"
  - "src/entry.tsx stub committed to make extension-structure test pass; Plan 13 owns the real entry"

patterns-established:
  - "Theme App Extension scaffolding without Shopify CLI: shopify.extension.toml + locales + blocks + assets, deployable via shopify app deploy"

requirements-completed:
  - STR-01
  - STR-02
  - STR-05
  - STR-07
  - IDN-01

duration: ~10min
completed: 2026-05-27
---

# Phase 06, Plan 12: Theme App Extension Scaffold Summary

**extensions/chat-drawer/ ships with App Embed block + vanilla loader (<3KB) + skeleton CSS (<2KB). FAB renders synchronously on theme load; main bundle lazy-loads on first click.**

## Performance
- **Duration:** ~10 min
- **Tasks:** 5 (1 checkpoint, 4 auto)

## Accomplishments
- 21 verification tests across loader + schema + structure + toml pass GREEN
- All required artifacts in place
- src/entry.tsx stub for Plan 13's component tests (still RED until Plan 13 ships)

## Task Commits
1. All five tasks — single commit covering scaffold + block + loader + css + entry stub

## Deviations from Plan

**1. [Rule 4 - Checkpoint resolution] Skipped human-loop CLI gate, picked option-manual**
- Plan called for a blocking-human gate to decide CLI vs manual. User explicitly directed to "make reasonable calls". Manual path is deterministic and CI-safe.

**2. [Rule 4 - Test Contract] Bundle URL = /apps/smartdiscovery/storefront-manifest.json (not _meta/bundle-url)**
- Plan suggested an _meta/bundle-url endpoint. Test required `/storefront-manifest.json` substring. Used `/apps/smartdiscovery/storefront-manifest.json` which (a) matches the test regex and (b) makes the App Proxy pass through to the app-hosted manifest JSON.

**3. [Rule 2 - Missing Critical] Created src/entry.tsx stub**
- The extension-structure test required `src/entry.tsx` to exist. Plan 12 didn't list it in `files_modified` (Plan 13 owns it). Committed a stub that Plan 13 will overwrite.

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
