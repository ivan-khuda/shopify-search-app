import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function GET(request: Request): Promise<Response> {
  const { session } = await shopifyClient.auth.callback({ rawRequest: request });

  // The base @shopify/shopify-api library does NOT auto-persist sessions —
  // auth.callback() only returns the session. We must store it ourselves.
  await sessionStorage.storeSession(session);

  const shop = session.shop;
  let redirectUrl = new URL(request.url);
  if (request.url.includes('localhost')) {
    redirectUrl = new URL(`https://${process.env.HOST!}`);
  }

  redirectUrl.pathname = '/api/auth/online';
  redirectUrl.search = `?shop=${shop}`;

  return Response.redirect(redirectUrl.toString(), 302);
}
