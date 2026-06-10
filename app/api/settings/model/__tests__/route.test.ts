// Phase 7 Wave 0 RED scaffold for app/api/settings/model/route.ts.
// Pins the PATCH endpoint contract from D-07 + D-10 + multi-tenancy
// CLAUDE.md constraints. Implementation lands in Plan 07.
//
// Contract:
//   - withShopifySession Bearer auth — request without/invalid token returns 401
//     (delegated to the existing lib/shopify/auth.ts wrapper; this suite mocks
//     the wrapper to pass-through with a fixed session ctx).
//   - Body validation via Zod: invalid_body for non-JSON / missing field / >200 chars
//   - Catalog membership: unknown_model_id when activeChatModelId is not in the catalog
//   - Happy path: upsert keyed by ctx.shop (NEVER body.shop — multi-tenancy lock),
//     responds 200 with { ok: true, displayName }
//   - No console.log / warn / error in any branch (CLAUDE.md hard rule)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withShopifySession to pass-through with a fixed ctx. Real auth is
// covered by lib/shopify/__tests__/auth.test.ts; here we only care about the
// route's behavior given an authorized request.
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession: (
    handler: (ctx: { shop: string; session: unknown; req: Request }) => Promise<Response>,
  ) =>
    async (req: Request): Promise<Response> => {
      return handler({
        shop: 'test-shop.myshopify.com',
        session: {} as unknown,
        req,
      });
    },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/services/chat/model-catalog', () => ({
  fetchModelCatalog: vi.fn(),
}));

vi.mock('@/lib/db/repositories/ShopSettingsRepository', () => ({
  shopSettingsRepository: {
    upsert: vi.fn(),
  },
}));

import { PATCH } from '../route';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';

const fetchCatalogMock = fetchModelCatalog as ReturnType<typeof vi.fn>;
const upsertMock = shopSettingsRepository.upsert as ReturnType<typeof vi.fn>;

const catalogFixture = {
  models: [
    {
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      provider: 'google',
    },
    {
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      provider: 'anthropic',
    },
  ],
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchCatalogMock.mockResolvedValue(catalogFixture);
  upsertMock.mockResolvedValue({
    shop: 'test-shop.myshopify.com',
    activeChatModelId: 'anthropic/claude-sonnet-4.5',
    updatedAt: new Date(),
  });
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

function makeReq(body: string | object): Request {
  const init: RequestInit = {
    method: 'PATCH',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
  return new Request('http://localhost/api/settings/model', init);
}

describe('PATCH /api/settings/model — body validation', () => {
  it('returns 400 invalid_body when JSON body is not parseable', async () => {
    const res = await PATCH(makeReq('not json'));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_body');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_body when activeChatModelId is missing', async () => {
    const res = await PATCH(makeReq({}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_body');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_body when activeChatModelId is > 200 chars', async () => {
    const tooLong = 'a/' + 'x'.repeat(250);
    const res = await PATCH(makeReq({ activeChatModelId: tooLong }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_body');
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/settings/model — catalog membership', () => {
  it('returns 400 unknown_model_id when id is not in the catalog', async () => {
    const res = await PATCH(makeReq({ activeChatModelId: 'fake/model' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('unknown_model_id');
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/settings/model — happy path', () => {
  it('upserts ShopSettings and returns 200 with displayName on valid request', async () => {
    const res = await PATCH(makeReq({ activeChatModelId: 'anthropic/claude-sonnet-4.5' }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; displayName: string };
    expect(json).toEqual({ ok: true, displayName: 'Claude Sonnet 4.5' });
    expect(upsertMock).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      'anthropic/claude-sonnet-4.5',
    );
  });

  it('derives shop from session ctx, NOT from request body (multi-tenancy lock)', async () => {
    await PATCH(
      makeReq({
        activeChatModelId: 'anthropic/claude-sonnet-4.5',
        // Attempt to override shop via body — must be ignored
        shop: 'evil-shop.myshopify.com',
      }),
    );

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [shopArg] = upsertMock.mock.calls[0];
    expect(shopArg).toBe('test-shop.myshopify.com');
  });
});

describe('PATCH /api/settings/model — CLAUDE.md no-secret-logging rule', () => {
  it('NEVER logs Authorization headers or session tokens across any branch', async () => {
    await PATCH(makeReq('not json'));
    await PATCH(makeReq({}));
    await PATCH(makeReq({ activeChatModelId: 'fake/model' }));
    await PATCH(makeReq({ activeChatModelId: 'anthropic/claude-sonnet-4.5' }));

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// RED: implementation lands in Plan 07 (app/api/settings/model/route.ts).
