/**
 * Phase 8 — Per-request cap composer (CAP-02, D-09, D-14).
 *
 * Thin resolver that both chat routes (08-13 `/api/chat`, 08-14
 * `/api/proxy/chat`) call exactly once per request. Centralizes the
 * cap-check policy so routes never inline env reads or period derivation:
 *
 *   const { allowed } = await tryConsumeRequest(shop);
 *   if (!allowed) return cappedResponse();
 *
 * D-14 (single-helper co-location): one function, one file. Routes get a
 * boolean verdict; everything else — env parsing, period key, atomic
 * counter increment — is encapsulated here and in the two collaborators
 * (`getCurrentPeriod`, `requestCounterRepository.tryConsume`).
 *
 * CAP-02 (env-driven cap with safe defaults):
 *   - `HARD_CAP_REQUESTS_PER_MONTH` parsed via parseInt(., 10) at call time
 *     (not module load) so operator env rotation takes effect on the next
 *     request and tests can override per-case via `process.env`.
 *   - DEFAULT_CAP = 2000 (D-09 locked default). Invalid / missing / ≤0 /
 *     non-finite values fall back to the default — env tampering (T-08-10-T1)
 *     cannot bypass the cap by setting it to "abc" or "-1".
 *
 * Trust boundary (T-08-10-T2): `shop` is trusted by contract. Both routes
 * derive it from authenticated context (`withShopifySession` ctx.shop /
 * `withAppProxyHmac` signed query); passing an empty / spoofed shop here
 * would be a caller bug, not a security gap. An explicit empty-shop guard
 * would mask that bug, so we don't add one.
 *
 * Style mirrors `services/chat/getActiveChatModel.ts` (Phase 7 pattern
 * reference): small per-request composer, zero `console.*` (CLAUDE.md
 * hard rule), no `any` types.
 */
import { prisma } from '@/lib/db/client';
import {
  requestCounterRepository,
  type ChatSurface,
} from '@/lib/db/repositories/RequestCounterRepository';
import { getCurrentPeriod } from '@/lib/util/period';

export type { ChatSurface };

const DEFAULT_CAP = 2000;

function readCap(): number {
  const raw = process.env.HARD_CAP_REQUESTS_PER_MONTH;
  if (raw === undefined) return DEFAULT_CAP;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CAP;
  return parsed;
}

/** Operator default cap (env override or 2000) — the ceiling merchants may lower under. */
export function readEffectiveDefaultCap(): number {
  return readCap();
}

/**
 * Per-shop cap override (settings redesign): ShopSettings.monthlyCapRequests
 * may LOWER the cap below the operator default, never raise it (Math.min).
 * Reads prisma.shopSettings directly (pattern: getActiveChatModel). A
 * settings read failure must never block chat — catch → default cap.
 *
 * `surface` threads through to the counter so admin vs storefront usage can
 * be reported separately; it does not affect the cap decision.
 */
export async function tryConsumeRequest(
  shop: string,
  surface: ChatSurface,
): Promise<{ allowed: boolean }> {
  const period = getCurrentPeriod();
  let cap = readCap();
  try {
    const row = await prisma.shopSettings.findUnique({
      where: { shop },
      select: { monthlyCapRequests: true },
    });
    if (row?.monthlyCapRequests != null && row.monthlyCapRequests > 0) {
      cap = Math.min(cap, row.monthlyCapRequests);
    }
  } catch {
    // settings outage must not block chat — fall through with default cap
  }
  const r = await requestCounterRepository.tryConsume(shop, period, cap, surface);
  return { allowed: r.allowed };
}
