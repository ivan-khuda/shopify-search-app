import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopAppearance } from '@/lib/chat-ui/appearance';

/**
 * Chat-redesign Task 12 — page.tsx server-component data-flow test.
 *
 * page.tsx is an async Server Component that:
 *   1. awaits searchParams (Next 15+ async pattern)
 *   2. resolves the shop (session token first, validated searchParams fallback)
 *   3. loads getActiveChatModel + getShopAppearance + product count in parallel
 *   4. renders <ChatShell /> with { shop, modelName, appearance, catalogCount }
 *
 * The old standalone preview banner is gone — its copy lives in the ChatShell
 * header pill now (covered by chat-shell.test.tsx), so this file asserts the
 * data flow into ChatShell instead of banner markup.
 *
 * Phase 8.1 Plan 05 — W-2 session-resolved shop tests retained below: ChatPage
 * must prefer the session-token shop over searchParams.shop (T-08.1.05-01).
 */

const { shellProps } = vi.hoisted(() => ({
  shellProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: vi.fn(async () => ({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  })),
}));

vi.mock('@/services/chat/getShopAppearance', () => ({
  getShopAppearance: vi.fn(async (): Promise<ShopAppearance> => ({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
  })),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    product: {
      count: vi.fn(async () => 12),
    },
  },
}));

vi.mock('../chat-shell', () => ({
  ChatShell: (props: Record<string, unknown>) => {
    shellProps.push(props);
    return <div data-testid="chat-shell-stub">chat shell</div>;
  },
}));

// W-2: mock next/headers so resolveShopFromRequest can be exercised in jsdom
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// W-2: mock shopifyClient so decodeSessionToken can be controlled per-test
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    session: {
      decodeSessionToken: vi.fn(),
    },
  },
}));

import { headers } from 'next/headers';
import { prisma } from '@/lib/db/client';
import { shopifyClient } from '@/lib/shopify/client';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { getShopAppearance } from '@/services/chat/getShopAppearance';
import ChatPage from '@/app/(embedded)/chat/page';

async function renderServerPage(searchParams: Record<string, string | undefined>) {
  const tree = await ChatPage({
    searchParams: Promise.resolve(searchParams),
  } as { searchParams: Promise<Record<string, string | undefined>> });
  return render(tree as React.ReactElement);
}

// W-2 helper: build a minimal Headers-like object for next/headers mock
function makeHeadersMap(authValue: string | null) {
  return { get: (key: string) => (key.toLowerCase() === 'authorization' ? authValue : null) };
}

function restoreLoaderDefaults() {
  vi.mocked(getActiveChatModel).mockResolvedValue({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  });
  vi.mocked(getShopAppearance).mockResolvedValue({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
  });
  vi.mocked(prisma.product.count).mockResolvedValue(12);
}

describe('ChatPage server component — playground data flow', () => {
  beforeEach(() => {
    shellProps.length = 0;
    vi.clearAllMocks();
    restoreLoaderDefaults();
    vi.mocked(headers).mockResolvedValue(
      makeHeadersMap(null) as Awaited<ReturnType<typeof headers>>,
    );
  });

  it('no longer renders the standalone preview banner (copy moved into the shell header)', async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders the ChatShell client component', async () => {
    const { getByTestId } = await renderServerPage({ shop: 'example.myshopify.com' });
    expect(getByTestId('chat-shell-stub')).toBeInTheDocument();
  });

  it('passes the resolved shop and model displayName to ChatShell', async () => {
    await renderServerPage({ shop: 'example.myshopify.com' });
    expect(shellProps.at(-1)).toMatchObject({
      shop: 'example.myshopify.com',
      modelName: 'Gemini 2.5 Flash',
    });
  });

  it('loads the shop appearance and passes it through', async () => {
    await renderServerPage({ shop: 'example.myshopify.com' });
    expect(vi.mocked(getShopAppearance)).toHaveBeenCalledWith('example.myshopify.com');
    expect(shellProps.at(-1)?.appearance).toEqual({
      emptyStateVariant: 'hero',
      cardDensity: 'compact',
    });
  });

  it('counts the shop-scoped products and passes catalogCount', async () => {
    await renderServerPage({ shop: 'example.myshopify.com' });
    expect(vi.mocked(prisma.product.count)).toHaveBeenCalledWith({
      where: { shop: 'example.myshopify.com' },
    });
    expect(shellProps.at(-1)?.catalogCount).toBe(12);
  });

  it('skips the count query and passes 0 when no shop resolves', async () => {
    await renderServerPage({});
    expect(vi.mocked(prisma.product.count)).not.toHaveBeenCalled();
    expect(shellProps.at(-1)).toMatchObject({ shop: '', catalogCount: 0 });
  });

  it('degrades catalogCount to 0 when the count query fails (never crashes the page)', async () => {
    vi.mocked(prisma.product.count).mockRejectedValue(new Error('db down'));
    await renderServerPage({ shop: 'example.myshopify.com' });
    expect(shellProps.at(-1)?.catalogCount).toBe(0);
  });

  it('rejects a non-myshopify searchParams shop (falls back to empty shop)', async () => {
    await renderServerPage({ shop: 'evil.example.com' });
    expect(shellProps.at(-1)).toMatchObject({ shop: '' });
  });
});

// ---------------------------------------------------------------------------
// Phase 8.1 Plan 05 — W-2: session-resolved shop tests
// ---------------------------------------------------------------------------

describe('ChatPage server component — W-2 session-resolved shop (ADM-05)', () => {
  beforeEach(() => {
    shellProps.length = 0;
    vi.clearAllMocks();
    restoreLoaderDefaults();
  });

  it('resolves shop from Authorization Bearer session-token, ignoring searchParams.shop when both differ', async () => {
    // Arrange: Authorization header returns session-shop via decodeSessionToken
    vi.mocked(headers).mockResolvedValue(
      makeHeadersMap('Bearer valid-token') as Awaited<ReturnType<typeof headers>>,
    );
    vi.mocked(shopifyClient.session.decodeSessionToken).mockResolvedValue({
      dest: 'https://session-shop.myshopify.com/admin',
    } as Awaited<ReturnType<typeof shopifyClient.session.decodeSessionToken>>);

    // Act: render with a different shop in searchParams
    await renderServerPage({ shop: 'query-shop.myshopify.com' });

    // Assert: getActiveChatModel was called with the session-resolved shop
    expect(vi.mocked(getActiveChatModel)).toHaveBeenCalledWith('session-shop.myshopify.com');
    expect(vi.mocked(getActiveChatModel)).not.toHaveBeenCalledWith('query-shop.myshopify.com');
  });

  it('falls back to searchParams.shop when no Authorization header is present', async () => {
    // Arrange: no Authorization header
    vi.mocked(headers).mockResolvedValue(
      makeHeadersMap(null) as Awaited<ReturnType<typeof headers>>,
    );

    // Act
    await renderServerPage({ shop: 'fallback-shop.myshopify.com' });

    // Assert: falls back to searchParams value
    expect(vi.mocked(getActiveChatModel)).toHaveBeenCalledWith('fallback-shop.myshopify.com');
  });

  it('falls back to searchParams.shop when session-token decode throws', async () => {
    // Arrange: Authorization header present but decodeSessionToken throws
    vi.mocked(headers).mockResolvedValue(
      makeHeadersMap('Bearer bad-token') as Awaited<ReturnType<typeof headers>>,
    );
    vi.mocked(shopifyClient.session.decodeSessionToken).mockRejectedValue(
      new Error('invalid signature'),
    );

    // Act
    await renderServerPage({ shop: 'fallback-shop.myshopify.com' });

    // Assert: falls back to searchParams value
    expect(vi.mocked(getActiveChatModel)).toHaveBeenCalledWith('fallback-shop.myshopify.com');
  });
});
