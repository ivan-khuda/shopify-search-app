import { prisma } from '@/lib/db/client';

/**
 * RequestCounterRepository — atomic per-shop, per-period counter primitive.
 *
 * Contract (Phase 8 D-11, CAP-01 / CAP-03, SC4):
 * - `tryConsume(shop, period, cap)`: atomically increments the counter for
 *   `(shop, period)` IFF the current value is below `cap`. Returns
 *   `{ allowed: true, requestCount }` on success, `{ allowed: false }` when
 *   the cap has been reached.
 *
 * Why a single $queryRaw INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING?
 *
 * Per Postgres documentation, `INSERT … ON CONFLICT DO UPDATE` resolves the
 * conflict atomically: only one of any number of concurrent transactions
 * touching the same conflicting row will succeed without seeing a stale value,
 * because Postgres serializes the conflict resolution through row-level locks
 * acquired during the conflict check (Pattern 4 in 08-RESEARCH.md).
 *
 * Adding `WHERE request_counter."requestCount" < ${cap}` to the DO UPDATE
 * clause makes the increment-vs-reject decision part of the same atomic
 * statement. When the predicate is false, the UPDATE is a no-op and no row is
 * returned by `RETURNING` — that absence is how we signal "cap reached".
 *
 * Anti-Pattern 1 (forbidden): a SELECT-then-UPDATE flow opens a TOCTOU race
 * window at cap-1 — two concurrent requests can both SELECT count = cap-1,
 * both pass the application-level check, and both UPDATE to cap+1, leaking
 * one request over the cap.
 *
 * Anti-Pattern 5 (forbidden): `prisma.requestCounter.upsert()` cannot express
 * the `WHERE "requestCount" < cap` predicate on the UPDATE branch — the typed
 * upsert always overwrites. Raw SQL is the contract.
 *
 * Notes on the SQL:
 * - `$queryRaw` (not `$executeRaw`) — we need the RETURNING row set back;
 *   `$executeRaw` discards the result set and returns only the row count.
 * - Tagged-template `${...}` interpolations are parameter-bound by Prisma —
 *   SQL-injection safe even for caller-supplied `shop` / `period`.
 * - Column identifiers `"requestCount"` and `"updatedAt"` are double-quoted to
 *   match Prisma's case-sensitive Postgres column casing (the migration in
 *   08-03 created them as quoted camelCase identifiers).
 *
 * Multi-tenancy: the composite PK `(shop, period)` makes cross-shop counter
 * mutation structurally impossible — every UPDATE targets exactly the row for
 * the bound `(shop, period)` tuple.
 */
export class RequestCounterRepository {
  async tryConsume(
    shop: string,
    period: string,
    cap: number,
  ): Promise<{ allowed: true; requestCount: number } | { allowed: false }> {
    const rows = await prisma.$queryRaw<{ requestCount: number }[]>`
      INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
      VALUES (${shop}, ${period}, 1, NOW())
      ON CONFLICT (shop, period) DO UPDATE
        SET "requestCount" = request_counter."requestCount" + 1,
            "updatedAt" = NOW()
        WHERE request_counter."requestCount" < ${cap}
      RETURNING "requestCount"
    `;

    if (rows.length === 0) {
      return { allowed: false };
    }

    return { allowed: true, requestCount: Number(rows[0].requestCount) };
  }
}

export const requestCounterRepository = new RequestCounterRepository();
