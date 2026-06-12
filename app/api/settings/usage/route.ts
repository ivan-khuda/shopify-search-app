/**
 * GET /api/settings/usage — usage snapshot for the settings page's
 * "Usage & limits" section.
 *
 * Thin wrapper: the data assembly lives in services/settings/getUsageSnapshot
 * so the /settings SSR page can share the exact same queries and cap policy.
 *
 * Auth/idiom mirrors the other /api/settings/* routes: shop comes from the
 * verified session only; zero log calls; multi-tenancy via the composite
 * (shop, period) PK and the shop PK on ShopSettings.
 */
import { withShopifySession } from '@/lib/shopify/auth';
import { getUsageSnapshot } from '@/services/settings/getUsageSnapshot';

export const GET = withShopifySession(async ({ shop }) => {
  return Response.json(await getUsageSnapshot(shop));
});
