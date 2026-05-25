import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Phase 4 Plan 6 — page.tsx server-component banner test.
 *
 * page.tsx is an async Server Component that:
 *   1. awaits searchParams (Next 15+ async pattern)
 *   2. awaits getActiveChatModel(shop)
 *   3. renders a single banner div above <ChatShell />
 *
 * We invoke the async component and unwrap its returned JSX, then mount it
 * with @testing-library/react. ChatShell is mocked to a stub so this test
 * only asserts the banner's contract (typography, ARIA, dynamic
 * interpolation, style tokens) per UI-SPEC.md Copywriting + Accessibility +
 * Color rows.
 */

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: vi.fn(async (_shop: string) => ({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  })),
}));

vi.mock('@/components/chat/chat-shell', () => ({
  ChatShell: () => <div data-testid="chat-shell-stub">chat shell</div>,
}));

import ChatPage from '@/app/(embedded)/chat/page';

async function renderServerPage(searchParams: Record<string, string | undefined>) {
  const tree = await ChatPage({
    searchParams: Promise.resolve(searchParams),
  } as { searchParams: Promise<Record<string, string | undefined>> });
  return render(tree as React.ReactElement);
}

describe('ChatPage server component — preview-mode banner', () => {
  it('renders the banner with byte-precise em-dash and middle-dot glyphs', async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    const text = banner?.textContent ?? '';
    // U+2014 em-dash and U+00B7 middle-dot must be present, not hyphens.
    expect(text.includes('—')).toBe(true); // —
    expect(text.includes('·')).toBe(true); // ·
    expect(text).toContain('Preview mode');
    expect(text).toContain('using your real catalog');
    expect(text).toContain('Model:');
  });

  it("dynamically interpolates model.displayName into the banner text", async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    expect(banner?.textContent).toContain('Gemini 2.5 Flash');
  });

  it("has aria-live='off' (static banner — not a transient update)", async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    expect(banner?.getAttribute('aria-live')).toBe('off');
  });

  it('has the exact UI-SPEC.md aria-label phrase including the displayName', async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    expect(banner?.getAttribute('aria-label')).toBe(
      'Chat playground preview mode banner. Active model: Gemini 2.5 Flash.',
    );
  });

  it('wraps the displayName in a span with text-foreground font-semibold', async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    const span = banner?.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.className).toContain('text-foreground');
    expect(span?.className).toContain('font-semibold');
    expect(span?.textContent).toBe('Gemini 2.5 Flash');
  });

  it('uses the bg-muted/40 Tailwind background token per UI-SPEC.md Color row', async () => {
    const { container } = await renderServerPage({ shop: 'example.myshopify.com' });
    const banner = container.querySelector('[role="status"]');
    expect(banner?.className).toContain('bg-muted/40');
    expect(banner?.className).toContain('text-muted-foreground');
    expect(banner?.className).toContain('text-xs');
  });

  it('renders the ChatShell client component below the banner', async () => {
    const { getByTestId } = await renderServerPage({ shop: 'example.myshopify.com' });
    expect(getByTestId('chat-shell-stub')).toBeInTheDocument();
  });

  it('falls back to empty shop when searchParams.shop is missing (no crash)', async () => {
    const { container } = await renderServerPage({});
    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Gemini 2.5 Flash');
  });
});
