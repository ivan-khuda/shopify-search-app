# Onboarding App Home Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the embedded onboarding page from Polaris React to Shopify App Home (Polaris web components + App Bridge session-token auth) and remove the Polaris React dependency entirely.

**Architecture:** Polaris web components and App Bridge are loaded from `cdn.shopify.com/shopifycloud/...` via `<Script>` tags in the embedded layout. The onboarding page renders web components (`<s-page>`, `<s-section>`, etc.) and authenticates its "Start sync" call by calling `await shopify.idToken()` and sending the JWT as `Authorization: Bearer`. The sync route verifies the token with `shopifyClient.session.decodeSessionToken`, extracts the shop from the token's `dest` claim, and loads the offline session from Prisma.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest + Testing Library, `@shopify/shopify-api`, `@shopify/app-bridge-react` (for `<NavMenu>`), `@shopify/polaris-types` and `@shopify/app-bridge-types` (types only), bun.

**Spec:** `docs/superpowers/specs/2026-05-20-onboarding-app-home-design.md`

---

## File Plan

| File | Responsibility | Action |
|------|----------------|--------|
| `types/shopify.d.ts` | Ambient global `shopify` typing | Create |
| `package.json` | Dependencies | Modify (remove `@shopify/polaris`, add type packages) |
| `app/(embedded)/layout.tsx` | Inject Polaris CDN script alongside existing App Bridge script | Modify |
| `app/(embedded)/EmbeddedProviders.tsx` | Cross-frame `<NavMenu>` only (no Polaris AppProvider) | Modify |
| `app/(embedded)/onboarding/page.tsx` | Onboarding UI using Polaris web components; session-token sync call | Rewrite |
| `app/(embedded)/__tests__/onboarding.test.tsx` | Behavior tests for the rewritten page | Rewrite |
| `app/api/shopify/sync/route.ts` | Session-token-verified sync endpoint | Modify |
| `app/api/shopify/sync/__tests__/route.test.ts` | Tests for sync route auth path | Create |

---

## Task 1: Add ambient typing for the `shopify` global

**Files:**
- Create: `types/shopify.d.ts`

- [ ] **Step 1: Create the ambient declaration**

```ts
// types/shopify.d.ts
export {};

declare global {
  interface ShopifyToastOptions {
    isError?: boolean;
    duration?: number;
  }

  interface ShopifyGlobal {
    idToken(): Promise<string>;
    toast: {
      show(message: string, options?: ShopifyToastOptions): void;
    };
  }

  // App Bridge installs `shopify` on `window`/`globalThis` once its script loads.
  // eslint-disable-next-line no-var
  var shopify: ShopifyGlobal;
}
```

- [ ] **Step 2: Verify TypeScript picks it up**

Run: `bunx tsc --noEmit`
Expected: PASS (no new type errors). If `tsconfig.json` does not already include `types/**/*.ts`, also confirm `include` covers the project root (`"include": ["**/*.ts", "**/*.tsx"]` or similar). If not, add `types/shopify.d.ts` to `include`.

- [ ] **Step 3: Commit**

```bash
git add types/shopify.d.ts
git commit -m "types: declare ambient shopify global for App Bridge"
```

---

## Task 2: Swap Polaris React dependency for types-only packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove `@shopify/polaris`**

Run: `bun remove @shopify/polaris`

- [ ] **Step 2: Add types-only Shopify packages as devDependencies**

Run: `bun add -d @shopify/polaris-types@latest @shopify/app-bridge-types@latest`

- [ ] **Step 3: Verify install**

Run: `bun install`
Expected: completes without errors. `package.json` no longer lists `@shopify/polaris`. `package.json` lists `@shopify/polaris-types` and `@shopify/app-bridge-types` under `devDependencies`.

- [ ] **Step 4: Confirm no source files still import `@shopify/polaris`**

Run: `grep -rn "@shopify/polaris" app components lib --include="*.ts" --include="*.tsx" || true`
Expected: only `app/(embedded)/onboarding/page.tsx`, `app/(embedded)/EmbeddedProviders.tsx`, and `app/(embedded)/__tests__/onboarding.test.tsx` (these are still on the old code and will be rewritten in Tasks 4–6). Do NOT try to build yet — it will fail until those three files are rewritten.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: drop @shopify/polaris, add Shopify type packages"
```

---

## Task 3: Load Polaris web components CDN script in the embedded layout

**Files:**
- Modify: `app/(embedded)/layout.tsx`

- [ ] **Step 1: Add a `<Script>` tag for `polaris.js` next to the existing App Bridge script**

Replace the file contents with:

```tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import EmbeddedProviders from './EmbeddedProviders';

export const metadata: Metadata = {
  other: {
    'shopify-api-key': process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? '',
  },
};

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://cdn.shopify.com/shopifycloud/polaris.js"
        strategy="beforeInteractive"
      />
      <EmbeddedProviders>{children}</EmbeddedProviders>
    </>
  );
}
```

Note: Polaris web components do not require a `data-api-key` attribute — that attribute is only on App Bridge, which uses the existing `<meta name="shopify-api-key">` already injected via `metadata.other`.

- [ ] **Step 2: Commit**

```bash
git add app/\(embedded\)/layout.tsx
git commit -m "feat: load polaris.js web components from Shopify CDN"
```

---

## Task 4: Strip Polaris React from `EmbeddedProviders`

**Files:**
- Modify: `app/(embedded)/EmbeddedProviders.tsx`

- [ ] **Step 1: Replace file with a thin `<NavMenu>` wrapper**

```tsx
'use client';

import { NavMenu } from '@shopify/app-bridge-react';
import Link from 'next/link';

export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavMenu>
        <Link href="/chat" rel="home">Search</Link>
        <Link href="/onboarding">Onboarding</Link>
      </NavMenu>
      {children}
    </>
  );
}
```

- [ ] **Step 2: Confirm there are no lingering Polaris React imports**

Run: `grep -rn "from '@shopify/polaris'" app/\(embedded\) || true`
Expected: only `app/(embedded)/onboarding/page.tsx` and `app/(embedded)/__tests__/onboarding.test.tsx` (handled in Tasks 5–6).

- [ ] **Step 3: Commit**

```bash
git add app/\(embedded\)/EmbeddedProviders.tsx
git commit -m "refactor: remove Polaris AppProvider from EmbeddedProviders"
```

---

## Task 5: Rewrite the onboarding test to drive the new web-component UI

We test-first: the failing test pins down the new behavior before we touch the page.

**Files:**
- Rewrite: `app/(embedded)/__tests__/onboarding.test.tsx`

- [ ] **Step 1: Replace the test file**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../onboarding/page';

type ShopifyMock = {
  idToken: ReturnType<typeof vi.fn>;
  toast: { show: ReturnType<typeof vi.fn> };
};

declare global {
  // eslint-disable-next-line no-var
  var shopify: ShopifyMock;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  globalThis.shopify = {
    idToken: vi.fn().mockResolvedValue('test.jwt.token'),
    toast: { show: vi.fn() },
  };
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OnboardingPage', () => {
  it('renders the welcome heading on the s-page', () => {
    const { container } = render(<OnboardingPage />);
    const page = container.querySelector('s-page');
    expect(page).not.toBeNull();
    expect(page?.getAttribute('heading')).toBe('Welcome to SmartDiscovery AI');
  });

  it('renders the "How it works" section', () => {
    render(<OnboardingPage />);
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/sync your product catalog/i)).toBeInTheDocument();
  });

  it('renders the "What\'s synced" section', () => {
    render(<OnboardingPage />);
    expect(screen.getByText("What's synced")).toBeInTheDocument();
    expect(screen.getByText(/product titles/i)).toBeInTheDocument();
  });

  it('POSTs to /api/shopify/sync with a Bearer session token when Start sync is clicked', async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(globalThis.shopify.idToken).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer test.jwt.token' },
      });
    });
  });

  it('shows a success toast on 2xx', async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(globalThis.shopify.toast.show).toHaveBeenCalledWith('Sync started');
    });
  });

  it('shows a session-expired error toast on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
        'Session expired. Reload the app.',
        { isError: true }
      );
    });
  });

  it('shows a generic error toast on other failures', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
        'Sync failed. Try again.',
        { isError: true }
      );
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run app/\(embedded\)/__tests__/onboarding.test.tsx`
Expected: FAIL. The current `onboarding/page.tsx` still uses Polaris React and won't match these assertions (no `s-page` element, no `data-testid="start-sync"`, no toast calls).

- [ ] **Step 3: Commit the failing test**

```bash
git add app/\(embedded\)/__tests__/onboarding.test.tsx
git commit -m "test: pin onboarding behavior for web-components rewrite"
```

---

## Task 6: Rewrite the onboarding page using Polaris web components

**Files:**
- Rewrite: `app/(embedded)/onboarding/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useState } from 'react';

export default function OnboardingPage() {
  const [syncing, setSyncing] = useState(false);

  async function handleStartSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        shopify.toast.show('Sync started');
      } else if (res.status === 401) {
        shopify.toast.show('Session expired. Reload the app.', { isError: true });
      } else {
        shopify.toast.show('Sync failed. Try again.', { isError: true });
      }
    } catch {
      shopify.toast.show('Sync failed. Try again.', { isError: true });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <s-page heading="Welcome to SmartDiscovery AI">
      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>We sync your product catalog automatically</s-list-item>
          <s-list-item>Our AI uses it to answer customer search queries</s-list-item>
          <s-list-item>You'll receive an email when the first sync completes</s-list-item>
        </s-unordered-list>
        <s-button
          data-testid="start-sync"
          variant="primary"
          onClick={handleStartSync}
          {...(syncing ? { loading: '' } : {})}
        >
          Start sync
        </s-button>
      </s-section>

      <s-section heading="What's synced">
        <s-unordered-list>
          <s-list-item>Product titles, descriptions, tags</s-list-item>
          <s-list-item>Variants and pricing</s-list-item>
          <s-list-item>Images</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="What's next">
        <s-unordered-list>
          <s-list-item>After sync: use the Search tab to test queries</s-list-item>
          <s-list-item>Billing will be introduced in a future update</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
```

Note on JSX typing: `s-page`, `s-section`, etc. are not part of React's intrinsic elements. If `bunx tsc --noEmit` complains, add to `types/shopify.d.ts`:

```ts
declare namespace JSX {
  interface IntrinsicElements {
    [elem: `s-${string}`]: Record<string, unknown> & {
      children?: React.ReactNode;
      onClick?: (e: Event) => void;
    };
  }
}
```

(`@shopify/polaris-types` may provide better typings; if so prefer those and skip the catch-all.)

- [ ] **Step 2: Run the test, confirm it passes**

Run: `bunx vitest run app/\(embedded\)/__tests__/onboarding.test.tsx`
Expected: PASS, all six cases.

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS. If `s-*` elements complain, apply the JSX intrinsic-elements declaration above.

- [ ] **Step 4: Commit**

```bash
git add app/\(embedded\)/onboarding/page.tsx types/shopify.d.ts
git commit -m "feat: onboarding page uses Polaris web components and App Bridge"
```

---

## Task 7: Write failing tests for the session-token-verified sync route

**Files:**
- Create: `app/api/shopify/sync/__tests__/route.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shopify/client', () => {
  return {
    shopifyClient: {
      session: {
        decodeSessionToken: vi.fn(),
        getOfflineId: vi.fn((shop: string) => `offline_${shop}`),
      },
      clients: {
        Rest: vi.fn().mockImplementation(() => ({
          get: vi.fn().mockResolvedValue({ body: { product: { id: 1 } } }),
        })),
      },
    },
  };
});

vi.mock('@/lib/shopify/session-storage', () => {
  return {
    sessionStorage: {
      loadSession: vi.fn(),
    },
  };
});

import { POST } from '../route';
import { shopifyClient } from '@/lib/shopify/client';
import { sessionStorage } from '@/lib/shopify/session-storage';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/shopify/sync', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/shopify/sync', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('missing_token');
  });

  it('returns 401 when token cannot be decoded', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad token')
    );

    const res = await POST(makeRequest({ Authorization: 'Bearer broken' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_token');
  });

  it('returns 401 when no offline session exists for the shop', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('no_offline_session');
  });

  it('returns 200 with success when token is valid and session exists', async () => {
    (shopifyClient.session.decodeSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      dest: 'https://example-shop.myshopify.com',
    });
    (sessionStorage.loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'offline_example-shop.myshopify.com',
      shop: 'example-shop.myshopify.com',
      accessToken: 'shpat_xxx',
    });

    const res = await POST(makeRequest({ Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(shopifyClient.session.getOfflineId).toHaveBeenCalledWith('example-shop.myshopify.com');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts`
Expected: FAIL. The current `route.ts` ignores the `Authorization` header, hardcodes the shop, and never returns 401 with the error codes above.

- [ ] **Step 3: Commit**

```bash
git add app/api/shopify/sync/__tests__/route.test.ts
git commit -m "test: pin session-token auth on sync route"
```

---

## Task 8: Rewrite `/api/shopify/sync` to verify session tokens

**Files:**
- Modify: `app/api/shopify/sync/route.ts`

- [ ] **Step 1: Replace the file**

```ts
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

  // Stub sync work: hit one known product so the auth path is exercised end-to-end.
  // Replacing this with real syncProducts() is tracked separately.
  const client = new shopifyClient.clients.Rest({ session });
  await client.get<unknown>({ path: 'products/7539258589318' });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run the route tests, confirm they pass**

Run: `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 3: Commit**

```bash
git add app/api/shopify/sync/route.ts
git commit -m "feat: verify session token on /api/shopify/sync"
```

---

## Task 9: Full check — tests, types, lint, build

- [ ] **Step 1: Full test run**

Run: `bun test`
Expected: PASS for all suites. If a prior test breaks (e.g. references to Polaris React from a forgotten file), fix in this task before proceeding.

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `bun lint`
Expected: PASS, or only pre-existing warnings unrelated to this change.

- [ ] **Step 4: Production build**

Run: `bun build`
Expected: PASS. This verifies the embedded routes still compile without `@shopify/polaris`.

- [ ] **Step 5: If anything failed, fix and commit**

```bash
git add -A
git commit -m "fix: resolve typecheck/lint fallout from Polaris removal"
```

(Skip the commit if everything passed clean.)

---

## Task 10: Manual smoke test

Tests cannot verify what Shopify's admin frame actually renders. Run this manually before declaring done.

- [ ] **Step 1: Start dev server**

Run: `bun dev`

- [ ] **Step 2: Confirm tunnel matches `shopify.app.toml`**

Check `shopify.app.toml` `application_url` matches the active ngrok tunnel. If not, update either ngrok or the toml (and re-deploy app config if needed).

- [ ] **Step 3: Open the app from a development store**

Partner dashboard → SmartDiscovery AI → Test your app → install on dev store. Navigate to the onboarding route inside Shopify admin.

- [ ] **Step 4: Verify rendering**

Confirm:
- The page renders inside the admin iframe.
- Polaris styling appears (sections have card-like surfaces, the button matches Shopify's primary style).
- The cross-frame NavMenu shows "Search" and "Onboarding" links in the admin nav.

- [ ] **Step 5: Verify the sync action**

Click "Start sync". In DevTools Network:
- The request `POST /api/shopify/sync` includes `Authorization: Bearer <jwt>`.
- Response is `200 { success: true }`.
- A toast appears in the admin frame.

In the dev server logs, the decoded shop hostname is printed (or at least no errors are thrown).

- [ ] **Step 6: Verify the 401 path (optional but recommended)**

Temporarily corrupt the `Authorization` header (e.g. via DevTools "Override request" or via a manual `curl` with `-H "Authorization: Bearer bad"`). Expect `401 { error: "invalid_token" }`.

---

## Self-review notes

- All spec sections map to tasks: file changes (Tasks 1–8), data flow (Tasks 3, 6, 8), testing (Tasks 5, 7), risks/manual verification (Task 10). The single ambiguity called out in the spec (`types/shopify.d.ts` source) is resolved inline in Task 1 with a concrete declaration that uses only the surface the app touches.
- No placeholders. Every code step shows the actual code; every test step shows the actual assertions; every command step shows the actual command and expected outcome.
- Type/method consistency: `idToken` / `toast.show` / `decodeSessionToken` / `getOfflineId` / `loadSession` / `dest` are used identically across Task 1 typing, Task 5 mock surface, Task 6 page code, Task 7 test mocks, and Task 8 implementation.
