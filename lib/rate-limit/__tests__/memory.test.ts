/**
 * RED scaffold for D-08 — sliding-window rate limiting.
 * Tests fail with "Cannot find module" until Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { rateLimit } from '@/lib/rate-limit/memory';

const VISITOR_CHAT = 'visitor-chat-001';
const VISITOR_READ = 'visitor-read-001';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit — chat bucket (30 req / 5 min)', () => {
  it('allows 30 chat requests within 5 minutes for the same visitor', () => {
    for (let i = 0; i < 30; i++) {
      const result = rateLimit(VISITOR_CHAT, 'chat');
      expect(result.ok).toBe(true);
    }
  });

  it('returns { ok: false, retryAfterSeconds: 60 } on the 31st chat request within 5 minutes', () => {
    for (let i = 0; i < 30; i++) {
      rateLimit(VISITOR_CHAT, 'chat');
    }
    const result = rateLimit(VISITOR_CHAT, 'chat');
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeDefined();
    expect((result as { ok: false; retryAfterSeconds: number }).retryAfterSeconds).toBe(60);
  });

  it('resets the window after 5 minutes have elapsed', () => {
    for (let i = 0; i < 30; i++) {
      rateLimit(VISITOR_CHAT, 'chat');
    }
    // Advance time past the 5-minute window
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const result = rateLimit(VISITOR_CHAT, 'chat');
    expect(result.ok).toBe(true);
  });

  it('tracks different visitors independently (no cross-contamination)', () => {
    // Fill up visitor A's chat bucket
    for (let i = 0; i < 30; i++) {
      rateLimit(VISITOR_CHAT, 'chat');
    }
    // A 31st for visitor A should fail
    expect(rateLimit(VISITOR_CHAT, 'chat').ok).toBe(false);

    // But visitor B is unaffected
    expect(rateLimit('visitor-b', 'chat').ok).toBe(true);
  });
});

describe('rateLimit — read bucket (60 req / 1 min)', () => {
  it('allows 60 read requests within 1 minute for the same visitor', () => {
    for (let i = 0; i < 60; i++) {
      const result = rateLimit(VISITOR_READ, 'read');
      expect(result.ok).toBe(true);
    }
  });

  it('returns { ok: false, retryAfterSeconds: 30 } on the 61st read request within 1 minute', () => {
    for (let i = 0; i < 60; i++) {
      rateLimit(VISITOR_READ, 'read');
    }
    const result = rateLimit(VISITOR_READ, 'read');
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeDefined();
    expect((result as { ok: false; retryAfterSeconds: number }).retryAfterSeconds).toBe(30);
  });

  it('resets the window after 1 minute has elapsed', () => {
    for (let i = 0; i < 60; i++) {
      rateLimit(VISITOR_READ, 'read');
    }
    // Advance time past the 1-minute window
    vi.advanceTimersByTime(60 * 1000 + 1);

    const result = rateLimit(VISITOR_READ, 'read');
    expect(result.ok).toBe(true);
  });
});

describe('rateLimit — pruning behavior', () => {
  it('prunes timestamps older than the window so they do not count toward the cap', () => {
    // 25 requests at t=0
    for (let i = 0; i < 25; i++) {
      rateLimit(VISITOR_CHAT, 'chat');
    }

    // Advance to just inside the 5-minute window boundary
    vi.advanceTimersByTime(4 * 60 * 1000 + 55 * 1000); // 4m55s — still within window

    // 5 more requests should still be within limit (total 30 within window)
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(VISITOR_CHAT, 'chat');
      expect(result.ok).toBe(true);
    }

    // Now advance past the window — the first 25 timestamps are now expired
    vi.advanceTimersByTime(10 * 1000); // 5m5s total

    // The 5 recent requests remain in window; we can make 25 more
    for (let i = 0; i < 25; i++) {
      const result = rateLimit(VISITOR_CHAT, 'chat');
      expect(result.ok).toBe(true);
    }
  });
});
