import { shopifyClient } from '@/lib/shopify/client';

export async function GET(request: Request): Promise<Response> {
  const { session } = await shopifyClient.auth.callback({ rawRequest: request });

  const shop = session.shop;
  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = '/api/auth/online';
  redirectUrl.search = `?shop=${shop}`;

  return Response.redirect(redirectUrl.toString(), 302);
}
