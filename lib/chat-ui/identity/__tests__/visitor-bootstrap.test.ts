/**
 * RED: visitor-bootstrap.ts does not exist yet.
 * Tests for resolveSignedVisitorId — the single client-side bootstrap
 * that fetches/caches the server-signed visitor token (CR-03 Task 3).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module-level cache is reset between tests via vi.resetModules()
// We use dynamic import so each test gets a fresh module instance.

const STORAGE_KEY = 'smartdiscovery.visitor_id';
const SIGNED_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('resolveSignedVisitorId — fetch-mint path (no prior token)', () => {
  it('fetches GET /apps/smartdiscovery/meta/visitor when no token in storage', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ visitor_id: SIGNED_TOKEN }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    const token = await resolveSignedVisitorId();

    expect(fetch).toHaveBeenCalledWith('/apps/smartdiscovery/meta/visitor');
    expect(token).toBe(SIGNED_TOKEN);
  });

  it('stores the minted token in localStorage after fetch', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ visitor_id: SIGNED_TOKEN }), { status: 200 })
    );

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    await resolveSignedVisitorId();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(SIGNED_TOKEN);
  });
});

describe('resolveSignedVisitorId — in-memory cache path', () => {
  it('returns cached token on second call without fetching again', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ visitor_id: SIGNED_TOKEN }), { status: 200 })
    );

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    const t1 = await resolveSignedVisitorId();
    const t2 = await resolveSignedVisitorId();

    expect(t1).toBe(SIGNED_TOKEN);
    expect(t2).toBe(SIGNED_TOKEN);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('resolveSignedVisitorId — localStorage-hit path', () => {
  it('reads existing token from localStorage without fetching', async () => {
    window.localStorage.setItem(STORAGE_KEY, SIGNED_TOKEN);

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    const token = await resolveSignedVisitorId();

    expect(fetch).not.toHaveBeenCalled();
    expect(token).toBe(SIGNED_TOKEN);
  });
});

describe('resolveSignedVisitorId — storage-blocked in-memory fallback (WR-10)', () => {
  it('falls back to in-memory token when localStorage throws SecurityError', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ visitor_id: SIGNED_TOKEN }), { status: 200 })
    );

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    const token = await resolveSignedVisitorId();

    expect(token).toBe(SIGNED_TOKEN);
  });
});

describe('resolveSignedVisitorId — no crypto.randomUUID for identity (IN-08)', () => {
  it('never calls crypto.randomUUID during any bootstrap path', async () => {
    const spy = vi.spyOn(crypto, 'randomUUID');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ visitor_id: SIGNED_TOKEN }), { status: 200 })
    );

    const { resolveSignedVisitorId } = await import('@/lib/chat-ui/identity/visitor-bootstrap');
    await resolveSignedVisitorId();

    expect(spy).not.toHaveBeenCalled();
  });
});
