---
phase: 07-admin-settings-model-picker
plan: 02
subsystem: schema + types
tags: [prisma, shop-settings, jsx-intrinsics, polaris-web-components]
requirements: [ADM-03, ADM-04]
dependency_graph:
  requires:
    - 07-01 (RED scaffolds — settings page/form/repo test files already reference these symbols)
  provides:
    - prisma.shopSettings (after Plan 07-03 generate)
    - JSX.IntrinsicElements augmentation for s-table family + s-choice-list + ui-save-bar
  affects:
    - 07-03 (BLOCKING — runs prisma migrate dev + generate to materialize the schema diff into a live table + typed client)
    - 07-05 (ShopSettingsRepository uses prisma.shopSettings)
    - 07-06 (getActiveChatModel body swap reads prisma.shopSettings)
    - 07-07 (PATCH /api/settings/model upserts prisma.shopSettings)
    - 07-08 (settings-form.tsx renders <s-table>, <s-choice-list>, <ui-save-bar>)
tech-stack:
  added: []
  patterns:
    - "Single-PK shop-keyed singleton model (mirrors ShopifySession)"
    - "JSX intrinsic augmentation for Polaris web components (CDN-loaded at runtime via app/(embedded)/layout.tsx)"
key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - types/shopify-global.d.ts
decisions:
  - "D-10 minimal V1 shape locked: shop @id + activeChatModelId + updatedAt only (no createdAt, no customerId, no displayName)"
  - "Catalog is source of truth for displayName — never persisted alongside activeChatModelId"
  - "@@map(\"shop_settings\") snake_case to match project convention"
  - "Schema-write vs schema-apply split: Plan 07-02 writes schema, Plan 07-03 [BLOCKING] applies migration + regenerates client"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 2
  completed: 2026-05-27
---

# Phase 7 Plan 02: Prisma schema + JSX intrinsics Summary

Wave 1a — added the `ShopSettings` Prisma model to the schema and augmented `React.JSX.IntrinsicElements` with the Polaris `s-table` family, `s-choice-list`, `s-choice`, and `ui-save-bar` web components so Wave 2 (repo/resolver) and Wave 3 (settings UI) can typecheck against `prisma.shopSettings` and render the table/picker without "Property does not exist" errors.

## Outcomes

### Task 1: Append `ShopSettings` model (D-10 exact shape)

The exact 3-line model body appended after `VisitorCustomerLink` in `prisma/schema.prisma`:

```prisma
model ShopSettings {
  shop              String   @id
  activeChatModelId String
  updatedAt         DateTime @updatedAt

  @@map("shop_settings")
}
```

- `prisma validate` reports success.
- No `createdAt`, no `customerId`, no `displayName` — matches D-10 verbatim.
- No `@@index([shop])` — `shop` is the PK; Postgres builds a btree automatically.
- Commit: `2f68700` — `feat(07-02-01): add ShopSettings prisma model (D-10)`

### Task 2: JSX intrinsic declarations for Polaris s-table + s-choice-list + ui-save-bar

Added 10 new tags inside `declare global → namespace React → namespace JSX → interface IntrinsicElements` in `types/shopify-global.d.ts`, each typed as `PolarisIntrinsicProps`:

1. `'s-table'`
2. `'s-table-header-row'`
3. `'s-table-header'`
4. `'s-table-body'`
5. `'s-table-row'`
6. `'s-table-cell'`
7. `'s-choice-list'`
8. `'s-choice'`
9. `'ui-save-bar'`
10. `'s-text-field'` (defensive — Polaris docs reference; cheap to add now)

Confirmed by `grep -c "'s-table'" types/shopify-global.d.ts` → ≥1, and all 10 tags present in the file.

`bunx tsc --noEmit` does not produce any new errors mentioning the added intrinsics (grep on the noEmit output for `'s-(table|choice|...)'|'ui-save-bar'` returns empty). Pre-existing errors are confirmed unrelated:
- es2018 regex flag errors in `__tests__/shopify-toml.test.ts` (pre-existing, tracked separately)
- Module-not-found in `components/ai-elements/reasoning.tsx` (pre-existing `@jenius/ui/*` import, tracked separately)
- `chat-ui` test type errors (pre-existing)
- `Property 'shopSettings' does not exist on type 'PrismaClient'` and missing-module errors in Plan 07-01 RED scaffolds — **expected and intentional**: Plan 07-03 regenerates the client (resolves `shopSettings`); Waves 2-3 create the referenced modules (`model-catalog`, `ShopSettingsRepository`, settings page/form, model PATCH route).

Commit: `22314ff` — `feat(07-02-02): add Polaris s-table + s-choice-list + ui-save-bar JSX intrinsics`

## Deviations from Plan

None — plan executed exactly as written. Both task verifications passed on first run.

## Threat Model Compliance

| Threat ID | Mitigation status |
| --- | --- |
| T-07-02-01 (Tampering — `@updatedAt` missing) | Mitigated: schema declares `updatedAt DateTime @updatedAt`; `prisma validate` enforces presence. |
| T-07-02-02 (Repudiation — extra `createdAt` blurs audit) | Mitigated: model contains exactly 3 columns; no `createdAt` added. |
| T-07-02-03 (Info disclosure — `@unique` on `activeChatModelId`) | Mitigated: only `shop` is the PK; `activeChatModelId` is intentionally non-unique. |
| T-07-02-04 (Tampering — misnamed `@@map`) | Mitigated: `@@map("shop_settings")` written exactly; Plan 07-03 will assert via `\dt`. |
| T-07-02-SC (Supply chain — npm installs) | Accepted: no new packages installed. |

## Handoff Note: Plan 07-03 is [BLOCKING] for Wave 2 and beyond

Plan 07-03 must run before any of Plans 04–10 can execute their non-test code:

- `bunx prisma migrate dev --name add_shop_settings` — materializes the schema diff into a Postgres table.
- `bunx prisma generate` — regenerates `app/generated/prisma/` so `prisma.shopSettings` becomes a valid property on `PrismaClient`.

Until 07-03 completes, the following expected TS errors remain (and are NOT regressions from this plan):
- `Property 'shopSettings' does not exist on type 'PrismaClient'` — resolves after `prisma generate`.

## Self-Check: PASSED

- File existence:
  - FOUND: prisma/schema.prisma (model ShopSettings present at line 256)
  - FOUND: types/shopify-global.d.ts (10 new tags present)
  - FOUND: .planning/phases/07-admin-settings-model-picker/07-02-SUMMARY.md
- Commits present in `git log --oneline -3`:
  - FOUND: 2f68700 — feat(07-02-01): add ShopSettings prisma model (D-10)
  - FOUND: 22314ff — feat(07-02-02): add Polaris s-table + s-choice-list + ui-save-bar JSX intrinsics
- `bunx prisma validate` — exits 0, schema valid.
- `bunx tsc --noEmit` — zero errors mentioning any newly added intrinsic; pre-existing unrelated errors persist as expected.
