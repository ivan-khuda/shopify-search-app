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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (shopifyClient.session as any).decodeSessionToken(token);
      shop = (payload.dest as string).replace('https://', '');
    } catch {
      return redirectToAuth(request);
    }
  }

  if (!shop) {
    return redirectToAuth(request);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offlineSessionId = (shopifyClient.session as any).getOfflineId(shop);
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
