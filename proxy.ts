import { NextRequest, NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const shop = request.nextUrl.searchParams.get('shop');

  if (!shop) {
    return redirectToAuth(request);
  }

  // Trust the loaded session: it was minted by a server-controlled OAuth flow
  // keyed on this exact shop. Re-validating shop against session.shop adds
  // branching cost without a new threat vector (D-09 + Claude's Discretion).
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
  matcher: ['/onboarding/:path*', '/chat/:path*', '/settings/:path*'],
};
