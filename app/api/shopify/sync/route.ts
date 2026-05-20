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

  const shop = new URL(payload.dest).hostname;
  const sessionId = shopifyClient.session.getOfflineId(shop);
  const session = await sessionStorage.loadSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'no_offline_session' }, { status: 401 });
  }

  // Stub sync work: real syncProducts() is tracked separately.
  void session;

  return NextResponse.json({ success: true });
}
