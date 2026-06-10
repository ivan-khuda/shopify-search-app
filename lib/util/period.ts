/**
 * Period derivation helper — single source of truth for the YYYY-MM string.
 *
 * D-12 (calendar-month reset): per-shop request counters are scoped to a
 * UTC calendar month. The period key is the YYYY-MM substring of the ISO
 * timestamp; rollovers happen at 00:00:00Z on the 1st of each month.
 *
 * Pitfall 7 (UTC-by-construction): a naive `getFullYear() + '-' + getMonth()`
 * uses the server's local timezone and would slip a month near midnight UTC
 * on a non-UTC server. `Date#toISOString()` is always UTC by spec, so
 * `slice(0, 7)` is byte-precise — the ISO format
 * `"YYYY-MM-DDTHH:MM:SS.sssZ"` guarantees chars 0..6 are the UTC YYYY-MM.
 *
 * Default-arg DI pattern: tests pass an explicit `now` Date for deterministic
 * boundary assertions without needing `vi.useFakeTimers`.
 *
 * @param now - Date to derive the period from. Defaults to `new Date()`.
 * @returns YYYY-MM UTC string (exactly 7 chars).
 */
export function getCurrentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
