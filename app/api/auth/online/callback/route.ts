import { shopifyClient } from '@/lib/shopify/client';

export async function GET(request: Request): Promise<Response> {
  const { session } = await shopifyClient.auth.callback({ rawRequest: request });

  const shop = session.shop;
  const handle = process.env.SHOPIFY_APP_HANDLE!;
  const destination = `https://${shop}/admin/apps/${handle}/onboarding`;

  return Response.redirect(destination, 302);
}
