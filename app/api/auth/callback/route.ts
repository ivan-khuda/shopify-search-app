import { shopifyClient } from '@/lib/shopify/client';

export async function GET(request: Request): Promise<Response> {
  const { session } = await shopifyClient.auth.callback({ rawRequest: request });

  const shop = session.shop;
  let redirectUrl = new URL(request.url);
  if (request.url.includes('localhost')) {
    redirectUrl = new URL(`https://${process.env.HOST!}`);
  }

  redirectUrl.pathname = '/api/auth/online';
  redirectUrl.search = `?shop=${shop}`;

  return Response.redirect(redirectUrl.toString(), 302);
}
