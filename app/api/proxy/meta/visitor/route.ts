/**
 * GET /api/proxy/meta/visitor — Server-mint a signed visitor identity token (CR-03).
 *
 * This is the ONLY endpoint that mints visitor identities. The client calls
 * this on first load (when no valid signed token exists in localStorage) and
 * on any 401 invalid_visitor_signature response from a proxy route. The
 * returned signed token carries an HMAC-SHA256 signature the server verifies
 * on every subsequent proxy request — making per-visitor rate limiting and
 * per-visitor data scoping unforgeable (T-nm9-01, T-nm9-02, T-nm9-03).
 *
 * Security posture (T-nm9-06): minting is per-shop rate-limited on the 'read'
 * bucket — the same bucket as bundle-url discovery. Minting is cheap (HMAC,
 * no DB write), so the read bucket provides adequate DoS protection without
 * a tighter dedicated bucket.
 *
 * No DB writes. Cache-Control: no-store (token must always be fresh).
 * No console.* logging.
 */
import { NextResponse } from 'next/server';
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { mintSignedVisitorId } from '@/lib/identity/visitor-signature';

export const GET = withAppProxyHmac(async ({ shop }) => {
  const rl = rateLimit(`shop:${shop}`, 'read');
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const visitor_id = mintSignedVisitorId();

  return NextResponse.json(
    { visitor_id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
