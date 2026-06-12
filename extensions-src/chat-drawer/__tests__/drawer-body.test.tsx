/**
 * DrawerBody — drawer pane composition (drawer-redesign Task 8).
 *
 * The settings fetch was lifted into StorefrontDrawer: DrawerBody now
 * receives the parsed `settings` bundle as a prop and renders the compact
 * drawer panes (DrawerChat / DrawerHistory / DrawerSaved) instead of the
 * admin ChatPane / HistoryPanel / SavedProductsPanel. The drawer pane
 * components are mocked with prop-capturing stubs; the DbBacked store hooks
 * are mocked so jsdom never hits the network (Pitfall 3).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DEFAULT_SHOP_SETTINGS,
  type ShopSettingsBundle,
} from '@/lib/settings/contract';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

const chatProps: Array<Record<string, unknown>> = [];
const historyProps: Array<Record<string, unknown>> = [];
const savedProps: Array<Record<string, unknown>> = [];

vi.mock('@/extensions-src/chat-drawer/components/DrawerChat', () => ({
  DrawerChat: (props: Record<string, unknown>) => {
    chatProps.push(props);
    return <div data-testid="drawer-chat" />;
  },
}));

vi.mock('@/extensions-src/chat-drawer/components/DrawerHistory', () => ({
  DrawerHistory: (props: { onResume: (query: string) => void }) => {
    historyProps.push(props as unknown as Record<string, unknown>);
    return (
      <div data-testid="drawer-history">
        <button type="button" onClick={() => props.onResume('blue running shoes')}>
          resume-row
        </button>
      </div>
    );
  },
}));

vi.mock('@/extensions-src/chat-drawer/components/DrawerSaved', () => ({
  DrawerSaved: (props: Record<string, unknown>) => {
    savedProps.push(props);
    return <div data-testid="drawer-saved" />;
  },
}));

let historyItems: ChatHistoryItem[] = [];
let savedItems: ChatProduct[] = [];

vi.mock('@/lib/chat-ui', () => ({
  useDbBackedHistoryStore: () => ({
    items: historyItems,
    add: vi.fn(),
    clear: vi.fn(),
    refresh: vi.fn(),
  }),
  useDbBackedSavedProductsStore: () => ({
    items: savedItems,
    toggle: vi.fn(),
    clear: vi.fn(),
    has: () => false,
    refresh: vi.fn(),
  }),
}));

import DrawerBody from '@/extensions-src/chat-drawer/components/DrawerBody';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chatProps.length = 0;
  historyProps.length = 0;
  savedProps.length = 0;
  historyItems = [];
  savedItems = [];
  fetchMock = vi.fn().mockRejectedValue(new Error('network'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function settings(overrides: Partial<ShopSettingsBundle> = {}): ShopSettingsBundle {
  return { ...DEFAULT_SHOP_SETTINGS, ...overrides };
}

const baseProps = {
  shop: 'test.myshopify.com',
  visitorId: 'v-test-1',
  customerId: null,
} as const;

describe('DrawerBody — settings come from props, not a fetch', () => {
  it('never fetches — the settings lookup was lifted into StorefrontDrawer', () => {
    render(<DrawerBody activeTab="chat" {...baseProps} settings={settings()} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies settings.drawerAccent as --sd-accent on the pane wrapper', () => {
    render(
      <DrawerBody
        activeTab="chat"
        {...baseProps}
        settings={settings({ drawerAccent: '#008060' })}
      />,
    );

    const wrapper = screen.getByTestId('drawer-chat').parentElement as HTMLElement;
    expect(wrapper.style.getPropertyValue('--sd-accent')).toBe('#008060');
  });

  it('threads greeting and prompts into DrawerChat', () => {
    render(
      <DrawerBody
        activeTab="chat"
        {...baseProps}
        settings={settings({
          greetingMessage: 'Welcome to Acme!',
          suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
        })}
      />,
    );

    const props = chatProps[chatProps.length - 1];
    expect(props.greeting).toBe('Welcome to Acme!');
    expect(props.prompts).toEqual([{ icon: '☕', text: 'coffee' }]);
  });
});

describe('DrawerBody — drawer panes per tab', () => {
  it('renders DrawerChat on the chat tab', () => {
    render(<DrawerBody activeTab="chat" {...baseProps} settings={settings()} />);
    expect(screen.getByTestId('drawer-chat')).toBeInTheDocument();
  });

  it('renders DrawerHistory with the store items on the history tab', () => {
    historyItems = [
      { id: 'h1', query: 'desk lamp', timestamp: 'today', productCount: 2 } as ChatHistoryItem,
    ];
    render(<DrawerBody activeTab="history" {...baseProps} settings={settings()} />);

    expect(screen.getByTestId('drawer-history')).toBeInTheDocument();
    expect(historyProps[historyProps.length - 1].items).toEqual(historyItems);
  });

  it('renders DrawerSaved with the store items on the saved tab', () => {
    savedItems = [{ id: 'p1', title: 'Lamp' } as ChatProduct];
    render(<DrawerBody activeTab="saved" {...baseProps} settings={settings()} />);

    expect(screen.getByTestId('drawer-saved')).toBeInTheDocument();
    expect(savedProps[savedProps.length - 1].products).toEqual(savedItems);
  });

  it('passes the saved-product id set into DrawerChat', () => {
    savedItems = [{ id: 'p1', title: 'Lamp' } as ChatProduct];
    render(<DrawerBody activeTab="chat" {...baseProps} settings={settings()} />);

    const ids = chatProps[chatProps.length - 1].savedProductIds as Set<string>;
    expect(ids.has('p1')).toBe(true);
  });
});

describe('DrawerBody — onCountsChange (tab badges)', () => {
  it('reports history/saved counts to the parent', () => {
    historyItems = [
      { id: 'h1', query: 'a', timestamp: 't', productCount: 0 } as ChatHistoryItem,
      { id: 'h2', query: 'b', timestamp: 't', productCount: 0 } as ChatHistoryItem,
    ];
    savedItems = [{ id: 'p1', title: 'Lamp' } as ChatProduct];

    const onCountsChange = vi.fn();
    render(
      <DrawerBody
        activeTab="chat"
        {...baseProps}
        settings={settings()}
        onCountsChange={onCountsChange}
      />,
    );

    expect(onCountsChange).toHaveBeenCalledWith({ history: 2, saved: 1 });
  });
});

describe('DrawerBody — history resume', () => {
  it('resume asks the parent for the chat tab and auto-submits the query', async () => {
    const user = userEvent.setup();
    const onSwitchToChat = vi.fn();
    const { rerender } = render(
      <DrawerBody
        activeTab="history"
        {...baseProps}
        settings={settings()}
        onSwitchToChat={onSwitchToChat}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'resume-row' }));
    expect(onSwitchToChat).toHaveBeenCalledTimes(1);

    rerender(
      <DrawerBody
        activeTab="chat"
        {...baseProps}
        settings={settings()}
        onSwitchToChat={onSwitchToChat}
      />,
    );

    const props = chatProps[chatProps.length - 1];
    const autoSubmit = props.autoSubmitQuery as { id: number; query: string } | null;
    expect(autoSubmit).not.toBeNull();
    expect(autoSubmit?.query).toBe('blue running shoes');
    expect(typeof autoSubmit?.id).toBe('number');
  });

  it('clears a consumed resume so leaving and re-entering the chat tab does not re-submit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DrawerBody
        activeTab="history"
        {...baseProps}
        settings={settings()}
        onSwitchToChat={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'resume-row' }));
    rerender(<DrawerBody activeTab="chat" {...baseProps} settings={settings()} />);

    const props = chatProps[chatProps.length - 1];
    expect(props.autoSubmitQuery).not.toBeNull();

    await act(async () => {
      (props.onAutoSubmitConsumed as () => void)();
    });

    rerender(<DrawerBody activeTab="saved" {...baseProps} settings={settings()} />);
    rerender(<DrawerBody activeTab="chat" {...baseProps} settings={settings()} />);

    expect(chatProps[chatProps.length - 1].autoSubmitQuery).toBeNull();
  });
});
