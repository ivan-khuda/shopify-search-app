/**
 * In-memory sliding-window rate limiter for storefront-side routes (D-08).
 *
 * Two buckets per CONTEXT D-08:
 *   - `chat`: 30 requests / 5 minutes per visitor (retry after 60s)
 *   - `read`: 60 requests / 60 seconds per visitor (retry after 30s)
 *
 * Counters live in a module-scope `Map` keyed by `${visitorId}:${bucket}`.
 * Each call lazily prunes timestamps older than the bucket's window — there
 * is no background `setInterval` sweeper (D-08 explicitly accepts the
 * lazy-prune model).
 *
 * Limitations (RESEARCH Pitfall 9):
 *   - In-memory only. Vercel serverless cold starts reset the Map.
 *   - No cross-instance enforcement. Two parallel function invocations
 *     can each independently count up to `limitPerWindow`.
 *   - Phase 8 will introduce a DB-backed RequestCounter that supersedes
 *     this module for cross-instance limits.
 *
 * Memory bound: per (visitor, bucket) the array can hold at most
 * `limitPerWindow` timestamps — older entries are filtered out on every
 * call. An adversary cannot make the Map grow unboundedly per key.
 */

export const BUCKETS: Record<
  'chat' | 'read',
  { limitPerWindow: number; windowMs: number; retryAfterSeconds: number }
> = {
  chat: { limitPerWindow: 30, windowMs: 5 * 60_000, retryAfterSeconds: 60 },
  read: { limitPerWindow: 60, windowMs: 60_000, retryAfterSeconds: 30 },
};

const hits = new Map<string, number[]>();

/**
 * @internal
 * Clears all in-memory rate-limit state. Exported solely so unit tests that
 * use vi.useFakeTimers() (which resets Date.now() to 0 each test) can ensure
 * a clean Map between cases. Do NOT call from production code.
 */
export function __resetRateLimitForTests(): void {
  hits.clear();
}

export function rateLimit(
  visitorId: string,
  bucket: keyof typeof BUCKETS
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const cfg = BUCKETS[bucket];
  const now = Date.now();
  const key = `${visitorId}:${bucket}`;

  const arr = hits.get(key) ?? [];
  // Keep only timestamps in (now - windowMs, now]. Discarding future-looking
  // timestamps (t > now) makes the limiter robust to clock resets — e.g.
  // tests using vi.useFakeTimers() that reset Date.now() across cases.
  const fresh = arr.filter((t) => t <= now && now - t < cfg.windowMs);

  if (fresh.length >= cfg.limitPerWindow) {
    hits.set(key, fresh);
    return { ok: false, retryAfterSeconds: cfg.retryAfterSeconds };
  }

  fresh.push(now);
  hits.set(key, fresh);
  return { ok: true };
}
