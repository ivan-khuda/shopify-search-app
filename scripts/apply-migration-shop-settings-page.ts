/**
 * One-off script: apply 20260612000001_shop_settings_page migration manually.
 * Dev DB has pgvector index drift — prisma migrate dev refuses.
 * Following precedent from 20260611000001_shop_settings_appearance.
 *
 * Run: bunx tsx scripts/apply-migration-shop-settings-page.ts
 * Delete after use.
 */
import 'dotenv/config';
import { Client } from 'pg';

const MIGRATION_NAME = '20260612000001_shop_settings_page';

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url || url.startsWith('prisma')) {
    throw new Error('Set DIRECT_URL or DATABASE_URL to a direct postgresql:// URL');
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Check if already applied
    const existing = await client.query(
      `SELECT migration_name FROM _prisma_migrations WHERE migration_name = $1`,
      [MIGRATION_NAME],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log('Migration already applied — skipping.');
      return;
    }

    console.log(`Applying migration: ${MIGRATION_NAME}`);

    const statements = [
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "drawerAccent" TEXT NOT NULL DEFAULT '#5B4FE9'`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "greetingMessage" VARCHAR(200)`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "suggestedPrompts" JSONB NOT NULL DEFAULT '[]'`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "monthlyCapRequests" INTEGER`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "notificationEmail" TEXT`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "drawerEnabled" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "editorPreviewVisible" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "request_counter" ADD COLUMN IF NOT EXISTS "adminRequestCount" INTEGER NOT NULL DEFAULT 0`,
    ];

    for (const sql of statements) {
      console.log(`  ${sql.slice(0, 80)}...`);
      await client.query(sql);
    }

    // Insert _prisma_migrations row — copying shape from existing manual row
    await client.query(`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual',
        NOW(),
        $1,
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING
    `, [MIGRATION_NAME]);

    console.log('Migration applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
