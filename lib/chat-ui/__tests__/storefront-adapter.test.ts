/**
 * StorefrontAdapter tests — updated for CR-03.
 * visitor_id now comes from resolveSignedVisitorId (server-signed token),
 * not from crypto.randomUUID.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SIGNED_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

// Mock the visitor-bootstrap module so tests don't hit fetch
// Use a literal string (not the const) because vi.mock factories are hoisted.
vi.mock('@/lib/chat-ui/identity/visitor-bootstrap', () => ({
  resolveSignedVisitorId: vi.fn().mockResolvedValue(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  ),
}));

import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';
import { resolveSignedVisitorId } from '@/lib/chat-ui/identity/visitor-bootstrap';

describe('StorefrontAdapter (SHR-03, CR-03)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(resolveSignedVisitorId).mockResolvedValue(SIGNED_TOKEN);
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

  it('CR-03: getRequestBody returns visitor_id from resolveSignedVisitorId (not randomUUID)', async () => {
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody();
    expect(body).toMatchObject({ visitor_id: SIGNED_TOKEN });
    expect(resolveSignedVisitorId).toHaveBeenCalled();
  });

  it('CR-03: does NOT call crypto.randomUUID for identity', async () => {
    const spy = vi.spyOn(crypto, 'randomUUID');
    const adapter = new StorefrontAdapter();
    await adapter.getRequestBody();
    expect(spy).not.toHaveBeenCalled();
  });

  it('getRequestBody returns {} when window is undefined (SSR guard)', async () => {
    vi.stubGlobal('window', undefined as unknown as Window & typeof globalThis);
    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody();
    expect(body).toEqual({});
  });
});

// ── IDN-02: customer_id injection from window.Shopify.customer ──────────────
describe('IDN-02 customer_id — window.Shopify.customer injection (CR-03 update)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('includes customer_id as string when window.Shopify.customer.id is a number', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: 5570080145486 } },
      configurable: true,
      writable: true,
    });

    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as { visitor_id: string; customer_id?: string };

    expect(body.visitor_id).toBe(SIGNED_TOKEN);
    expect(body.customer_id).toBe('5570080145486');
  });

  it('does NOT include customer_id key when window.Shopify is undefined', async () => {
    vi.stubGlobal('window', { localStorage: window.localStorage, Shopify: undefined });
    vi.mocked(resolveSignedVisitorId).mockResolvedValue(SIGNED_TOKEN);

    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as Record<string, unknown>;

    expect(body.visitor_id).toBe(SIGNED_TOKEN);
    expect('customer_id' in body).toBe(false);
  });

  it('does NOT include customer_id key when window.Shopify.customer is null', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: null },
      configurable: true,
      writable: true,
    });

    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as Record<string, unknown>;

    expect(body.visitor_id).toBe(SIGNED_TOKEN);
    expect('customer_id' in body).toBe(false);
  });

  it('STR-08: endpoint is the App Proxy path regardless of customer presence', () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: 12345 } },
      configurable: true,
      writable: true,
    });

    const adapter = new StorefrontAdapter();
    expect(adapter.endpoint).toBe('/apps/smartdiscovery/chat');
    expect(adapter.endpoint).not.toMatch(/^https?:\/\//);
  });

  it('includes customer_id as string when window.Shopify.customer.id is a string', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { customer: { id: '5570080145486' } },
      configurable: true,
      writable: true,
    });

    const adapter = new StorefrontAdapter();
    const body = await adapter.getRequestBody() as { visitor_id: string; customer_id?: string };

    expect(body.customer_id).toBe('5570080145486');
  });
});
