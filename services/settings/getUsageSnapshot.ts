// services/settings/getUsageSnapshot.ts
// Usage snapshot assembly for the "Usage & limits" surface — shared between
// GET /api/settings/usage (client refresh path) and the /settings SSR page.
//
// Reports the current calendar-month counter (total / admin / storefront),
// the effective cap (operator default lowered by the per-shop override —
// same Math.min policy as CapService.tryConsumeRequest), the human period
// label, and the UTC instant the counter resets.
import { prisma } from '@/lib/db/client';
import { getCurrentPeriod } from '@/lib/util/period';
import { readEffectiveDefaultCap } from '@/services/chat/CapService';

export interface UsageSnapshot {
  used: number;
  adminUsed: number;
  storefrontUsed: number;
  cap: number;
  periodLabel: string;
  /** ISO instant of the first moment of next month (UTC). */
  resetsAt: string;
}

export async function getUsageSnapshot(shop: string): Promise<UsageSnapshot> {
  const period = getCurrentPeriod();

  // period is YYYY-MM (UTC by construction — see lib/util/period.ts).
  const periodStart = new Date(`${period}-01T00:00:00Z`);
  const periodLabel = periodStart.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const resetsAt = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
  ).toISOString();

  const defaultCap = readEffectiveDefaultCap();

  // Empty shop (unauthenticated direct navigation) — zeroed snapshot, no DB.
  if (!shop) {
    return {
      used: 0,
      adminUsed: 0,
      storefrontUsed: 0,
      cap: defaultCap,
      periodLabel,
      resetsAt,
    };
  }

  const [counter, settings] = await Promise.all([
    prisma.requestCounter.findUnique({
      where: { shop_period: { shop, period } },
    }),
    prisma.shopSettings.findUnique({
      where: { shop },
      select: { monthlyCapRequests: true },
    }),
  ]);

  const used = counter?.requestCount ?? 0;
  const adminUsed = counter?.adminRequestCount ?? 0;
  const override = settings?.monthlyCapRequests;
  const cap =
    override != null && override > 0 ? Math.min(defaultCap, override) : defaultCap;

  return {
    used,
    adminUsed,
    storefrontUsed: used - adminUsed,
    cap,
    periodLabel,
    resetsAt,
  };
}
