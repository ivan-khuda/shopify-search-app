import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';

const FIXED_UUID = 'fixed-uuid-aaaa-bbbb-cccc-dddd-eeeeffff0000';

describe('StorefrontAdapter (SHR-03)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('endpoint is /apps/smartdiscovery/chat (App Proxy path)', () => {
    const adapter = new StorefrontAdapter();
    expect(adapter.endpoint).toBe('/apps/smartdiscovery/chat');
  });

  it('getAuthHeaders returns {}', async () => {
    const adapter = new StorefrontAdapter();
    const headers = await adapter.getAuthHeaders();
    expect(headers).toEqual({});
  });

  it('getRequestBody on first invocation generates + persists visitor_id under smartdiscovery.visitor_id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody();
    expect(body).toEqual({ visitor_id: FIXED_UUID });
    expect(window.localStorage.getItem('smartdiscovery.visitor_id')).toBe(FIXED_UUID);
  });

  it('getRequestBody on second invocation reuses persisted visitor_id (does not call crypto.randomUUID again)', async () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    await adapter.getRequestBody();
    await adapter.getRequestBody();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('getRequestBody returns {} when window is undefined (SSR guard)', async () => {
    vi.stubGlobal('window', undefined as unknown as Window & typeof globalThis);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody();
    expect(body).toEqual({});
  });
});

// ── IDN-02: customer_id injection from window.Shopify.customer (Phase 6) ─────
//
// STR-08: endpoint is an App Proxy path '/apps/smartdiscovery/chat' so the
// request stays same-origin from the storefront and Shopify HMAC-signs it
// before forwarding to the app backend. IDN-02: when window.Shopify.customer.id
// is present, getRequestBody() includes customer_id as a STRING (BigInt
// precision preserved — Pitfall 7 from RESEARCH).

describe('IDN-02 customer_id — window.Shopify.customer injection (Phase 6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('includes customer_id as string when window.Shopify.customer.id is a number', async () => {
    // BigInt-precision test case: 5570080145486 must come through as the exact string
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: 5570080145486 } },
      configurable: true,
      writable: true,
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as { visitor_id: string; customer_id?: string };

    expect(body.visitor_id).toBe(FIXED_UUID);
    expect(body.customer_id).toBe('5570080145486');
    // BigInt precision: the string value must exactly match — no rounding
    expect(body.customer_id).toBe('5570080145486');
  });

  it('does NOT include customer_id key when window.Shopify is undefined', async () => {
    // window.Shopify may not be defined on non-Shopify storefronts
    vi.stubGlobal('window', { localStorage: window.localStorage, Shopify: undefined });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as Record<string, unknown>;

    expect(body.visitor_id).toBe(FIXED_UUID);
    expect('customer_id' in body).toBe(false);
  });

  it('does NOT include customer_id key when window.Shopify.customer is null', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: null },
      configurable: true,
      writable: true,
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as Record<string, unknown>;

    expect(body.visitor_id).toBe(FIXED_UUID);
    expect('customer_id' in body).toBe(false);
  });

  it('STR-08: endpoint is the App Proxy path regardless of customer presence', () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: 12345 } },
      configurable: true,
      writable: true,
    });

    const adapter = new StorefrontAdapter();
    // Endpoint must never be a full URL or cross-origin path
    expect(adapter.endpoint).toBe('/apps/smartdiscovery/chat');
    expect(adapter.endpoint).not.toMatch(/^https?:\/\//);
  });

  it('includes customer_id as string when window.Shopify.customer.id is a string', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: '5570080145486' } },
      configurable: true,
      writable: true,
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as { visitor_id: string; customer_id?: string };

    expect(body.customer_id).toBe('5570080145486');
  });
});
