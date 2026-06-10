# Onboarding Page Redesign (Polaris) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the embedded onboarding page (`app/(embedded)/onboarding/page.tsx`) to match the approved Claude Design handoff layout, using Polaris web components only — no backend changes, no logic changes.

**Architecture:** Render-layer rewrite. The existing state machine (sync start, 2s status polling, `?retry=` deep-link, terminal states) stays byte-identical; only JSX changes. Two new presentational components (`StepRail`, `InfoCards`) are extracted into their own files; the page composes them. Per the UI strategy spec (`docs/superpowers/specs/2026-06-10-polaris-ui-strategy-design.md`), admin pages use Polaris components and tokens — the design's indigo accent, shimmer animation, and custom inline styles are intentionally dropped.

**Tech Stack:** Next.js 16 App Router, React 19, Polaris web components (`s-*` custom elements from CDN `polaris.js`), Vitest + jsdom + Testing Library. Package manager: bun. Test command: `bun run test` (NEVER bare `bun test`).

**Design reference:** `/tmp/sd-design/smart-discovery-ai-high-fidelity/project/src/screens/onboarding.jsx` (Claude Design handoff bundle). Approved simplifications: no stage chips (Fetch/Save/Embed/Index), no ETA/rate, no index-size/duration stat tiles. "Try the playground" CTA → "Open admin chat" (`/chat`); "Configure model" → `/settings`.

**Key constraints:**
- All existing `data-testid`s must survive: `start-sync`, `progress-bar`, `state-badge`, `retry-sync`, `retry-deep-link`, `open-chat`.
- Polaris web components are custom elements; jsdom renders them as unknown elements (children visible, no shadow DOM behavior). Tests assert via `container.querySelector('s-…')` and testids — this is the established pattern in `app/(embedded)/__tests__/onboarding.test.tsx`.
- `partial` / `failed` / `?retry=` deep-link banner flows are NOT in the design prototype but MUST be preserved exactly (existing banner copy is pinned by tests).

---

### Task 1: JSX type declarations for new Polaris tags

The page will use `s-grid`, `s-grid-item`, `s-box`, `s-stack`, `s-paragraph`, `s-spinner` — none are declared in React's JSX intrinsics yet. Type-only change, no test.

**Files:**
- Modify: `types/shopify-global.d.ts` (the `IntrinsicElements` block, currently ends at `'s-text-field': PolarisIntrinsicProps;`)

- [ ] **Step 1: Add the new tag declarations**

In `types/shopify-global.d.ts`, after the line `'s-text-field': PolarisIntrinsicProps;`, add:

```ts
        // Onboarding redesign (2026-06-10): layout primitives for step rail,
        // sync card, stat tiles, and info cards.
        's-box': PolarisIntrinsicProps;
        's-grid': PolarisIntrinsicProps;
        's-grid-item': PolarisIntrinsicProps;
        's-stack': PolarisIntrinsicProps;
        's-paragraph': PolarisIntrinsicProps;
        's-spinner': PolarisIntrinsicProps;
```

- [ ] **Step 2: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: exit 0, no errors (same as before the change — run it first if unsure of baseline).

- [ ] **Step 3: Commit**

```bash
git add types/shopify-global.d.ts
git commit -m "chore: declare s-box/s-grid/s-stack/s-paragraph/s-spinner JSX intrinsics"
```

---

### Task 2: StepRail component

Three-step progress rail: Connect (always done) → Sync products → Enable drawer. Pure presentational, single `stage` prop.

**Files:**
- Create: `app/(embedded)/onboarding/step-rail.tsx`
- Test: `app/(embedded)/__tests__/step-rail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/(embedded)/__tests__/step-rail.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StepRail } from '../onboarding/step-rail';

describe('StepRail', () => {
  it('renders three steps with labels and sublabels', () => {
    const { container, getByText } = render(<StepRail stage={0} />);
    expect(container.querySelectorAll('[data-testid^="step-"]')).toHaveLength(3);
    expect(getByText('Connect')).toBeInTheDocument();
    expect(getByText('Done — shop authorized')).toBeInTheDocument();
    expect(getByText('Sync products')).toBeInTheDocument();
    expect(getByText('Pull & embed your catalog')).toBeInTheDocument();
    expect(getByText('Enable drawer')).toBeInTheDocument();
    expect(getByText('Turn on App Embed in theme')).toBeInTheDocument();
  });

  it('stage 0 (idle): Connect done, nothing active', () => {
    const { getByTestId } = render(<StepRail stage={0} />);
    expect(getByTestId('step-1').getAttribute('data-done')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('false');
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('false');
  });

  it('stage 1 (syncing): Sync products active', () => {
    const { getByTestId } = render(<StepRail stage={1} />);
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('false');
  });

  it('stage 2 (synced): Sync products done, Enable drawer active', () => {
    const { getByTestId } = render(<StepRail stage={2} />);
    expect(getByTestId('step-2').getAttribute('data-done')).toBe('true');
    expect(getByTestId('step-2').getAttribute('data-active')).toBe('false');
    expect(getByTestId('step-3').getAttribute('data-active')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run "app/(embedded)/__tests__/step-rail.test.tsx"`
Expected: FAIL — `Cannot find module '../onboarding/step-rail'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `app/(embedded)/onboarding/step-rail.tsx`:

```tsx
// Three-step onboarding rail per the 2026-06-10 design handoff:
// Connect (done at install) → Sync products → Enable drawer.
// Pure presentational; jsdom can't run Polaris custom elements, so state is
// also exposed via data-done/data-active for tests.

export type SyncStage = 0 | 1 | 2;

interface Step {
  label: string;
  sub: string;
  done: boolean;
  active: boolean;
}

export function StepRail({ stage }: { stage: SyncStage }) {
  const steps: Step[] = [
    { label: 'Connect', sub: 'Done — shop authorized', done: true, active: false },
    {
      label: 'Sync products',
      sub: 'Pull & embed your catalog',
      done: stage >= 2,
      active: stage === 1,
    },
    {
      label: 'Enable drawer',
      sub: 'Turn on App Embed in theme',
      done: false,
      active: stage === 2,
    },
  ];

  return (
    <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base" data-testid="step-rail">
      {steps.map((step, i) => (
        <s-box
          key={step.label}
          padding="base"
          borderWidth="small"
          borderStyle="solid"
          borderColor={step.active ? 'strong' : 'base'}
          borderRadius="base"
          data-testid={`step-${i + 1}`}
          data-done={step.done ? 'true' : 'false'}
          data-active={step.active ? 'true' : 'false'}
        >
          <s-stack direction="inline" gap="small" alignItems="center">
            {step.done ? (
              <s-badge tone="success">✓</s-badge>
            ) : step.active ? (
              <s-badge tone="info">{String(i + 1)}</s-badge>
            ) : (
              <s-badge>{String(i + 1)}</s-badge>
            )}
            <s-text>{step.label}</s-text>
          </s-stack>
          <s-text tone="subdued">{step.sub}</s-text>
        </s-box>
      ))}
    </s-grid>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run "app/(embedded)/__tests__/step-rail.test.tsx"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/(embedded)/onboarding/step-rail.tsx" "app/(embedded)/__tests__/step-rail.test.tsx"
git commit -m "feat: add StepRail component for onboarding redesign"
```

---

### Task 3: InfoCards component

Two-up info cards ("What gets synced" / "What happens next"). Static content from the design, adjusted to our stack wording.

**Files:**
- Create: `app/(embedded)/onboarding/info-cards.tsx`
- Test: `app/(embedded)/__tests__/info-cards.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/(embedded)/__tests__/info-cards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InfoCards } from '../onboarding/info-cards';

describe('InfoCards', () => {
  it('renders the "What gets synced" card with its items', () => {
    const { getByTestId, getByText } = render(<InfoCards />);
    expect(getByTestId('info-synced')).toBeInTheDocument();
    expect(getByText('What gets synced')).toBeInTheDocument();
    expect(getByText('Title, description, tags, vendor, product type')).toBeInTheDocument();
    expect(getByText('Variants, options, prices')).toBeInTheDocument();
    expect(getByText('Featured images')).toBeInTheDocument();
    expect(getByText('Updates from Shopify in real time via webhooks')).toBeInTheDocument();
  });

  it('renders the "What happens next" card with its items', () => {
    const { getByTestId, getByText } = render(<InfoCards />);
    expect(getByTestId('info-next')).toBeInTheDocument();
    expect(getByText('What happens next')).toBeInTheDocument();
    expect(getByText(/embed each product/i)).toBeInTheDocument();
    expect(getByText(/semantic \+ full-text search indexes/i)).toBeInTheDocument();
    expect(getByText(/email when the first sync completes/i)).toBeInTheDocument();
    expect(getByText(/App Embed block in your theme/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run "app/(embedded)/__tests__/info-cards.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `app/(embedded)/onboarding/info-cards.tsx`:

```tsx
// Two-up info cards per the 2026-06-10 design handoff. Static merchant-facing
// copy; embedding-model details intentionally generic (model is an internal
// pinned constant, not a merchant concern).

const SYNCED_ITEMS = [
  'Title, description, tags, vendor, product type',
  'Variants, options, prices',
  'Featured images',
  'Updates from Shopify in real time via webhooks',
];

const NEXT_ITEMS = [
  'We embed each product for AI-powered search',
  'We build semantic + full-text search indexes',
  "You'll get an email when the first sync completes",
  'Enable the App Embed block in your theme',
];

function InfoCard({
  title,
  items,
  testId,
}: {
  title: string;
  items: string[];
  testId: string;
}) {
  return (
    <s-box
      padding="base"
      borderWidth="small"
      borderStyle="solid"
      borderColor="base"
      borderRadius="base"
      data-testid={testId}
    >
      <s-heading>{title}</s-heading>
      <s-unordered-list>
        {items.map((item) => (
          <s-list-item key={item}>{item}</s-list-item>
        ))}
      </s-unordered-list>
    </s-box>
  );
}

export function InfoCards() {
  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <InfoCard title="What gets synced" items={SYNCED_ITEMS} testId="info-synced" />
      <InfoCard title="What happens next" items={NEXT_ITEMS} testId="info-next" />
    </s-grid>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run "app/(embedded)/__tests__/info-cards.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/(embedded)/onboarding/info-cards.tsx" "app/(embedded)/__tests__/info-cards.test.tsx"
git commit -m "feat: add InfoCards component for onboarding redesign"
```

---

### Task 4: Rewrite the page render layer + update page tests

The page keeps ALL state/effect/handler code unchanged; only the returned JSX of `OnboardingContent` changes. Tests are updated first (TDD on the new contract), then the page.

**Files:**
- Modify: `app/(embedded)/__tests__/onboarding.test.tsx`
- Modify: `app/(embedded)/onboarding/page.tsx` (only the JSX return block, lines ~134-228, plus two imports and a `stage` derivation)

- [ ] **Step 1: Update page tests to the new contract**

In `app/(embedded)/__tests__/onboarding.test.tsx`, make these exact edits:

**(a)** Replace the test `renders the "How it works" section` with:

```tsx
  it('renders the idle sync card with Start sync and background hint', () => {
    const { container } = render(<OnboardingPage />);
    expect(
      container.querySelector('s-section[heading="Sync your product catalog"]')
    ).not.toBeNull();
    expect(screen.getByTestId('start-sync')).toBeInTheDocument();
    expect(
      screen.getByText(/keep using your store while sync runs in the background/i)
    ).toBeInTheDocument();
  });

  it('renders the intro paragraph and the step rail in idle state', () => {
    render(<OnboardingPage />);
    expect(
      screen.getByText(/storefront can answer natural-language questions/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('step-rail')).toBeInTheDocument();
    expect(screen.getByTestId('step-2').getAttribute('data-active')).toBe('false');
  });
```

**(b)** Replace the test `renders the "What's synced" section` with:

```tsx
  it('renders the two-up info cards', () => {
    render(<OnboardingPage />);
    expect(screen.getByTestId('info-synced')).toBeInTheDocument();
    expect(screen.getByTestId('info-next')).toBeInTheDocument();
    expect(screen.getByText(/variants, options, prices/i)).toBeInTheDocument();
  });
```

**(c)** In the running-state test (`renders <s-progress-bar> + counter + state badge when state === running`), change the counter assertion line:

```tsx
      expect(screen.getByText(/50 \/ 250 products/)).toBeInTheDocument();
```

to:

```tsx
      expect(screen.getByText(/50 of 250 products/)).toBeInTheDocument();
```

**(d)** Replace the succeeded-state test (`renders <s-banner tone="success"> + "Open admin chat" CTA when state === succeeded (D-14)`) body's `waitFor` block with the new done-state contract (test name becomes `renders done-state stat tiles + CTAs when state === succeeded (D-14)`):

```tsx
  it('renders done-state stat tiles + CTAs when state === succeeded (D-14)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_done' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'succeeded',
          processedCount: 3247,
          totalCount: 3247,
          errors: [],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
      });

    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(
        container.querySelector('s-section[heading="Catalog synced and indexed"]')
      ).not.toBeNull();
      expect(screen.getByTestId('stat-products').textContent).toMatch(/3247/);
      expect(screen.getByTestId('stat-embeddings').textContent).toMatch(/3247/);
      const openChat = screen.getByTestId('open-chat');
      expect(openChat.getAttribute('href')).toBe('/chat');
      const configure = screen.getByTestId('configure-model');
      expect(configure.getAttribute('href')).toBe('/settings');
      // Step rail: Enable drawer becomes the active step after success
      expect(screen.getByTestId('step-3').getAttribute('data-active')).toBe('true');
    }, { timeout: 5000 });
  });
```

**(e)** All other tests (partial, failed, toasts, Bearer POST, all four `?retry=` deep-link tests) stay untouched — their banner copy and testids are preserved by the new page.

- [ ] **Step 2: Run page tests to verify the new ones fail**

Run: `bunx vitest run "app/(embedded)/__tests__/onboarding.test.tsx"`
Expected: FAIL — new assertions (step-rail, info cards, new section headings, stat tiles) can't find elements; untouched tests still pass.

- [ ] **Step 3: Rewrite the page JSX**

In `app/(embedded)/onboarding/page.tsx`:

**(a)** Add imports after the existing ones (line 4):

```tsx
import { StepRail, type SyncStage } from './step-rail';
import { InfoCards } from './info-cards';
```

**(b)** Inside `OnboardingContent`, immediately after the `progressValue` derivation (line ~130), add:

```tsx
  const stage: SyncStage =
    syncState === 'succeeded' ? 2 : syncRunId !== null ? 1 : 0;

  const isRunning =
    syncRunId !== null && (syncState === null || syncState === 'queued' || syncState === 'running');

  const syncHeading =
    syncState === 'succeeded'
      ? 'Catalog synced and indexed'
      : syncState === 'partial'
        ? 'Sync finished with errors'
        : syncState === 'failed'
          ? 'Sync failed'
          : isRunning
            ? 'Syncing your catalog'
            : 'Sync your product catalog';
```

Note: `partial`/`failed` keep `stage === 1` (sync step still the active concern) — matches the rail's "not done" semantics.

**(c)** Replace the entire `return (...)` block of `OnboardingContent` (the current `<s-page>…</s-page>`) with:

```tsx
  return (
    <s-page heading="Welcome to SmartDiscovery AI">
      <s-paragraph>
        Three steps and your storefront can answer natural-language questions
        about your catalog. We&apos;ll sync your products, generate embeddings,
        and turn on the chat drawer.
      </s-paragraph>

      <StepRail stage={stage} />

      <s-section heading={syncHeading}>
        {syncRunId === null && (
          <s-paragraph>
            We&apos;ll pull every active product, generate embeddings, and create
            the search index. Takes a few minutes for most shops.
          </s-paragraph>
        )}
        {isRunning && (
          <s-paragraph>
            You can close this tab — we&apos;ll email you the moment it finishes.
          </s-paragraph>
        )}

        {retryRun?.state === 'failed' && syncRunId === null ? (
          <s-banner tone="critical">
            Your previous sync failed — Retry?
            {retryRun.errors[0] ? <s-text>{retryRun.errors[0]}</s-text> : null}
            <s-button data-testid="retry-deep-link" variant="primary" onClick={handleStartSync}>
              Retry sync
            </s-button>
          </s-banner>
        ) : null}

        {syncRunId === null ? (
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              data-testid="start-sync"
              variant="primary"
              onClick={handleStartSync}
              {...(syncing ? { loading: '' } : {})}
            >
              Start sync
            </s-button>
            <s-text tone="subdued">
              You can keep using your store while sync runs in the background.
            </s-text>
          </s-stack>
        ) : (
          <>
            {isRunning && (
              <>
                <s-progress-bar
                  data-testid="progress-bar"
                  value={String(progressValue)}
                />
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-text>
                    {totalCount
                      ? `${processedCount} of ${totalCount} products (${progressValue}%)`
                      : `${processedCount} products synced so far`}
                  </s-text>
                  <s-badge data-testid="state-badge">{stateLabel(syncState)}</s-badge>
                </s-stack>
              </>
            )}

            {syncState === 'succeeded' && (
              <>
                <s-paragraph>
                  {totalCount ?? processedCount} products are now searchable. Try
                  the admin chat to see real results.
                </s-paragraph>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-box
                    padding="base"
                    borderWidth="small"
                    borderStyle="solid"
                    borderColor="base"
                    borderRadius="base"
                    background="subdued"
                    data-testid="stat-products"
                  >
                    <s-text tone="subdued">Products</s-text>
                    <s-heading>{String(totalCount ?? processedCount)}</s-heading>
                  </s-box>
                  <s-box
                    padding="base"
                    borderWidth="small"
                    borderStyle="solid"
                    borderColor="base"
                    borderRadius="base"
                    background="subdued"
                    data-testid="stat-embeddings"
                  >
                    <s-text tone="subdued">Embeddings</s-text>
                    <s-heading>{String(totalCount ?? processedCount)}</s-heading>
                  </s-box>
                </s-grid>
                <s-stack direction="inline" gap="base">
                  <s-button data-testid="open-chat" variant="primary" href="/chat">
                    Open admin chat
                  </s-button>
                  <s-button data-testid="configure-model" href="/settings">
                    Configure model
                  </s-button>
                </s-stack>
              </>
            )}

            {syncState === 'partial' && (
              <>
                <s-banner tone="warning">
                  {processedCount} products synced, {errors.length} failed
                </s-banner>
                <s-button data-testid="retry-sync" onClick={handleStartSync}>
                  Retry sync
                </s-button>
              </>
            )}

            {syncState === 'failed' && (
              <>
                <s-banner tone="critical">Sync failed</s-banner>
                <s-button data-testid="retry-sync" onClick={handleStartSync}>
                  Retry sync
                </s-button>
              </>
            )}
          </>
        )}
      </s-section>

      <InfoCards />
    </s-page>
  );
```

Everything above the return statement (state, handlers, effects, `stateLabel`, `TERMINAL_STATES`, the `Suspense` wrapper) stays exactly as it is.

**(d)** Note the partial/failed heading check: the succeeded test asserts `s-section[heading="Catalog synced and indexed"]`; partial/failed tests only assert banners, which still render — no further test edits needed.

- [ ] **Step 4: Run the full page test file**

Run: `bunx vitest run "app/(embedded)/__tests__/onboarding.test.tsx"`
Expected: PASS — all tests including the four untouched `?retry=` tests and partial/failed banners.

- [ ] **Step 5: Run the whole suite + lint + types**

Run: `bun run test`
Expected: PASS (no other suite references onboarding copy).

Run: `bun lint`
Expected: 0 errors.

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "app/(embedded)/onboarding/page.tsx" "app/(embedded)/__tests__/onboarding.test.tsx"
git commit -m "feat: rebuild onboarding page per design handoff with Polaris components"
```

---

### Task 5: Final verification

- [ ] **Step 1: Production build**

Run: `bun run build`
Expected: build succeeds; `/onboarding` route compiles (Suspense boundary already in place for `useSearchParams`).

- [ ] **Step 2: Verify no logic drift**

Run: `git diff HEAD~2 -- "app/(embedded)/onboarding/page.tsx" | grep -E "^[-+].*(useEffect|fetch|idToken|setInterval|setSyncState|handleStartSync)" | head -30`
Expected: only context-line noise or nothing — no behavioral lines added/removed (handlers/effects untouched).

- [ ] **Step 3: Commit any build fixes (only if Step 1 failed and required changes)**

```bash
git add -A && git commit -m "fix: build fixes for onboarding redesign"
```
