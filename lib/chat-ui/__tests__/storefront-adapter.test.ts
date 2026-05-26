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

  it('endpoint is /api/proxy/chat', () => {
    const adapter = new StorefrontAdapter();
    expect(adapter.endpoint).toBe('/api/proxy/chat');
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
