import { shopifyClient } from '@/lib/shopify/client';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');

  if (!shop) {
    return new Response('Missing shop parameter', { status: 400 });
  }

  return shopifyClient.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: false,
    rawRequest: request,
  }) as Promise<Response>;
}
