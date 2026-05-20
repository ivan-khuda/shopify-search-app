import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 });
  }

  const token = authHeader.slice('Bearer '.length);

  let payload: { dest?: string };
  try {
    payload = await shopifyClient.session.decodeSessionToken(token);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  if (!payload.dest) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  let shop: string;
  try {
    shop = new URL(payload.dest).hostname;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  if (!shop.endsWith('.myshopify.com')) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const sessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'no_offline_session' }, { status: 401 });
  }

  // TODO: wire real syncProducts(session). Tracked in docs/superpowers/specs/2026-05-20-onboarding-app-home-design.md (out of scope).

  return NextResponse.json({ success: true });
}
