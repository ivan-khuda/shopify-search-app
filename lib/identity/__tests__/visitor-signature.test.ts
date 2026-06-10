/**
 * RED: visitor-signature.ts helper does not exist yet.
 * Tests verify HMAC-signed visitor identity contract (CR-03, Task 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('SHOPIFY_API_SECRET', 'test-secret-for-signing');

import {
  mintSignedVisitorId,
  signVisitorId,
  verifyVisitorId,
} from '@/lib/identity/visitor-signature';

const SECRET = 'test-secret-for-signing';

beforeEach(() => {
  vi.stubEnv('SHOPIFY_API_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mintSignedVisitorId', () => {
  it('returns a token in the format uuid.hexSig (contains exactly one dot separator)', () => {
    const token = mintSignedVisitorId();
    const parts = token.split('.');
    // uuid is a standard UUID with 4 hyphens → 5 segments + sig = 6 total dot-parts...
    // Actually uuid (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) has 0 dots.
    // So the token is `uuid.sig` — the LAST dot separates uuid from sig.
    // Count: exactly 1 dot separates uuid from sig (uuid has no dots, hex has no dots)
    expect(parts.length).toBe(2);
  });

  it('the uuid part matches the crypto.randomUUID format', () => {
    const token = mintSignedVisitorId();
    const uuid = token.split('.')[0];
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('the sig part is a non-empty hex string', () => {
    const token = mintSignedVisitorId();
    const sig = token.split('.')[1];
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(sig.length).toBeGreaterThan(0);
  });

  it('two calls produce different tokens (randomness)', () => {
    const t1 = mintSignedVisitorId();
    const t2 = mintSignedVisitorId();
    expect(t1).not.toBe(t2);
  });
});

describe('signVisitorId', () => {
  it('is deterministic — same uuid + secret always yields the same token', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const t1 = signVisitorId(uuid);
    const t2 = signVisitorId(uuid);
    expect(t1).toBe(t2);
  });

  it('token starts with the uuid followed by a dot', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const token = signVisitorId(uuid);
    expect(token.startsWith(`${uuid}.`)).toBe(true);
  });
});

describe('verifyVisitorId — happy path', () => {
  it('round-trip: mintSignedVisitorId() → verifyVisitorId returns { valid: true } with extracted uuid', () => {
    const token = mintSignedVisitorId();
    const uuid = token.split('.')[0];
    const result = verifyVisitorId(token);
    expect(result).toEqual({ valid: true, visitorId: uuid });
  });

  it('round-trip: signVisitorId(uuid) → verifyVisitorId returns { valid: true, visitorId: uuid }', () => {
    const uuid = 'deadbeef-0000-1111-2222-333333333333';
    const token = signVisitorId(uuid);
    const result = verifyVisitorId(token);
    expect(result).toEqual({ valid: true, visitorId: uuid });
  });
});

describe('verifyVisitorId — rejection cases', () => {
  it('returns { valid: false } for an empty string', () => {
    expect(verifyVisitorId('')).toEqual({ valid: false });
  });

  it('returns { valid: false } for a bare unsigned UUID (legacy localStorage format)', () => {
    // A bare UUID has no dot — old client-minted format must be explicitly rejected
    const bareUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(verifyVisitorId(bareUuid)).toEqual({ valid: false });
  });

  it('returns { valid: false } when the uuid portion is tampered', () => {
    const token = mintSignedVisitorId();
    const sig = token.split('.')[1];
    const tamperedToken = `tampered-uuid-9999-9999-999999999999.${sig}`;
    expect(verifyVisitorId(tamperedToken)).toEqual({ valid: false });
  });

  it('returns { valid: false } when the signature portion is tampered', () => {
    const token = mintSignedVisitorId();
    const uuid = token.split('.')[0];
    const tamperedToken = `${uuid}.deadbeefdeadbeefdeadbeefdeadbeef`;
    expect(verifyVisitorId(tamperedToken)).toEqual({ valid: false });
  });

  it('returns { valid: false } for a token with the wrong signature (different uuid)', () => {
    const uuid1 = 'aaaaaaaa-0000-0000-0000-000000000001';
    const uuid2 = 'bbbbbbbb-0000-0000-0000-000000000002';
    const token1 = signVisitorId(uuid1);
    // Swap uuid1's sig onto uuid2
    const sig1 = token1.split('.')[1];
    const crossedToken = `${uuid2}.${sig1}`;
    expect(verifyVisitorId(crossedToken)).toEqual({ valid: false });
  });

  it('returns { valid: false } when SHOPIFY_API_SECRET is not set', () => {
    vi.stubEnv('SHOPIFY_API_SECRET', '');
    const token = 'some-uuid.some-sig';
    expect(verifyVisitorId(token)).toEqual({ valid: false });
  });
});

describe('constant-time comparison safety', () => {
  it('does not throw when comparing tokens of different lengths (timingSafeEqual length guard)', () => {
    // Short sig — must not throw, must return { valid: false }
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const shortToken = `${uuid}.ab`;
    expect(() => verifyVisitorId(shortToken)).not.toThrow();
    expect(verifyVisitorId(shortToken)).toEqual({ valid: false });
  });
});
