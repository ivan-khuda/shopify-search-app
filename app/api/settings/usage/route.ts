/**
 * GET /api/settings/usage — usage snapshot for the settings page's
 * "Usage & limits" section.
 *
 * Reports the current calendar-month counter (total / admin / storefront),
 * the effective cap (operator default lowered by the per-shop override —
 * same Math.min policy as CapService.tryConsumeRequest), the human period
 * label, and the UTC instant the counter resets.
 *
 * Auth/idiom mirrors the other /api/settings/* routes: shop comes from the
 * verified session only; zero log calls; multi-tenancy via the composite
 * (shop, period) PK and the shop PK on ShopSettings.
 */
import { prisma } from '@/lib/db/client';
import { withShopifySession } from '@/lib/shopify/auth';
import { getCurrentPeriod } from '@/lib/util/period';
import { readEffectiveDefaultCap } from '@/services/chat/CapService';

export const GET = withShopifySession(async ({ shop }) => {
  const period = getCurrentPeriod();
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
  const storefrontUsed = used - adminUsed;

  const defaultCap = readEffectiveDefaultCap();
  const override = settings?.monthlyCapRequests;
  const cap = override != null && override > 0 ? Math.min(defaultCap, override) : defaultCap;

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

  return Response.json({ used, adminUsed, storefrontUsed, cap, periodLabel, resetsAt });
});
