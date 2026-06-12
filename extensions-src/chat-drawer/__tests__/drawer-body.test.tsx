/**
 * DrawerBody — appearance fetch + resume wiring (chat-redesign Task 14).
 *
 * Mocks the @/lib/chat-ui barrel (same idiom as StorefrontDrawer.test.tsx)
 * but with prop-capturing stubs so the suite can pin what DrawerBody threads
 * into ChatPane / SavedProductsPanel. The appearance module is intentionally
 * NOT mocked — DrawerBody imports it from the `@/lib/chat-ui/appearance`
 * sub-path and its parseAppearance/DEFAULT_APPEARANCE are pure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const chatPaneProps: Array<Record<string, unknown>> = [];
const savedPanelProps: Array<Record<string, unknown>> = [];

vi.mock('@/lib/chat-ui', () => ({
  ChatPane: (props: Record<string, unknown>) => {
    chatPaneProps.push(props);
    return <div data-testid="chat-pane" />;
  },
  HistoryPanel: ({ onResume }: { onResume: (query: string) => void }) => (
    <div data-testid="history-panel">
      <button type="button" onClick={() => onResume('blue running shoes')}>
        resume-row
      </button>
    </div>
  ),
  SavedProductsPanel: (props: Record<string, unknown>) => {
    savedPanelProps.push(props);
    return <div data-testid="saved-products-panel" />;
  },
  useDbBackedHistoryStore: () => ({ items: [], add: vi.fn(), clear: vi.fn(), refresh: vi.fn() }),
  useDbBackedSavedProductsStore: () => ({
    items: [],
    toggle: vi.fn(),
    clear: vi.fn(),
    has: () => false,
    refresh: vi.fn(),
  }),
}));

import DrawerBody from '@/extensions-src/chat-drawer/components/DrawerBody';

let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chatPaneProps.length = 0;
  savedPanelProps.length = 0;
  fetchMock = vi.fn(
    () =>
      new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
        resolveFetch = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  shop: 'test.myshopify.com',
  visitorId: 'v-test-1',
  customerId: null,
} as const;

async function resolveAppearance(body: unknown): Promise<void> {
  await act(async () => {
    resolveFetch({ ok: true, json: async () => body });
  });
}

describe('DrawerBody — appearance fetch (Task 14)', () => {
  it('fetches the app-proxy appearance meta exactly once', async () => {
    const { rerender } = render(<DrawerBody activeTab="chat" {...baseProps} />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/apps/smartdiscovery/_meta/appearance');

    // Tab flips must not re-trigger the one-shot fetch.
    rerender(<DrawerBody activeTab="saved" {...baseProps} />);
    rerender(<DrawerBody activeTab="chat" {...baseProps} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders ChatPane with DEFAULT_APPEARANCE before the fetch resolves', () => {
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    expect(screen.getByTestId('chat-pane')).toBeInTheDocument();
    const props = chatPaneProps[chatPaneProps.length - 1];
    expect(props.density).toBe('standard');
    expect(props.emptyStateVariant).toBe('cards');
  });

  it('threads fetched density + emptyStateVariant into ChatPane', async () => {
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    await resolveAppearance({ emptyStateVariant: 'hero', cardDensity: 'compact' });

    const props = chatPaneProps[chatPaneProps.length - 1];
    expect(props.density).toBe('compact');
    expect(props.emptyStateVariant).toBe('hero');
  });

  it('threads fetched density into SavedProductsPanel', async () => {
    render(<DrawerBody activeTab="saved" {...baseProps} />);

    await resolveAppearance({ emptyStateVariant: 'hero', cardDensity: 'compact' });

    const props = savedPanelProps[savedPanelProps.length - 1];
    expect(props.density).toBe('compact');
  });
});

describe('DrawerBody — settings bundle (settings-redesign Task 6)', () => {
  it('applies the fetched drawerAccent as --sd-accent on the pane wrapper', async () => {
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    // Default accent before the fetch resolves.
    let wrapper = screen.getByTestId('chat-pane').parentElement as HTMLElement;
    expect(wrapper.style.getPropertyValue('--sd-accent')).toBe('#5B4FE9');

    await resolveAppearance({ drawerAccent: '#008060' });

    wrapper = screen.getByTestId('chat-pane').parentElement as HTMLElement;
    expect(wrapper.style.getPropertyValue('--sd-accent')).toBe('#008060');
  });

  it('threads greeting and prompts into ChatPane', async () => {
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    await resolveAppearance({
      greetingMessage: 'Welcome to Acme!',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
    });

    const props = chatPaneProps[chatPaneProps.length - 1];
    expect(props.greeting).toBe('Welcome to Acme!');
    expect(props.prompts).toEqual([{ icon: '☕', text: 'coffee' }]);
  });

  it('drawerEnabled:false renders nothing and notifies the parent', async () => {
    const onDisabled = vi.fn();
    render(<DrawerBody activeTab="chat" {...baseProps} onDisabled={onDisabled} />);

    await resolveAppearance({ drawerEnabled: false });

    expect(screen.queryByTestId('chat-pane')).not.toBeInTheDocument();
    expect(onDisabled).toHaveBeenCalledTimes(1);
  });

  it('design mode + editorPreviewVisible:false hides the drawer body', async () => {
    vi.stubGlobal('Shopify', { designMode: true });
    const onDisabled = vi.fn();
    render(<DrawerBody activeTab="chat" {...baseProps} onDisabled={onDisabled} />);

    await resolveAppearance({ editorPreviewVisible: false });

    expect(screen.queryByTestId('chat-pane')).not.toBeInTheDocument();
    expect(onDisabled).toHaveBeenCalled();
  });

  it('design mode with editorPreviewVisible:true keeps the drawer body', async () => {
    vi.stubGlobal('Shopify', { designMode: true });
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    await resolveAppearance({ editorPreviewVisible: true });

    expect(screen.getByTestId('chat-pane')).toBeInTheDocument();
  });

  it('storefront (non-design-mode) ignores editorPreviewVisible:false', async () => {
    render(<DrawerBody activeTab="chat" {...baseProps} />);

    await resolveAppearance({ editorPreviewVisible: false });

    expect(screen.getByTestId('chat-pane')).toBeInTheDocument();
  });
});

describe('DrawerBody — history resume (Task 14)', () => {
  it('resume asks the parent for the chat tab and auto-submits the query', async () => {
    const user = userEvent.setup();
    const onSwitchToChat = vi.fn();
    const { rerender } = render(
      <DrawerBody activeTab="history" {...baseProps} onSwitchToChat={onSwitchToChat} />,
    );

    await user.click(screen.getByRole('button', { name: 'resume-row' }));
    expect(onSwitchToChat).toHaveBeenCalledTimes(1);

    // Parent owns the tab state — simulate it switching back to chat.
    rerender(<DrawerBody activeTab="chat" {...baseProps} onSwitchToChat={onSwitchToChat} />);

    const props = chatPaneProps[chatPaneProps.length - 1];
    const autoSubmit = props.autoSubmitQuery as { id: number; query: string } | null;
    expect(autoSubmit).not.toBeNull();
    expect(autoSubmit?.query).toBe('blue running shoes');
    expect(typeof autoSubmit?.id).toBe('number');
  });

  it('clears a consumed resume so leaving and re-entering the chat tab does not re-submit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DrawerBody activeTab="history" {...baseProps} onSwitchToChat={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'resume-row' }));
    rerender(<DrawerBody activeTab="chat" {...baseProps} />);

    const props = chatPaneProps[chatPaneProps.length - 1];
    expect(props.autoSubmitQuery).not.toBeNull();

    // The real ChatPane fires this right after the auto-submit; the stubbed
    // pane reports consumption manually.
    await act(async () => {
      (props.onAutoSubmitConsumed as () => void)();
    });

    // Tab away and back — ChatPane unmounts and remounts (fresh
    // lastAutoSubmitIdRef), so a stale query here would re-fire the search.
    rerender(<DrawerBody activeTab="saved" {...baseProps} />);
    rerender(<DrawerBody activeTab="chat" {...baseProps} />);

    expect(chatPaneProps[chatPaneProps.length - 1].autoSubmitQuery).toBeNull();
  });
});
