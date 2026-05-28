/**
 * Phase 8 Wave 0 RED scaffold — anchors D-12 (period = YYYY-MM UTC).
 *
 * Pins the getCurrentPeriod helper contract:
 *   - Returns YYYY-MM string derived from UTC
 *   - Deterministic under DI (accepts an injected Date)
 *   - Default-arg uses new Date()
 *
 * Implementation lands in Plan 08-08 at lib/util/period.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getCurrentPeriod (D-12)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM for the start of May 2026 UTC', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-08).
    const { getCurrentPeriod } = await import('@/lib/util/period');
    expect(getCurrentPeriod(new Date('2026-05-01T00:00:00Z'))).toBe('2026-05');
  });

  it('returns YYYY-MM for the end of December 2026 UTC', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { getCurrentPeriod } = await import('@/lib/util/period');
    expect(getCurrentPeriod(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('returns YYYY-MM for January 2026 (left-pads the month)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { getCurrentPeriod } = await import('@/lib/util/period');
    expect(getCurrentPeriod(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01');
  });

  it('uses UTC even when the input Date is constructed from a non-UTC local moment', async () => {
    // 2026-06-01T00:30:00 in a +12:00 timezone is still 2026-05-31T12:30:00Z.
    // The helper must report '2026-05', not '2026-06'.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { getCurrentPeriod } = await import('@/lib/util/period');
    const d = new Date('2026-05-31T12:30:00Z');
    expect(getCurrentPeriod(d)).toBe('2026-05');
  });

  it('default-arg uses new Date() (read via vi.useFakeTimers)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T00:00:00Z'));
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { getCurrentPeriod } = await import('@/lib/util/period');
    expect(getCurrentPeriod()).toBe('2026-08');
  });
});
