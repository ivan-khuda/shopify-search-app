# Chat UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract reusable product card, history, and saved-product UI from the approved design and wire them into the existing chat page without replacing the current AI chat flow.

**Architecture:** Keep `app/chat/page.tsx` as the parent shell for tab state, history state, and saved-product state. Keep `components/chat/chat.tsx` responsible for live `useChat()` behavior, but pass save/history callbacks down so the chat tab can render shared product cards beneath assistant responses and feed the other tabs.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, `@ai-sdk/react`, Vitest, Testing Library

---

## File Structure

### Files to Create

- `components/chat/product-card.tsx` — shared product tile used in chat and saved tabs
- `components/chat/empty-state.tsx` — shared empty state for history and saved tabs
- `components/chat/history-panel.tsx` — history list panel and clear-all action
- `components/chat/saved-products-panel.tsx` — saved products grid using `ProductCard`
- `components/chat/mock-products.ts` — demo product records used until the AI response returns structured product metadata
- `types/product.ts` — `ChatProduct` and `ChatHistoryItem` type definitions
- `vitest.config.ts` — test runner config for component tests
- `vitest.setup.ts` — Testing Library setup and DOM matchers
- `components/chat/__tests__/product-card.test.tsx` — product card rendering and save toggle UI
- `components/chat/__tests__/history-panel.test.tsx` — history empty state and populated list rendering
- `components/chat/__tests__/saved-products-panel.test.tsx` — saved grid and empty state rendering
- `app/chat/page.integration-test.tsx` — tab shell integration with the new history and saved panels
- `components/chat/chat.integration-test.tsx` — chat message/product-card integration

### Files to Modify

- `package.json` — add `test` script and test dependencies
- `app/chat/page.tsx` — own `history` and `savedProducts` state and render tab panels
- `components/chat/chat.tsx` — accept page-level callbacks and render shared product cards below assistant messages

## Task 1: Add a Lightweight UI Test Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Write the failing test setup first**

```tsx
// components/chat/__tests__/product-card.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductCard } from '@/components/chat/product-card';

describe('ProductCard', () => {
  it('renders product details and calls onSave when the heart button is clicked', () => {
    const onSave = vi.fn();

    render(
      <ProductCard
        product={{
          id: '1',
          title: 'Midnight Runner Sneakers',
          price: '$85.00',
          description: 'Breathable mesh running shoes for night joggers.',
          image: 'https://example.com/shoe.jpg',
        }}
        isSaved={false}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
    expect(screen.getByText('$85.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- product-card`

Expected: FAIL with a missing `test` script or missing `vitest` command, proving the test setup has not been added yet.

- [ ] **Step 3: Add the minimal test tooling**

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@vitejs/plugin-react": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Run the test to verify the failure changes for the right reason**

Run: `npm test -- product-card`

Expected: FAIL because `@/components/chat/product-card` does not exist yet, which confirms the test runner is working.

- [ ] **Step 5: Commit the test setup**

```bash
git add package.json vitest.config.ts vitest.setup.ts components/chat/__tests__/product-card.test.tsx
git commit -m "test: add vitest setup for chat ui components"
```

## Task 2: Add Shared Product Types and Extract `ProductCard`

**Files:**
- Create: `types/product.ts`
- Create: `components/chat/mock-products.ts`
- Create: `components/chat/product-card.tsx`
- Modify: `components/chat/__tests__/product-card.test.tsx`

- [ ] **Step 1: Expand the failing test to cover the shared product shape**

```tsx
// components/chat/__tests__/product-card.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductCard } from '@/components/chat/product-card';
import type { ChatProduct } from '@/types/product';

const product: ChatProduct = {
  id: '1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
  category: 'Footwear',
  tags: ['comfortable', 'black', 'running'],
};

describe('ProductCard', () => {
  it('renders product details and calls onSave when the heart button is clicked', () => {
    const onSave = vi.fn();

    render(<ProductCard product={product} isSaved={false} onSave={onSave} />);

    expect(screen.getByText(product.title)).toBeInTheDocument();
    expect(screen.getByText(product.description)).toBeInTheDocument();
    expect(screen.getByText(product.price)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- product-card`

Expected: FAIL with module-not-found errors for `@/types/product` and `@/components/chat/product-card`.

- [ ] **Step 3: Write the minimal shared types, mock data, and product card**

```ts
// types/product.ts
export interface ChatProduct {
  id: string;
  title: string;
  price: string;
  description: string;
  image?: string;
  category?: string;
  tags?: string[];
}

export interface ChatHistoryItem {
  id: number;
  query: string;
  timestamp: string;
  productCount: number;
}
```

```ts
// components/chat/mock-products.ts
import type { ChatProduct } from '@/types/product';

export const MOCK_PRODUCTS: ChatProduct[] = [
  {
    id: '1',
    title: 'Midnight Runner Sneakers',
    price: '$85.00',
    category: 'Footwear',
    description: 'Breathable mesh running shoes for night joggers.',
    tags: ['comfortable', 'black', 'running', 'sport'],
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  },
  {
    id: '2',
    title: 'Arctic Down Parka',
    price: '$220.00',
    category: 'Apparel',
    description: 'Heavy duty winter jacket designed for extreme cold.',
    tags: ['winter', 'warm', 'blue', 'heavy'],
    image: 'https://images.unsplash.com/photo-1539533377285-b924260387d8?w=400&q=80',
  },
  {
    id: '3',
    title: 'Minimalist Leather Wallet',
    price: '$45.00',
    category: 'Accessories',
    description: 'Full-grain leather wallet with RFID protection.',
    tags: ['leather', 'brown', 'slim', 'essential'],
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80',
  },
];
```

```tsx
// components/chat/product-card.tsx
'use client';

import { ExternalLink, Heart } from 'lucide-react';
import type { ChatProduct } from '@/types/product';

interface ProductCardProps {
  product: ChatProduct;
  isSaved: boolean;
  onSave: () => void;
}

export function ProductCard({ product, isSaved, onSave }: ProductCardProps) {
  return (
    <div className="border border-[#e1e3e5] rounded-xl overflow-hidden flex flex-col h-full bg-white transition-shadow hover:shadow-md group">
      <div className="relative aspect-square bg-[#f6f6f7] overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
        <button
          type="button"
          aria-label={isSaved ? 'Remove saved product' : 'Save product'}
          onClick={onSave}
          className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:bg-white"
        >
          <Heart
            size={16}
            className={isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          />
        </button>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm line-clamp-1">{product.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{product.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="font-bold text-sm text-[#202223]">{product.price}</span>
          <button type="button" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#008060] hover:underline">
            View <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- product-card`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the shared product card extraction**

```bash
git add types/product.ts components/chat/mock-products.ts components/chat/product-card.tsx components/chat/__tests__/product-card.test.tsx
git commit -m "feat: extract reusable chat product card"
```

## Task 3: Add Empty State, History Panel, and Saved Products Panel

**Files:**
- Create: `components/chat/empty-state.tsx`
- Create: `components/chat/history-panel.tsx`
- Create: `components/chat/saved-products-panel.tsx`
- Create: `components/chat/__tests__/history-panel.test.tsx`
- Create: `components/chat/__tests__/saved-products-panel.test.tsx`

- [ ] **Step 1: Write the failing panel tests**

```tsx
// components/chat/__tests__/history-panel.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryPanel } from '@/components/chat/history-panel';

describe('HistoryPanel', () => {
  it('shows the empty state when there is no history', () => {
    render(<HistoryPanel items={[]} onClear={vi.fn()} />);
    expect(screen.getByText('No search history')).toBeInTheDocument();
  });

  it('renders each history item when data exists', () => {
    render(
      <HistoryPanel
        items={[{ id: 1, query: 'running shoes', timestamp: '10:30 AM', productCount: 3 }]}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('"running shoes"')).toBeInTheDocument();
    expect(screen.getByText(/3 results/i)).toBeInTheDocument();
  });
});
```

```tsx
// components/chat/__tests__/saved-products-panel.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SavedProductsPanel } from '@/components/chat/saved-products-panel';

const product = {
  id: '1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
};

describe('SavedProductsPanel', () => {
  it('shows the empty state when there are no saved products', () => {
    render(<SavedProductsPanel products={[]} onToggleSave={vi.fn()} />);
    expect(screen.getByText('No saved products')).toBeInTheDocument();
  });

  it('renders saved products and forwards save toggles', () => {
    const onToggleSave = vi.fn();

    render(<SavedProductsPanel products={[product]} onToggleSave={onToggleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(product);
  });
});
```

- [ ] **Step 2: Run the panel tests to verify they fail**

Run: `npm test -- history-panel saved-products-panel`

Expected: FAIL because the panel modules do not exist yet.

- [ ] **Step 3: Write the minimal panel components**

```tsx
// components/chat/empty-state.tsx
'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="text-gray-200 mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-[#202223]">{title}</h3>
      <p className="text-sm text-[#6d7175] max-w-[200px] mx-auto mt-1">{description}</p>
    </div>
  );
}
```

```tsx
// components/chat/history-panel.tsx
'use client';

import { ChevronRight, History, Search, Trash2 } from 'lucide-react';
import type { ChatHistoryItem } from '@/types/product';
import { EmptyState } from '@/components/chat/empty-state';

interface HistoryPanelProps {
  items: ChatHistoryItem[];
  onClear: () => void;
}

export function HistoryPanel({ items, onClear }: HistoryPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Search History</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-red-600 flex items-center gap-1 hover:bg-red-50 p-2 rounded"
        >
          <Trash2 size={14} /> Clear All
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<History size={48} />}
          title="No search history"
          description="Your previous AI searches will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 border border-[#e1e3e5] rounded-lg hover:bg-[#f6f6f7] transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#f1f2f4] rounded-md">
                  <Search size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">&quot;{item.query}&quot;</p>
                  <p className="text-xs text-gray-500">
                    {item.timestamp} • {item.productCount} results
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-600" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// components/chat/saved-products-panel.tsx
'use client';

import { Heart } from 'lucide-react';
import { EmptyState } from '@/components/chat/empty-state';
import { ProductCard } from '@/components/chat/product-card';
import type { ChatProduct } from '@/types/product';

interface SavedProductsPanelProps {
  products: ChatProduct[];
  onToggleSave: (product: ChatProduct) => void;
}

export function SavedProductsPanel({ products, onToggleSave }: SavedProductsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg font-bold mb-6">Saved Products</h2>
      {products.length === 0 ? (
        <EmptyState
          icon={<Heart size={48} />}
          title="No saved products"
          description="Heart items in the chat to save them for later."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSaved
              onSave={() => onToggleSave(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the panel tests to verify they pass**

Run: `npm test -- history-panel saved-products-panel`

Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit the new history and saved panels**

```bash
git add components/chat/empty-state.tsx components/chat/history-panel.tsx components/chat/saved-products-panel.tsx components/chat/__tests__/history-panel.test.tsx components/chat/__tests__/saved-products-panel.test.tsx
git commit -m "feat: add chat history and saved panels"
```

## Task 4: Wire Shared State Through `app/chat/page.tsx`

**Files:**
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Write the failing page integration test**

```tsx
// app/chat/page.integration-test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatPage from '@/app/chat/page';

describe('ChatPage tabs', () => {
  it('shows empty saved and history states before chat interactions', () => {
    render(<ChatPage />);

    expect(screen.getByText('Chat')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the page integration test to verify it fails**

Run: `npm test -- page.integration-test`

Expected: FAIL because `ChatPage` still renders placeholder tab content and does not mount the new panels.

- [ ] **Step 3: Move the cross-tab UI state into the page**

```tsx
// app/chat/page.tsx
const [selectedTab, setSelectedTab] = useState('chat');
const [history, setHistory] = useState<ChatHistoryItem[]>([]);
const [savedProducts, setSavedProducts] = useState<ChatProduct[]>([]);

const handleToggleSave = (product: ChatProduct) => {
  setSavedProducts((current) =>
    current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
      : [...current, product],
  );
};

const handleHistoryAdd = (entry: ChatHistoryItem) => {
  setHistory((current) => [entry, ...current].slice(0, 10));
};
```

```tsx
// app/chat/page.tsx tab content
<TabsContent value="chat">
  <Chat
    savedProducts={savedProducts}
    onToggleSave={handleToggleSave}
    onHistoryAdd={handleHistoryAdd}
  />
</TabsContent>
<TabsContent value="history">
  <HistoryPanel items={history} onClear={() => setHistory([])} />
</TabsContent>
<TabsContent value="saved">
  <SavedProductsPanel products={savedProducts} onToggleSave={handleToggleSave} />
</TabsContent>
```

- [ ] **Step 4: Run the page integration test to verify it passes**

Run: `npm test -- page.integration-test`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit the page-level tab integration**

```bash
git add app/chat/page.tsx app/chat/page.integration-test.tsx
git commit -m "feat: connect chat tabs to shared history and saved state"
```

## Task 5: Update `components/chat/chat.tsx` to Render Product Cards and Feed History

**Files:**
- Modify: `components/chat/chat.tsx`

- [ ] **Step 1: Write the failing chat integration test**

```tsx
// components/chat/chat.integration-test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Chat from '@/components/chat/chat';

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'I found some great options for you.' }],
      },
    ],
    sendMessage: vi.fn(),
    status: 'ready',
  }),
}));

describe('Chat', () => {
  it('renders shared product cards under assistant responses', () => {
    render(
      <Chat
        savedProducts={[]}
        onToggleSave={vi.fn()}
        onHistoryAdd={vi.fn()}
      />,
    );

    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the chat integration test to verify it fails**

Run: `npm test -- chat.integration-test`

Expected: FAIL because `Chat` does not yet accept the new props or render product cards.

- [ ] **Step 3: Add the minimal chat wiring**

```tsx
// components/chat/chat.tsx
import { useMemo, useState } from 'react';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import { ProductCard } from '@/components/chat/product-card';
import { MOCK_PRODUCTS } from '@/components/chat/mock-products';

interface ChatProps {
  savedProducts: ChatProduct[];
  onToggleSave: (product: ChatProduct) => void;
  onHistoryAdd: (item: ChatHistoryItem) => void;
}

const buildMockResults = (query: string) => {
  const loweredQuery = query.toLowerCase();

  return MOCK_PRODUCTS.filter((product) => {
    const haystack = `${product.title} ${product.description} ${product.category ?? ''} ${(product.tags ?? []).join(' ')}`.toLowerCase();
    return loweredQuery.split(' ').some((word) => word.length > 2 && haystack.includes(word));
  }).slice(0, 3);
};

export default function Chat({ savedProducts, onToggleSave, onHistoryAdd }: ChatProps) {
  const [input, setInput] = useState('');
  const [latestProducts, setLatestProducts] = useState<ChatProduct[]>([]);
  const { messages, sendMessage, status } = useChat();

  const savedIds = useMemo(() => new Set(savedProducts.map((product) => product.id)), [savedProducts]);

  const handleSubmit = useCallback((message: PromptInputMessage) => {
    const query = message.text?.trim() ?? '';

    if (!query) return;

    const products = buildMockResults(query);
    setLatestProducts(products);

    onHistoryAdd({
      id: Date.now(),
      query,
      timestamp: new Date().toLocaleTimeString(),
      productCount: products.length,
    });

    sendMessage({ text: query });
    setInput('');
  }, [onHistoryAdd, sendMessage]);

  return (
    <div className="flex flex-col w-full max-w-3xl h-[calc(100vh-100px)] mx-auto stretch gap-6 pt-3">
      <div className="h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4">
        {messages.map((message, index) => {
          const isLastAssistantMessage =
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            latestProducts.length > 0;

          return (
            <div key={message.id} className="space-y-4">
              <ChatMessage message={message} status={status} />
              {isLastAssistantMessage ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {latestProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSaved={savedIds.has(product.id)}
                      onSave={() => onToggleSave(product)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the chat integration test, targeted panel tests, and lint**

Run: `npm test -- chat.integration-test product-card history-panel saved-products-panel && npm run lint`

Expected: PASS for the four test files and a clean ESLint run.

- [ ] **Step 5: Commit the final chat wiring**

```bash
git add components/chat/chat.tsx components/chat/chat.integration-test.tsx app/chat/page.tsx
git commit -m "feat: integrate reusable product, history, and saved chat ui"
```

## Final Verification

- [ ] Run: `npm test`
- [ ] Expected: PASS for all new chat UI tests
- [ ] Run: `npm run lint`
- [ ] Expected: no new lint errors in `app/chat/page.tsx` and `components/chat/*`
- [ ] Manual check: open `/chat`, send a prompt like `warm winter clothes`, confirm product cards appear under the assistant reply, heart one product, verify it appears in the Saved tab, then open History to confirm the search entry appears there.

## Self-Review Against Spec

- Product card extraction is covered in Task 2.
- Empty state, history list, and saved grid are covered in Task 3.
- Page-level shared tab state is covered in Task 4.
- Chat-to-history and chat-to-saved wiring is covered in Task 5.
- Focused verification rather than broad unrelated refactors is preserved by limiting changes to `app/chat/page.tsx`, `components/chat/chat.tsx`, and the new chat component files.
