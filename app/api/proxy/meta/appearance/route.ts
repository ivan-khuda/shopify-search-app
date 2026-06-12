/**
 * GET /api/proxy/meta/appearance — HMAC-verified presentation-settings read
 * for the storefront drawer.
 *
 * Same auth boundary as bundle-url discovery; response carries no shop
 * identifier. The drawer fetches this once on mount to apply the
 * merchant-configured empty-state variant, card density, accent, greeting,
 * suggested prompts, and visibility flags.
 *
 * SECURITY: the response object is built EXPLICITLY, field by field —
 * never spread the settings bundle. notificationEmail and
 * monthlyCapRequests are merchant-private and MUST NOT reach the
 * storefront.
 *
 * No console.* logging (CLAUDE.md constraint).
 */
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { getShopSettings } from '@/services/settings/getShopSettings';

export const GET = withAppProxyHmac(async ({ shop }) => {
  const settings = await getShopSettings(shop);
  return Response.json(
    {
      emptyStateVariant: settings.emptyStateVariant,
      cardDensity: settings.cardDensity,
      drawerAccent: settings.drawerAccent,
      greetingMessage: settings.greetingMessage,
      suggestedPrompts: settings.suggestedPrompts,
      drawerEnabled: settings.drawerEnabled,
      editorPreviewVisible: settings.editorPreviewVisible,
      fabStyle: settings.fabStyle,
      drawerPosition: settings.drawerPosition,
    },
    { headers: { 'cache-control': 'private, max-age=60' } },
  );
});
