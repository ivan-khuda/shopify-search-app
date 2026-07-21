/**
 * Client-side visitor identity bootstrap (CR-03 Task 3, IN-03).
 *
 * This is the SINGLE source of visitor identity for all client-side transports
 * (StorefrontAdapter, db-backed stores, entry.tsx). Resolves IN-03 — the
 * previous duplicate identity logic in storefront.ts and entry.tsx.
 *
 * TRANSPORT NOTE / DEVIATION D-CR03 (see also lib/identity/visitor-signature.ts):
 * App Proxy strips Set-Cookie headers — HTTP cookies are impossible through the
 * proxy boundary. We implement the "signed cookie" security intent (unforgeable,
 * server-attested identity) using a body-token signed by HMAC-SHA256 on the
 * server side. The client is a pure consumer: it fetches the token and caches
 * it. It NEVER calls crypto.randomUUID() for identity (IN-08).
 *
 * Bootstrap order (memoized per page load):
 *   1. Module-level in-memory cache (fastest, handles blocked storage fallback)
 *   2. localStorage 'smartdiscovery.visitor_id' (survives page reload, may
 *      hold a legacy bare UUID that will be rejected by the server — the server
 *      returns 401 invalid_visitor_signature and the client re-mints then)
 *   3. GET /apps/smartdiscovery/meta/visitor (server mints a fresh signed token)
 *
 * WR-10 preserved: if localStorage throws (Safari "Block all cookies",
 * embedded webviews, private modes), we degrade to the module-level in-memory
 * token — never undefined, drawer always mounts.
 *
 * No console.* anywhere — PROJECT.md hard constraint.
 */

const STORAGE_KEY = 'smartdiscovery.visitor_id';
const MINT_PATH = '/apps/smartdiscovery/meta/visitor';

/** Module-level in-memory cache — set on first successful resolution. */
let cachedToken: string | null = null;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked — in-memory cache keeps the token stable for this page load.
  }
}

/**
 * Resolve the server-signed visitor token for this page load.
 *
 * Async, memoized per page load. Never throws — returns an empty string on
 * complete failure (network down + no prior storage), but callers should treat
 * an empty token as needing re-mint on next request.
 */
export async function resolveSignedVisitorId(): Promise<string> {
  // 1. In-memory cache
  if (cachedToken) {
    return cachedToken;
  }

  // 2. localStorage hit
  const stored = safeGet(STORAGE_KEY);
  if (stored) {
    cachedToken = stored;
    return stored;
  }

  // 3. Fetch from server mint endpoint
  try {
    const res = await fetch(MINT_PATH);
    if (res.ok) {
      const data = (await res.json()) as { visitor_id?: string };
      const token = data.visitor_id ?? '';
      if (token) {
        safeSet(STORAGE_KEY, token);
        cachedToken = token;
        return token;
      }
    }
  } catch {
    // Network error — fall through to empty return
  }

  return '';
}

/**
 * Reset the in-memory cache (for testing only — not exported for prod use).
 * @internal
 */
export function _resetCacheForTest(): void {
  cachedToken = null;
}
