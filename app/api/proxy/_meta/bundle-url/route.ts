/**
 * GET /api/proxy/_meta/bundle-url — Bundle-URL discovery (D-13).
 *
 * The loader.js IIFE (extensions/chat-drawer/assets/loader.js) hits this
 * endpoint via App Proxy to resolve the absolute URL of the latest
 * content-hashed storefront bundle. Liquid cannot embed the app's external
 * host, so resolution happens at the proxy boundary which knows it via env.
 *
 * Reads `public/storefront-manifest.json` (produced by `bun run prebuild`,
 * Plan 05). Joins manifest.bundle to process.env.HOST.
 *
 * Errors:
 *   - 500 bundle_not_built — manifest missing (prebuild never ran)
 *   - 500 host_not_configured — process.env.HOST unset
 *   - 429 rate_limited — global per-shop bucket
 *
 * No console.* logging.
 */
import { NextResponse } from 'next/server';
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';

export const GET = withAppProxyHmac(async ({ shop }) => {
  const rl = rateLimit(`shop:${shop}`, 'read');
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const manifestPath = path.join(process.cwd(), 'public', 'storefront-manifest.json');
  if (!existsSync(manifestPath)) {
    return NextResponse.json({ error: 'bundle_not_built' }, { status: 500 });
  }

  const host = process.env.HOST;
  if (!host) {
    return NextResponse.json({ error: 'host_not_configured' }, { status: 500 });
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    bundle: string;
    version: string;
  };
  const bundle = host.replace(/\/$/, '') + manifest.bundle;

  return NextResponse.json(
    { bundle, version: manifest.version },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
