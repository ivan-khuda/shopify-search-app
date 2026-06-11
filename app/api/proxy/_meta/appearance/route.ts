/**
 * GET /api/proxy/_meta/appearance — HMAC-verified appearance read for the
 * storefront drawer.
 *
 * Same auth boundary as bundle-url discovery; response carries no shop
 * identifier. The drawer fetches this once on mount to apply the
 * merchant-configured empty-state variant and card density.
 *
 * No console.* logging (CLAUDE.md constraint).
 */
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { getShopAppearance } from '@/services/chat/getShopAppearance';

export const GET = withAppProxyHmac(async ({ shop }) => {
  const appearance = await getShopAppearance(shop);
  return Response.json(appearance, {
    headers: { 'cache-control': 'private, max-age=60' },
  });
});
