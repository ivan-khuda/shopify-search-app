import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { ShopAppearance } from '@/lib/chat-ui/appearance';

/**
 * Chat-redesign Task 12 — app/(embedded)/chat/chat-shell.tsx client component.
 *
 * ChatShell is the embedded-admin "Playground" shell: header (heading +
 * preview pill + model name), tabs with count badges, density segmented
 * control (optimistic local state + PATCH /api/settings/appearance), New
 * chat remount, and history-resume wiring into ChatPane.
 *
 * This test mocks `@/lib/chat-ui` so the surface under test is the
 * chat-shell wiring only — ChatPane, HistoryPanel, and SavedProductsPanel
 * are replaced with prop-capturing stubs. Appearance constants come from
 * `@/lib/chat-ui/appearance` (a separate module, intentionally unmocked).
 */

const product: ChatProduct = {
  id: 'product-1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
};

const historyItem: ChatHistoryItem = {
  id: 'history-1',
  query: 'running shoes',
  timestamp: '10:30 AM',
  productCount: 1,
};

const { chatPaneProps, savedPanelProps } = vi.hoisted(() => ({
  chatPaneProps: [] as Array<Record<string, unknown>>,
  savedPanelProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/chat-ui', () => ({
  ChatPane: (props: {
    adapter: unknown;
    savedProductIds: Set<string>;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
    onToggleSave: (product: ChatProduct) => void;
    autoSubmitQuery?: { id: number; query: string } | null;
  }) => {
    chatPaneProps.push(props as unknown as Record<string, unknown>);
    return (
      <div data-testid="chat-pane-stub">
        <button type="button" onClick={() => props.onHistoryAdd(historyItem)}>
          Add history item
        </button>
        <button type="button" onClick={() => props.onToggleSave(product)}>
          Toggle saved product
        </button>
      </div>
    );
  },
  HistoryPanel: ({
    items,
    onClear,
    onResume,
  }: {
    items: ChatHistoryItem[];
    onClear: () => void;
    onResume: (query: string) => void;
  }) => (
    <div data-testid="history-panel-stub">
      {items.length === 0 ? (
        <p>No history yet</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onResume(item.query)}>
                resume {item.query}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClear}>
        clear history
      </button>
    </div>
  ),
  SavedProductsPanel: (props: {
    products: ChatProduct[];
    onToggleSave: (product: ChatProduct) => void;
    density?: string;
  }) => {
    savedPanelProps.push(props as unknown as Record<string, unknown>);
    return (
      <div data-testid="saved-panel-stub">
        {props.products.length === 0 ? (
          <p>Nothing saved</p>
        ) : (
          <ul>
            {props.products.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => props.onToggleSave(p)}>
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
}));

import { ChatShell } from '../chat-shell';

const appearance: ShopAppearance = {
  emptyStateVariant: 'cards',
  cardDensity: 'standard',
};

const defaultProps = {
  shop: 'example.myshopify.com',
  modelName: 'Gemini 2.5 Flash',
  appearance,
  catalogCount: 12,
};

let shopifyIdToken: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chatPaneProps.length = 0;
  savedPanelProps.length = 0;
  window.localStorage.clear();

  shopifyIdToken = vi.fn().mockResolvedValue('tok');
  Object.defineProperty(globalThis, 'shopify', {
    configurable: true,
    writable: true,
    value: { idToken: shopifyIdToken, toast: { show: vi.fn() } },
  });

  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatShell header (playground redesign)', () => {
  it('renders the Playground heading, preview-mode pill, and model name', () => {
    render(<ChatShell {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Playground' })).toBeInTheDocument();
    // U+2014 em-dash glyph, not a hyphen.
    expect(
      screen.getByText('Preview mode — using your real catalog'),
    ).toBeInTheDocument();
    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    // U+00B7 middle-dot before "Model:".
    expect(screen.getByText(/· Model:/)).toBeInTheDocument();
  });

  it('sets the --sd-accent CSS variable on the shell root', () => {
    const { container } = render(<ChatShell {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--sd-accent')).toBe('#5B4FE9');
  });
});

describe('ChatShell tab badges', () => {
  it('shows history and saved counts as badges once items exist', () => {
    render(<ChatShell {...defaultProps} />);

    const historyTab = screen.getByRole('tab', { name: /history/i });
    const savedTab = screen.getByRole('tab', { name: /saved/i });
    expect(historyTab.textContent).not.toMatch(/\d/);
    expect(savedTab.textContent).not.toMatch(/\d/);

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle saved product/i }));

    expect(screen.getByRole('tab', { name: /history/i }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /saved/i }).textContent).toContain('1');
  });
});

describe('ChatShell density control', () => {
  it('renders the three density options with the appearance value active', () => {
    render(<ChatShell {...defaultProps} />);

    const compact = screen.getByRole('button', { name: 'Compact' });
    const standard = screen.getByRole('button', { name: 'Standard' });
    const hero = screen.getByRole('button', { name: 'Hero' });

    expect(compact).toHaveAttribute('aria-pressed', 'false');
    expect(standard).toHaveAttribute('aria-pressed', 'true');
    expect(hero).toHaveAttribute('aria-pressed', 'false');
  });

  it('optimistically updates and PATCHes /api/settings/appearance on click', async () => {
    render(<ChatShell {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));

    expect(
      screen.getByRole('button', { name: 'Compact' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Optimistic density threads into ChatPane immediately.
    expect(chatPaneProps.at(-1)?.density).toBe('compact');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings/appearance',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ cardDensity: 'compact' }),
        }),
      );
    });
    expect(shopifyIdToken).toHaveBeenCalled();
  });

  it('threads density into SavedProductsPanel', () => {
    render(<ChatShell {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hero' }));
    expect(savedPanelProps.at(-1)?.density).toBe('hero');
  });
});

describe('ChatShell ChatPane wiring', () => {
  it('threads emptyStateVariant, catalogCount, and modelName into ChatPane', () => {
    render(
      <ChatShell
        {...defaultProps}
        appearance={{ emptyStateVariant: 'hero', cardDensity: 'compact' }}
        catalogCount={42}
      />,
    );

    const props = chatPaneProps.at(-1)!;
    expect(props.emptyStateVariant).toBe('hero');
    expect(props.density).toBe('compact');
    expect(props.catalogCount).toBe(42);
    expect(props.modelName).toBe('Gemini 2.5 Flash');
  });
});

describe('ChatShell history resume', () => {
  it('switches to the chat tab and passes the query as autoSubmitQuery', () => {
    render(<ChatShell {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    fireEvent.click(screen.getByRole('button', { name: /resume running shoes/i }));

    expect(screen.getByRole('tab', { name: /chat/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    const resume = chatPaneProps.at(-1)?.autoSubmitQuery as {
      id: number;
      query: string;
    };
    expect(resume).toBeTruthy();
    expect(resume.query).toBe('running shoes');
    expect(typeof resume.id).toBe('number');
  });
});

describe('ChatShell tabs (embedded surface)', () => {
  it('shares history and saved product state across tabs', () => {
    render(<ChatShell {...defaultProps} />);

    expect(screen.getByText('No history yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing saved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle saved product/i }));

    expect(screen.getByRole('button', { name: /resume running shoes/i })).toBeInTheDocument();
    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
  });
});
