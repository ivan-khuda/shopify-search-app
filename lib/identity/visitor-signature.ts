/**
 * Server-only HMAC-signed visitor identity helper (CR-03, Task 1).
 *
 * TRANSPORT NOTE / DEVIATION D-CR03:
 * The project constraint says "Anonymous visitor (signed cookie)". Shopify App
 * Proxy STRIPS both Set-Cookie and Cookie headers on every proxied response/
 * request (confirmed against shopify.dev "Disallowed App Proxy Response Headers"
 * and the existing STATE.md decision: "localStorage for visitor_id — App Proxy
 * strips Set-Cookie"). A literal HTTP cookie is IMPOSSIBLE through the App Proxy
 * boundary. This module delivers the SECURITY INTENT of the "signed cookie"
 * requirement — a server-minted, server-signed, server-verified identity token —
 * using the only durable transport App Proxy permits: a signed token in the JSON
 * body, persisted client-side (localStorage with in-memory fallback per WR-10).
 * The HMAC-SHA256 signature (keyed on a SHOPIFY_API_SECRET-derived namespace key)
 * makes the id unforgeable and closes the CR-03 vulnerability. The transport being
 * a body token rather than an HTTP Set-Cookie header does not weaken the security
 * property.
 *
 * Token format: `${uuid}.${hexSig}`
 *   - uuid:   crypto.randomUUID() — standard 8-4-4-4-12 hex with hyphens, no dots
 *   - hexSig: HMAC-SHA256(uuid, derivedKey) as lowercase hex
 *
 * Key derivation:
 *   derivedKey = HMAC-SHA256('smartdiscovery:visitor-id:v1', SHOPIFY_API_SECRET)
 *   Namespace isolation keeps a future secret-reuse audit clean — visitor ids
 *   are never signed directly with the raw API secret.
 *
 * Verification uses crypto.timingSafeEqual on equal-length Buffers. Buffers of
 * unequal length cannot be compared via timingSafeEqual (it throws); we pre-check
 * and return { valid: false } on length mismatch to avoid the throw.
 *
 * Module init / mint: throws if SHOPIFY_API_SECRET is unset — fail loud so a
 * misconfigured deploy is caught immediately (mirrors HOST handling elsewhere).
 * verifyVisitorId: returns { valid: false } rather than throwing when the secret
 * is missing — so a misconfigured deploy degrades to "reject all" not "crash".
 *
 * No console.* anywhere — PROJECT.md hard constraint.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const NAMESPACE = 'smartdiscovery:visitor-id:v1';

/** Derive the per-namespace signing key from the API secret. */
function deriveKey(apiSecret: string): Buffer {
  return Buffer.from(
    createHmac('sha256', apiSecret).update(NAMESPACE).digest()
  );
}

/** Compute HMAC-SHA256 of `data` keyed on `key`; returns a hex string. */
function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Mint a new server-signed visitor token.
 * Throws if SHOPIFY_API_SECRET is unset.
 */
export function mintSignedVisitorId(): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error(
      'SHOPIFY_API_SECRET is not set — cannot mint a signed visitor id'
    );
  }
  const uuid = crypto.randomUUID();
  return signVisitorId(uuid);
}

/**
 * Sign an existing uuid with the current secret.
 * Throws if SHOPIFY_API_SECRET is unset.
 */
export function signVisitorId(uuid: string): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error(
      'SHOPIFY_API_SECRET is not set — cannot sign visitor id'
    );
  }
  const key = deriveKey(secret);
  const sig = hmacHex(key, uuid);
  return `${uuid}.${sig}`;
}

export type VerifyResult =
  | { valid: true; visitorId: string }
  | { valid: false };

/**
 * Verify a signed visitor token.
 *
 * Returns { valid: false } (never throws) when:
 *   - SHOPIFY_API_SECRET is unset (degrade to "reject all")
 *   - token is empty or has no dot (bare legacy UUID)
 *   - signature does not match (tampered uuid or sig)
 *   - buffer lengths differ (short / truncated sig)
 */
export function verifyVisitorId(token: string): VerifyResult {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return { valid: false };
  }

  if (!token) {
    return { valid: false };
  }

  // Split on LAST dot so a uuid (no dots) leaves exactly two parts.
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) {
    // No dot → bare legacy UUID or invalid format
    return { valid: false };
  }

  const uuid = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);

  if (!uuid || !providedSig) {
    return { valid: false };
  }

  const key = deriveKey(secret);
  const expectedSig = hmacHex(key, uuid);

  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const providedBuf = Buffer.from(providedSig, 'hex');

  // timingSafeEqual throws on length mismatch — guard first.
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false };
  }

  const ok = timingSafeEqual(expectedBuf, providedBuf);
  if (!ok) {
    return { valid: false };
  }

  return { valid: true, visitorId: uuid };
}
