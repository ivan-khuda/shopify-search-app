import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertFields } = vi.hoisted(() => ({
  upsertFields: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/db/repositories/ShopSettingsRepository', () => ({
  shopSettingsRepository: { upsertFields },
}));
// withShopifySession passthrough — same idiom as
// app/api/settings/appearance/__tests__/route.test.ts.
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession:
    (handler: (ctx: { shop: string; req: Request }) => Promise<Response>) =>
    (req: Request) => handler({ shop: 'test.myshopify.com', req }),
}));
// Operator default cap — the ceiling merchants may lower under.
vi.mock('@/services/chat/CapService', () => ({
  readEffectiveDefaultCap: () => 2000,
}));

import { PATCH } from '../route';

const patch = (body: unknown) =>
  PATCH(
    new Request('http://x/api/settings/shop', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('PATCH /api/settings/shop', () => {
  beforeEach(() => {
    upsertFields.mockClear();
    upsertFields.mockResolvedValue({});
  });

  it('accepts a valid partial body and upserts for the session shop', async () => {
    upsertFields.mockResolvedValue({ drawerAccent: '#008060' });
    const res = await patch({ drawerAccent: '#008060' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.settings).toMatchObject({ drawerAccent: '#008060' });
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      drawerAccent: '#008060',
    });
  });

  it('stores an empty greetingMessage as null (clearing back to built-in copy)', async () => {
    const res = await patch({ greetingMessage: '' });
    expect(res.status).toBe(200);
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      greetingMessage: null,
    });
  });

  it('accepts a valid suggestedPrompts array', async () => {
    const res = await patch({ suggestedPrompts: [{ icon: '☕', text: 'coffee' }] });
    expect(res.status).toBe(200);
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
    });
  });

  it('rejects more than MAX_SUGGESTED_PROMPTS prompts', async () => {
    const prompts = Array.from({ length: 7 }, (_, i) => ({ icon: '✨', text: `p${i}` }));
    const res = await patch({ suggestedPrompts: prompts });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_body' });
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('rejects monthlyCapRequests above the effective default cap', async () => {
    const res = await patch({ monthlyCapRequests: 5000 });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'cap_above_limit' });
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('accepts a lowering monthlyCapRequests', async () => {
    const res = await patch({ monthlyCapRequests: 500 });
    expect(res.status).toBe(200);
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      monthlyCapRequests: 500,
    });
  });

  it('accepts monthlyCapRequests: null (reset to operator default)', async () => {
    const res = await patch({ monthlyCapRequests: null });
    expect(res.status).toBe(200);
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      monthlyCapRequests: null,
    });
  });

  it('rejects an off-palette drawerAccent', async () => {
    const res = await patch({ drawerAccent: '#FF0000' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_body' });
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('rejects an empty body (at least one field required)', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('rejects unknown keys (strict — shop can never come from the body)', async () => {
    const res = await patch({ shop: 'evil', drawerEnabled: false });
    expect(res.status).toBe(400);
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('rejects a malformed notificationEmail', async () => {
    const res = await patch({ notificationEmail: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(upsertFields).not.toHaveBeenCalled();
  });

  it('accepts notificationEmail: null (reset to shop contact email)', async () => {
    const res = await patch({ notificationEmail: null });
    expect(res.status).toBe(200);
    expect(upsertFields).toHaveBeenCalledWith('test.myshopify.com', {
      notificationEmail: null,
    });
  });
});
