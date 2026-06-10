# Testing Patterns

**Analysis Date:** 2026-05-22

## Test Framework

**Runner:**
- Vitest v4.1.5
- Config: `vitest.config.ts` at project root
- Environment: jsdom (for DOM testing in Node.js)

**Assertion Library:**
- Vitest's built-in `expect()` function (compatible with Jest syntax)
- `@testing-library/react` for component testing
- `@testing-library/jest-dom/vitest` for DOM matchers (auto-imported in `vitest.setup.ts`)

**Run Commands:**
```bash
bun test                                                    # Run all tests
bunx vitest run [path]                                      # Run specific test file
bunx vitest run components/chat/__tests__/product-card.test.tsx  # Example
```

## Test File Organization

**Location:**
- Co-located with source: Tests live in `__tests__/` subdirectory adjacent to source code
- Routes co-located: API route tests in same directory as routes (e.g., `app/api/auth/__tests__/route.test.ts`)

**Naming:**
- Convention: `[FileName].test.tsx` for React component tests
- Convention: `[FileName].test.ts` for utility/service tests
- Pattern includes word `test` (never `spec`)

**Structure:**
```
app/api/auth/
├── route.ts
├── callback/
│   └── route.ts
└── __tests__/
    └── route.test.ts

components/chat/
├── chat.tsx
├── product-card.tsx
└── __tests__/
    ├── product-card.test.tsx
    ├── history-panel.test.tsx
    └── saved-products-panel.test.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should [expected behavior]', () => {
    // Arrange
    const mockData = { ... };
    
    // Act
    render(<Component {...props} />);
    
    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

**Patterns Observed:**

1. **Nested describe blocks by feature:**
   ```typescript
   describe('GET /api/auth', () => { ... });
   describe('GET /api/auth/callback', () => { ... });
   describe('GET /api/auth/online', () => { ... });
   ```
   (From `app/api/auth/__tests__/route.test.ts`)

2. **AAA Pattern (Arrange-Act-Assert):**
   - Setup test data and mocks
   - Execute the function/component
   - Assert expected outcome
   - Example from `components/chat/__tests__/product-card.test.tsx`:
     ```typescript
     const onSave = vi.fn();
     const product: ChatProduct = { id: '1', title: '...', ... };
     render(<ProductCard product={product} isSaved={false} onSave={onSave} />);
     fireEvent.click(screen.getByRole('button', { name: /save product/i }));
     expect(onSave).toHaveBeenCalledTimes(1);
     ```

3. **Clear test descriptions:**
   - Use natural language: `it('shows the empty state when there is no history')`
   - Use `it()` (never `test()`)

## Mocking

**Framework:** Vitest's `vi` object

**Patterns:**

### Module Mocking
```typescript
vi.mock('@/lib/shopify/client', () => ({
  shopifyClient: {
    auth: {
      begin: vi.fn(),
      callback: vi.fn(),
    },
  },
}));
```
(From `app/api/auth/__tests__/route.test.ts`)

### Function Mocking
```typescript
const onSave = vi.fn();
const onToggleSave = vi.fn();
render(<Component onSave={onSave} onToggleSave={onToggleSave} />);
expect(onSave).toHaveBeenCalledTimes(1);
```
(From `components/chat/__tests__/product-card.test.tsx`)

### Global Stubs
```typescript
beforeEach(() => {
  shopifyMock = {
    idToken: vi.fn().mockResolvedValue('test.jwt.token'),
    toast: { show: vi.fn(), hide: vi.fn() },
  };
  vi.stubGlobal('shopify', shopifyMock);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```
(From `app/(embedded)/__tests__/onboarding.test.tsx`)

### Mock Implementation Chains
```typescript
vi.mocked(shopifyClient.auth.begin).mockResolvedValue(mockRedirect as never);
vi.mocked(shopifyClient.auth.callback).mockResolvedValue({
  session: mockSession,
  headers: undefined,
} as never);
```
(From `app/api/auth/__tests__/route.test.ts`)

**What to Mock:**
- External API clients (Shopify, database)
- Browser APIs (fetch, window.matchMedia)
- Global functions accessed via `global` or `window`
- Modules with external dependencies (shopify-api, prisma)

**What NOT to Mock:**
- Testing Library utilities (render, screen, fireEvent)
- Component logic (test the actual component behavior)
- Simple utility functions (unless they have side effects)
- React hooks when testing components that use them

## Fixtures and Factories

**Test Data:**
```typescript
const product: ChatProduct = {
  id: '1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
};
```
(From `components/chat/__tests__/saved-products-panel.test.tsx`)

Inline test data is preferred; dedicated factory files not observed.

**Location:**
- Defined locally in test files (no shared fixture directory)
- Reused within the same test file via `const`

**Type Safety:**
- Test data is typed: `const product: ChatProduct = { ... }`
- Ensures test data matches real component props

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
Not yet configured; Vitest supports coverage via plugin but not set up in this project.

## Test Types

**Unit Tests:**
- Scope: Individual components and functions
- Approach: Test in isolation with mocked dependencies
- Example: `components/chat/__tests__/product-card.test.tsx` tests `ProductCard` component's render and click behavior
- Tools: `@testing-library/react`, `fireEvent`, `screen` queries

**Integration Tests:**
- Scope: API routes and workflows
- Approach: Mock external services but test full route logic including parameter validation and response handling
- Example: `app/api/auth/__tests__/route.test.ts` tests the full OAuth flow with mocked shopify-api
- Identified by testing route handlers: `import { GET } from '../route'`

**E2E Tests:**
- Framework: Not used
- Observation: No Cypress, Playwright, or similar configured

## Common Patterns

**Async Testing:**
```typescript
it('POSTs to /api/shopify/sync with a Bearer session token', async () => {
  render(<OnboardingPage />);
  fireEvent.click(screen.getByTestId('start-sync'));
  
  await waitFor(() => {
    expect(shopifyMock.idToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer test.jwt.token' },
    });
  });
});
```
(From `app/(embedded)/__tests__/onboarding.test.tsx`)

- Use `async/await` on test function
- Use `await waitFor()` for assertions on async side effects
- Mock async functions with `.mockResolvedValue()` or `.mockRejectedValue()`

**Error Testing:**
```typescript
it('returns 401 when token cannot be decoded', async () => {
  (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error('bad token')
  );
  
  const res = await POST(makeRequest({ Authorization: 'Bearer broken' }));
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.error).toBe('invalid_token');
});
```
(From `app/api/shopify/sync/__tests__/route.test.ts`)

- Mock rejection to simulate errors
- Assert both HTTP status and error response body

**DOM Queries:**
```typescript
expect(screen.getByText(product.title)).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: /save product/i }));
expect(screen.getByText(/3 results/i)).toBeInTheDocument();
```

- Use semantic queries: `getByRole()`, `getByText()`, `getByTestId()` (in order of preference)
- Use regex for partial text matching: `/save product/i`
- Use `fireEvent` for user interactions

## Setup Files

**Location:** `vitest.setup.ts`

**Configuration:**
```typescript
import '@testing-library/jest-dom/vitest';

// Polaris requires window.matchMedia which jsdom doesn't implement
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

- Auto-imports Testing Library matchers for jsdom
- Polyfills `window.matchMedia` for Shopify Polaris component testing
- Run before every test file

## Globals Configuration

**From `vitest.config.ts`:**
```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./vitest.setup.ts'],
  include: [
    '**/*.{test,spec}.?(c|m)[jt]s?(x)',
    '**/*.integration-test.?(c|m)[jt]s?(x)',
  ],
}
```

- `globals: true` means `describe()`, `it()`, `expect()`, `vi` available without imports
- `setupFiles` runs setup before all tests
- Test file patterns include `.integration-test.` suffix (though not actively used)

---

*Testing analysis: 2026-05-22*
