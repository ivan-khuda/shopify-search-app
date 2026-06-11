import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertAppearance } = vi.hoisted(() => ({
  upsertAppearance: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/db/repositories/ShopSettingsRepository', () => ({
  shopSettingsRepository: { upsertAppearance },
}));
// withShopifySession passthrough: same hoisted-mock pattern as
// app/api/shopify/sync/__tests__/route.test.ts — read it and copy the
// wrapper mock that injects { shop: 'test.myshopify.com', req }.
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession:
    (handler: (ctx: { shop: string; req: Request }) => Promise<Response>) =>
    (req: Request) => handler({ shop: 'test.myshopify.com', req }),
}));

import { PATCH } from '../route';

const patch = (body: unknown) =>
  PATCH(
    new Request('http://x/api/settings/appearance', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('PATCH /api/settings/appearance', () => {
  beforeEach(() => upsertAppearance.mockClear());

  it('accepts a valid partial body and upserts for the session shop', async () => {
    upsertAppearance.mockResolvedValue({ emptyStateVariant: 'cards', cardDensity: 'compact' });
    const res = await patch({ cardDensity: 'compact' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      appearance: { emptyStateVariant: 'cards', cardDensity: 'compact' },
    });
    expect(upsertAppearance).toHaveBeenCalledWith('test.myshopify.com', {
      cardDensity: 'compact',
    });
  });

  it('rejects unknown enum values', async () => {
    const res = await patch({ emptyStateVariant: 'sparkly' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_body' });
    expect(upsertAppearance).not.toHaveBeenCalled();
  });

  it('rejects an empty body (at least one field required)', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });
});
