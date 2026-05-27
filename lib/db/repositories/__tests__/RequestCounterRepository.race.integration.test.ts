/**
 * Phase 8 Wave 0 OPTIONAL race-condition integration test — anchors SC4.
 *
 * Deferred-acceptable per 08-CONTEXT.md Open Question 3 resolution: runs only
 * when INTEGRATION_DB_URL is set, otherwise SKIPPED and the verification gate
 * substitutes a manual-smoke entry.
 *
 * What it asserts: at requestCount = cap - 1, N=200 concurrent tryConsume
 * calls produce EXACTLY ONE winner. This is the empirical proof that the
 * INSERT … ON CONFLICT … DO UPDATE … WHERE "requestCount" < cap RETURNING
 * primitive (D-11) is serialized by Postgres.
 *
 * Setup pre-condition (when INTEGRATION_DB_URL is present):
 *   - The `request_counter` table exists with composite PK (shop, period).
 *     If not, this test will fail at the seed step — that's the correct
 *     signal: run the Phase 8 migration first (Plan 08-06).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const INTEGRATION_DB_URL = process.env.INTEGRATION_DB_URL;
const TEST_SHOP = 'race-test-shop.myshopify.com';
const TEST_PERIOD = '2026-05';
const CAP = 100;
const CONCURRENCY = 200;

// Note: describe.skipIf is the Vitest >=0.34 API. It skips the entire block
// (no it() bodies run) when the predicate is true. We invert: skipIf(!url).
describe.skipIf(!INTEGRATION_DB_URL)('RequestCounterRepository — race condition (real Postgres, SC4)', () => {
  // Implementation will land in Plan 08-07 alongside the repository. Until
  // then, the import below will fail when INTEGRATION_DB_URL is set — that
  // is the expected RED signal for operators running with the integration
  // flag. In default local dev (no flag), the block is fully skipped.

  let prismaClient: { $queryRaw: (...args: unknown[]) => Promise<unknown[]>; $disconnect: () => Promise<void> } | null = null;
  let tryConsumeFn:
    | ((shop: string, period: string, cap: number) => Promise<{ allowed: true; requestCount: number } | { allowed: false }>)
    | null = null;

  beforeAll(async () => {
    // Dynamic imports so the file doesn't crash at load when modules are
    // not yet on disk and the block is otherwise skipped. The variable
    // indirection prevents Vite's static import-analysis from trying to
    // resolve the (not-yet-existing) module specifier at transform time.
    const repoSpec = '@/lib/db/repositories/' + 'RequestCounterRepository';
    const dbSpec = '@/lib/db/' + 'client';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold: module does not exist yet (Plan 08-07).
    const repoMod = await import(/* @vite-ignore */ repoSpec);
    tryConsumeFn = repoMod.requestCounterRepository.tryConsume.bind(
      repoMod.requestCounterRepository,
    );
    const dbMod = await import(/* @vite-ignore */ dbSpec);
    prismaClient = dbMod.prisma as unknown as typeof prismaClient;
  });

  afterAll(async () => {
    if (prismaClient) {
      // Cleanup test row
      try {
        await prismaClient.$queryRaw`
          DELETE FROM request_counter WHERE shop = ${TEST_SHOP} AND period = ${TEST_PERIOD}
        `;
      } catch {
        // best-effort cleanup
      }
    }
  });

  it('at count = cap - 1, exactly 1 of N concurrent tryConsume calls wins', async () => {
    if (!prismaClient || !tryConsumeFn) throw new Error('beforeAll did not initialize');

    // Seed the row at (cap - 1)
    await prismaClient.$queryRaw`
      INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
      VALUES (${TEST_SHOP}, ${TEST_PERIOD}, ${CAP - 1}, NOW())
      ON CONFLICT (shop, period) DO UPDATE
        SET "requestCount" = ${CAP - 1}, "updatedAt" = NOW()
    `;

    // Fire CONCURRENCY parallel attempts.
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => tryConsumeFn!(TEST_SHOP, TEST_PERIOD, CAP)),
    );

    const winners = results.filter((r) => r.allowed === true);
    const losers = results.filter((r) => r.allowed === false);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(CONCURRENCY - 1);

    // The single winner's reported requestCount must equal cap.
    expect((winners[0] as { allowed: true; requestCount: number }).requestCount).toBe(CAP);
  }, 30_000);
});
