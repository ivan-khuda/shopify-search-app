/**
 * RED: Tests for GET /api/proxy/_meta/visitor (CR-03 Task 2 — mint endpoint).
 * Will fail until route.ts is created.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    utils: { validateHmac: vi.fn() },
  },
}));

vi.mock('@/lib/rate-limit/memory', () => ({
  rateLimit: vi.fn().mockReturnValue({ ok: true }),
}));

import { GET } from '@/app/api/proxy/_meta/visitor/route';
import { shopifyClient } from '@/lib/shopify/client';
import { rateLimit } from '@/lib/rate-limit/memory';
import { verifyVisitorId } from '@/lib/identity/visitor-signature';

const SECRET = 'test-secret';
const SHOP = 'mystore.myshopify.com';

function signParams(params: Record<string, string>): string {
  const message = Object.keys(params)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function makeRequest(searchParams: Record<string, string> = {}): Request {
  const params = { shop: SHOP, ...searchParams };
  const signature = signParams(params);
  const url = new URL(`http://${SHOP}/apps/smartdiscovery/_meta/visitor`);
  for (const [k, v] of Object.entries({ ...params, signature })) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

beforeEach(() => {
  process.env.SHOPIFY_API_SECRET = SECRET;
  vi.clearAllMocks();
  vi.mocked(shopifyClient.utils.validateHmac).mockResolvedValue(true);
  vi.mocked(rateLimit).mockReturnValue({ ok: true });
});

describe('GET /api/proxy/_meta/visitor', () => {
  it('returns 401 without HMAC signature', async () => {
    const url = new URL(`http://${SHOP}/apps/smartdiscovery/_meta/visitor`);
    url.searchParams.set('shop', SHOP);
    const req = new Request(url.toString());
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('returns 429 with Retry-After when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfterSeconds: 30 });
    const req = makeRequest();
    const response = await GET(req);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('returns 200 with { visitor_id } on valid HMAC', async () => {
    const req = makeRequest();
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.json() as { visitor_id?: string };
    expect(typeof body.visitor_id).toBe('string');
    expect(body.visitor_id!.length).toBeGreaterThan(0);
  });

  it('returned visitor_id passes verifyVisitorId (server-signed token)', async () => {
    const req = makeRequest();
    const response = await GET(req);
    const body = await response.json() as { visitor_id: string };
    const result = verifyVisitorId(body.visitor_id);
    expect(result.valid).toBe(true);
  });

  it('sets Cache-Control: no-store header', async () => {
    const req = makeRequest();
    const response = await GET(req);
    expect(response.headers.get('Cache-Control')).toMatch(/no-store/);
  });

  it('each call mints a different visitor_id (randomness)', async () => {
    const req1 = makeRequest();
    const req2 = makeRequest();
    const r1 = await GET(req1);
    const r2 = await GET(req2);
    const b1 = await r1.json() as { visitor_id: string };
    const b2 = await r2.json() as { visitor_id: string };
    expect(b1.visitor_id).not.toBe(b2.visitor_id);
  });
});
