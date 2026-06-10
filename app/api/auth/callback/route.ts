import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function GET(request: Request): Promise<Response> {
  // WR-05: auth.callback throws on invalid/tampered HMAC or state (replayed
  // callback URLs etc.) — return a controlled 400 instead of an unhandled 500
  // with a framework stack trace. No error details are logged or echoed
  // (CLAUDE.md: no secrets/tokens in logs).
  let session;
  try {
    ({ session } = await shopifyClient.auth.callback({ rawRequest: request }));
  } catch {
    return new Response('Invalid OAuth callback', { status: 400 });
  }

  // The base @shopify/shopify-api library does NOT auto-persist sessions —
  // auth.callback() only returns the session. We must store it ourselves.
  await sessionStorage.storeSession(session);

  const shop = session.shop;
  let redirectUrl = new URL(request.url);
  // WR-05: gate the dev rewrite on the actual request hostname (not a
  // substring match over the whole URL, which any query param could spoof),
  // and only rewrite when HOST is actually configured — `https://undefined`
  // is a dead host. Without HOST, the localhost origin itself still works
  // for local dev. HOST is scheme-less by convention; strip defensively.
  const host = process.env.HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (redirectUrl.hostname === 'localhost' && host) {
    redirectUrl = new URL(`https://${host}`);
  }

  redirectUrl.pathname = '/api/auth/online';
  redirectUrl.search = `?shop=${shop}`;

  return Response.redirect(redirectUrl.toString(), 302);
}
