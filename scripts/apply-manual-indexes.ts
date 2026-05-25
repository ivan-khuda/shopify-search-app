// scripts/apply-manual-indexes.ts
//
// Applies db/manual-indexes.sql to the dev/prod Postgres database.
//
// Why this script exists (vs. invoking psql directly):
//   - psql is not on every developer's machine (03-RESEARCH.md Pitfall 5).
//   - We need a pre-flight pgvector version check before applying SQL that
//     depends on pgvector >= 0.8.0 (03-RESEARCH.md Pitfall 7 — iterative
//     scan flag is silently ignored on older versions).
//
// Connection URL resolution:
//   - Prefers DIRECT_URL when set (Prisma Accelerate setups expose the
//     non-Accelerate Postgres URL there).
//   - Falls back to DATABASE_URL when DIRECT_URL is unset.
//   - Rejects Accelerate URLs (prefix `prisma`) with an explicit error —
//     `pg.Client` cannot talk Accelerate's wire protocol.
//
// Security: NEVER logs the DATABASE_URL / DIRECT_URL value. Error messages
// reference variable names only (T-3-03).

import { readFileSync } from 'node:fs';
import 'dotenv/config';
import { Client } from 'pg';

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!url || url.startsWith('prisma')) {
    console.error(
      'DIRECT_URL or postgresql:// DATABASE_URL required — Accelerate URLs not supported by this script'
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Pre-flight: pgvector must be >= 0.8.0 (EMB-06 iterative scan flag).
    // Lexicographic string comparison is correct for single-digit semver
    // pieces in V1 — `'0.8.0' >= '0.8.0'` is true; `'0.7.4' >= '0.8.0'`
    // is false. Document and revisit if pgvector ships a 10.x release.
    const versionResult = await client.query<{ extversion: string }>(
      "SELECT extversion FROM pg_extension WHERE extname='vector'"
    );

    if (versionResult.rowCount === 0) {
      console.error(
        'pgvector extension not installed; install via CREATE EXTENSION vector and retry'
      );
      process.exit(1);
    }

    const ver = versionResult.rows[0].extversion;
    if (ver < '0.8.0') {
      console.error(
        `pgvector ${ver} found; need >= 0.8.0 for hnsw.iterative_scan (EMB-06)`
      );
      process.exit(1);
    }

    const sql = readFileSync('db/manual-indexes.sql', 'utf8');
    await client.query(sql);

    console.log('manual indexes applied');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
