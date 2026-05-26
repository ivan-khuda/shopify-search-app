import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded';

describe('EmbeddedAdapter (SHR-03)', () => {
  beforeEach(() => {
    vi.stubGlobal('shopify', { idToken: vi.fn().mockResolvedValue('fake-jwt-token') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('endpoint is /api/chat', () => {
    const adapter = new EmbeddedAdapter();
    expect(adapter.endpoint).toBe('/api/chat');
  });

  it('getAuthHeaders awaits shopify.idToken and returns a Bearer header', async () => {
    const adapter = new EmbeddedAdapter();
    const headers = await adapter.getAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer fake-jwt-token' });
  });

  it('getRequestBody returns {} (no extra body fields)', async () => {
    const adapter = new EmbeddedAdapter();
    const body = await adapter.getRequestBody();
    expect(body).toEqual({});
  });

  it('getAuthHeaders is called fresh on every invocation (no token caching — T-5-AC)', async () => {
    const adapter = new EmbeddedAdapter();
    await adapter.getAuthHeaders();
    await adapter.getAuthHeaders();
    // T-5-AC: short-lived JWT must be refetched per request; module-level caching is forbidden.
    const idTokenMock = (globalThis as unknown as { shopify: { idToken: ReturnType<typeof vi.fn> } }).shopify.idToken;
    expect(idTokenMock).toHaveBeenCalledTimes(2);
  });
});
