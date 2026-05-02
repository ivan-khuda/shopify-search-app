import { NextRequest, NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  let shop = searchParams.get('shop');

  const authHeader = request.headers.get('Authorization');
  if (!shop && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await shopifyClient.session.decodeSessionToken(token);
      shop = new URL(payload.dest as string).hostname;
    } catch {
      return redirectToAuth(request);
    }
  }

  if (!shop) {
    return redirectToAuth(request);
  }

  const offlineSessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(offlineSessionId);

  if (!session) {
    return redirectToAuth(request, shop);
  }

  return NextResponse.next();
}

function redirectToAuth(request: NextRequest, shop?: string): NextResponse {
  const authUrl = new URL('/api/auth', request.url);
  if (shop) authUrl.searchParams.set('shop', shop);
  return NextResponse.redirect(authUrl);
}

export const config = {
  matcher: ['/chat/:path*', '/onboarding/:path*'],
};
