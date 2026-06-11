import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatShell } from '../chat-shell';
import { ChatPane } from '@/lib/chat-ui/components/chat-pane';
import type { ChatIdentityAdapter } from '@/lib/chat-ui';

/**
 * Viewport layout invariants (2026-06-11 design spec).
 *
 * The /chat page must be exactly window height with internal scrolling:
 * an unbroken flex height chain instead of brittle calc() offsets. jsdom
 * cannot measure real scroll geometry, so these tests pin the class-level
 * invariants the chain depends on.
 */

vi.mock('@/lib/chat-ui', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/chat-ui')>('@/lib/chat-ui');
  return {
    ...actual,
    ChatPane: () => <div data-testid="chat-pane-stub" />,
    HistoryPanel: () => <div data-testid="history-stub" />,
    SavedProductsPanel: () => <div data-testid="saved-stub" />,
  };
});

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({ messages: [], sendMessage: vi.fn(), status: 'ready' }),
}));

const mockAdapter: ChatIdentityAdapter = {
  endpoint: '/api/chat',
  getAuthHeaders: async () => ({}),
  getRequestBody: async () => ({}),
};

describe('ChatShell viewport layout', () => {
  it('uses no calc() height offsets anywhere', () => {
    const { container } = render(<ChatShell shop="test.myshopify.com" />);
    expect(container.querySelector('[class*="calc"]')).toBeNull();
  });

  it('fills its parent and stacks as a flex column', () => {
    const { container } = render(<ChatShell shop="test.myshopify.com" />);
    const root = container.firstElementChild!;
    expect(root.className).toContain('h-full');
    expect(root.className).toContain('flex-col');
  });

  it('lets the tabs area flex and clamps it with min-h-0', () => {
    const { container } = render(<ChatShell shop="test.myshopify.com" />);
    const tabs = container.querySelector('[data-slot="tabs"]')!;
    expect(tabs.className).toContain('flex-1');
    expect(tabs.className).toContain('min-h-0');
    const contents = container.querySelector('[data-slot="tabs-contents"]')!;
    expect(contents.className).toContain('flex-1');
    expect(contents.className).toContain('min-h-0');
  });
});

describe('ChatPane viewport layout', () => {
  it('scrolls the messages list internally and pins the composer', () => {
    const { container } = render(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set<string>()}
        onToggleSave={() => {}}
        onHistoryAdd={() => {}}
      />,
    );
    const root = container.firstElementChild!;
    expect(root.className).toContain('h-full');
    expect(root.className).not.toContain('stretch');

    const messages = root.firstElementChild!;
    expect(messages.className).toContain('flex-1');
    expect(messages.className).toContain('min-h-0');
    expect(messages.className).toContain('overflow-y-auto');

    const composer = root.lastElementChild!;
    expect(composer.className).toContain('shrink-0');
    expect(composer.className).not.toContain('size-full');
  });
});
