# Plan 02-02 Summary

**Status:** complete
**Wave:** 1
**Requirements:** SYN-04 (covers D-03, D-07, D-17)

## What shipped

`prisma/schema.prisma` extended with Phase 2 additions:
- `enum SyncState { queued, running, succeeded, failed, partial }`
- `model SyncRun` — `id @id @default(cuid())`, `shop`, `state @default(queued)`, `processedCount @default(0)`, `totalCount?`, `errors String[] @default([])`, `cursor?`, `idempotencyKey @unique`, `startedAt @default(now())`, `finishedAt?`, `@@index([shop])`, `@@map("sync_runs")`
- `model WebhookEvent` — `eventId @id`, `shop`, `topic`, `receivedAt @default(now())`, `@@index([shop])`, `@@map("webhook_events")`
- `Product.updatedAtShopify DateTime?` (D-17 — SYN-11 conflict resolution column)

Migration SQL at `prisma/migrations/20260523152414_add_sync_pipeline/migration.sql`:
- ADDITIVE only (zero DROP statements)
- `CREATE TYPE SyncState`
- `CREATE TABLE sync_runs` + `CREATE TABLE webhook_events`
- `ALTER TABLE products ADD COLUMN updatedAtShopify TIMESTAMP(3)`
- 3 indexes: `sync_runs_idempotencyKey_key` (unique), `sync_runs_shop_idx`, `webhook_events_shop_idx`
- Header documents the additive intent + errors[] JSON-encoding convention

## Verification

- `bunx prisma validate` → schema valid
- grep gates: 1 each of `enum SyncState`, `model SyncRun`, `model WebhookEvent`, `updatedAtShopify`; 0 DROPs in migration; 1 ADDITIVE comment
- Phase 1 models untouched (verified by inspection — only additions)

## Notes

Migration NOT yet applied — Plan 02-04 is the human-action checkpoint that runs `bunx prisma migrate dev --name add_sync_pipeline`.

## Handoff

- Plan 02-04: applies the migration + regenerates Prisma client
- Plan 02-05: `ProductUpsertInput` grows `updatedAtShopify?` field; `mapToUpsertInput` sets it from `node.updatedAt`
- Plan 02-07: `prisma.syncRun.findFirst` + `prisma.syncRun.create` consume the new model
- Plan 02-09: `prisma.webhookEvent.create` + P2002 dedup pattern consumes WebhookEvent
