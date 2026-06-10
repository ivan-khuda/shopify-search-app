# SmartDiscovery AI Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the create-next-app boilerplate at `app/page.tsx` with the SmartDiscovery AI marketing landing page from the Claude Design handoff, pixel-faithful, Conversation hero direction, indigo accent.

**Architecture:** The design handoff (HTML/CSS/JS prototype) lives in `docs/design/landing/` — it is the visual spec. We port it to typed React components under `components/landing/`, keeping the prototype's inline-style approach for pixel fidelity (this is a self-contained marketing page, not part of the admin design system). Global CSS variables, keyframes, and responsive rules go in `components/landing/landing.css`, scoped under a `.sd-landing` wrapper class so nothing leaks into the embedded admin app. Fonts (Inter + DM Serif Display) load via `next/font/google` in `app/page.tsx` only. Demo catalog images come from Unsplash → `next.config.ts` gets `images.remotePatterns`, but components use plain `<img>` (matches prototype, avoids next/image layout differences; lint rule `@next/next/no-img-element` is disabled per-file).

**Decisions locked by user:** Hero = **Conversation** (the design default; the other two directions are NOT implemented). Accent = fixed Indigo `#5B4FE9` (the Tweaks panel is a design-time tool — do not port it). Keep ALL designed content including fictional pricing tiers, testimonials, and trusted-brands strip.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Vitest + @testing-library/react (jsdom), bun. NO Tailwind for these components (inline styles per prototype), except nothing prevents the page shell from coexisting with the existing `globals.css`.

---

## Design Source Map (read these before porting)

All in `docs/design/landing/` (committed reference copies of the handoff):

| Source file | What it specifies | Port target |
|---|---|---|
| `landing-page.html` | CSS variables, keyframes (`sd-spin`, `sd-blink`, `sd-bounce`, `sd-pop`, `sd-float`), `.reveal` transition pattern, `.tnum`/`.serif` utility classes, reduced-motion rules, fonts | `components/landing/landing.css` |
| `landing-app.jsx` | Page assembly order, responsive CSS (`@media 920px/560px` rules), accent CSS-var wiring, reveal safety-net timeout | `app/page.tsx` + `landing.css` |
| `brand.jsx` | `SDLogo` (compass+spark SVG), `shade()`, `rgba()` helpers | `components/landing/brand.tsx`, `components/landing/tokens.ts` |
| `data.js` | `CATALOG` demo products (Field & Form), Unsplash image URLs | `components/landing/catalog.ts` |
| `chat-demo.jsx` | Auto-playing chat demo: `DEMO_SCRIPT`, `useTypewriter`, `MiniProduct`, `ChatDemo` phases (idle→typing→searching→products→streaming→done), reduced-motion handling | `components/landing/use-typewriter.ts`, `components/landing/chat-demo.tsx` |
| `heroes.jsx` | `HeroConversation` ONLY (skip Editorial/Bold), plus shared `CTAButton`, `TrustLine`, `Eyebrow`, `ShopifyMark` | `components/landing/hero.tsx`, `ShopifyMark` into `brand.tsx` |
| `sections.jsx` | `useReveal`, `SectionLabel`, `Nav`, `LogoStrip`, `HowItWorks`, `ProductCard`, `Showcase`, `Features`, `Testimonials`, `Pricing`, `FAQItem`/`FAQ`, `FinalCTA`, `Footer` | `components/landing/nav.tsx` + one file per section (see File Structure) |

**Porting rules (apply to every component):**
1. Source is loose JSX with `window` globals — port to typed TSX with explicit imports/exports. Named exports per project convention.
2. Keep inline `style={{...}}` objects byte-for-byte where possible (same px values, colors, shadows, radii, clamp() expressions). Type them as `React.CSSProperties` where extraction is needed.
3. Components using hooks/state/effects/event handlers get `'use client'` (everything below except `tokens.ts`/`catalog.ts`).
4. `accent` prop → import `ACCENT` constant from `tokens.ts`; keep the `accent` prop with `ACCENT` as default so components stay testable.
5. `React.useState` → `useState` etc. (import from 'react').
6. `window.matchMedia` access must be SSR-safe: only inside `useEffect` or guarded (`typeof window !== 'undefined'`). `ChatDemo` and the hero render on the client but the page is server-rendered first — no `window` at module scope or render time.
7. Buttons that exist purely as visual CTAs in the prototype ("Add to Shopify — free", "Watch the demo", "Sign in", pricing CTAs, footer links to `#`): render as `<a href="/api/auth">` for install CTAs ("Add to Shopify") and keep `href="#"`/`<button>` for the rest. Do not invent new destinations.
8. Images: plain `<img>` with `loading="lazy"` and meaningful `alt` (product title). Add `/* eslint-disable @next/next/no-img-element */` at top of files using `<img>`.
9. Drop: `TweaksPanel`, `TweakRadio`, `TweakColor`, `TweakSection`, `useTweaks`, hero switching, `HeroEditorial`, `HeroBold`, `FloatCard`, `EditorialSearch`. Drop the `setHero` prop from `Nav`.

---

## File Structure

- Create: `components/landing/landing.css` — vars, keyframes, utilities, reveal, responsive rules (Task 1)
- Create: `components/landing/tokens.ts` — `ACCENT`, `ACCENTS` (unused extras dropped), `shade()`, `rgba()` (Task 1)
- Create: `components/landing/catalog.ts` — `LandingProduct` type + `CATALOG` (Task 1)
- Create: `components/landing/brand.tsx` — `SDLogo`, `ShopifyMark` (Task 1)
- Modify: `next.config.ts` — add `images.remotePatterns` for `images.unsplash.com` (Task 1)
- Create: `components/landing/use-typewriter.ts` (Task 2)
- Create: `components/landing/chat-demo.tsx` — `ChatDemo`, `MiniProduct`, `DEMO_SCRIPT` (Task 2)
- Create: `components/landing/use-reveal.ts` (Task 3)
- Create: `components/landing/hero.tsx` — `HeroConversation`, `CTAButton`, `TrustLine`, `Eyebrow` (Task 3)
- Create: `components/landing/nav.tsx` — `Nav` (sticky, scroll-solid) (Task 3)
- Create: `components/landing/sections.tsx` — `SectionLabel`, `LogoStrip`, `HowItWorks`, `ProductCard`, `Showcase`, `Features` (Task 4)
- Create: `components/landing/sections-lower.tsx` — `Testimonials`, `Pricing`, `FAQ`, `FAQItem`, `FinalCTA`, `Footer` (Task 4)
- Rewrite: `app/page.tsx` — fonts, assembly, `.sd-landing` wrapper, metadata (Task 5)
- Tests: `components/landing/__tests__/` — one test file per task (Tasks 1–5)

Two section files mirror the prototype's single `sections.jsx` split at the fold; each component stays self-contained within them. Don't split further — the units are already small.

---

### Task 1: Foundation — CSS, tokens, catalog, brand, image config

**Files:**
- Create: `components/landing/landing.css`
- Create: `components/landing/tokens.ts`
- Create: `components/landing/catalog.ts`
- Create: `components/landing/brand.tsx`
- Modify: `next.config.ts`
- Test: `components/landing/__tests__/foundation.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/landing/__tests__/foundation.test.tsx
import { render, screen } from '@testing-library/react';
import { shade, rgba, ACCENT } from '../tokens';
import { CATALOG } from '../catalog';
import { SDLogo, ShopifyMark } from '../brand';

describe('tokens', () => {
  it('exports indigo accent', () => expect(ACCENT).toBe('#5B4FE9'));
  it('shade darkens toward black for negative percent', () => {
    expect(shade('#ffffff', -50)).toBe('#808080');
  });
  it('shade lightens toward white for positive percent', () => {
    expect(shade('#000000', 50)).toBe('#808080');
  });
  it('rgba converts hex with alpha', () => {
    expect(rgba('#5B4FE9', 0.5)).toBe('rgba(91,79,233,0.5)');
  });
});

describe('catalog', () => {
  it('contains all products referenced by the landing page', () => {
    const needed = ['p1', 'p3', 'p8', 'p9', 'p10', 'p11', 'p13', 'p14'];
    for (const id of needed) {
      expect(CATALOG.find((p) => p.id === id), id).toBeTruthy();
    }
  });
  it('every product has image, price, type, description', () => {
    for (const p of CATALOG) {
      expect(p.image).toMatch(/^https:\/\/images\.unsplash\.com\//);
      expect(p.price).toBeGreaterThan(0);
      expect(p.type).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });
});

describe('brand', () => {
  it('SDLogo renders an svg tile', () => {
    const { container } = render(<SDLogo size={28} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
  it('ShopifyMark renders', () => {
    const { container } = render(<ShopifyMark />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail (modules don't exist)**

Run: `bunx vitest run components/landing/__tests__/foundation.test.tsx`
Expected: FAIL — cannot resolve `../tokens` etc.

- [ ] **Step 3: Implement**

`components/landing/tokens.ts` — port `shade`/`rgba` from `docs/design/landing/brand.jsx:31-53` verbatim (typed), plus:

```ts
export const ACCENT = '#5B4FE9';
export const ACCENT_DARK = '#4338ca';
```

`components/landing/catalog.ts` — port `CATALOG` from `docs/design/landing/data.js` in full (all ~15 products, every field), with:

```ts
export interface LandingProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  vendor: string;
  type: string;
  tags: string[];
  description: string;
  image: string;
  variants?: { id: string; title: string }[];
}
export const CATALOG: LandingProduct[] = [ /* ported verbatim */ ];
```

`components/landing/brand.tsx` — port `SDLogo` from `docs/design/landing/brand.jsx:3-19` (accent prop defaults to `ACCENT`) and `ShopifyMark` from `docs/design/landing/heroes.jsx:8-15`. Both pure presentational; no 'use client' needed but harmless — omit it.

`components/landing/landing.css` — transcribe from `docs/design/landing/landing-page.html:13-70` and `landing-app.jsx:11-25`, **scoped under `.sd-landing`** (keyframe names stay global — they're prefixed `sd-` already):

```css
.sd-landing {
  --accent: #5B4FE9;
  --accent-d: #4338ca;
  --ink: #1A1A1A;
  --text-strong: #202223;
  --text: #5c5f62;
  --text-sub: #6d7175;
  --border: #e1e3e5;
  --border-sub: #ededed;
  --page: #f6f6f7;
  --cream: #f7f4ef;
  --surface: #ffffff;
  margin: 0;
  font-family: var(--font-inter), -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--text-strong);
  background: var(--surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "cv11", "ss01";
}
.sd-landing *, .sd-landing *::before, .sd-landing *::after { box-sizing: border-box; }
.sd-landing button { font-family: inherit; cursor: pointer; }
.sd-landing a { color: inherit; text-decoration: none; }
.sd-landing .tnum { font-variant-numeric: tabular-nums; }
.sd-landing .serif { font-family: var(--font-dm-serif), Georgia, serif; font-weight: 400; }

@keyframes sd-spin { to { transform: rotate(360deg); } }
@keyframes sd-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
@keyframes sd-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
@keyframes sd-pop {
  from { transform: scale(0.92) translateY(8px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes sd-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.sd-landing .reveal { opacity: 0; transform: translateY(16px);
  transition: opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1); }
.sd-landing .reveal.in { opacity: 1; transform: none; }

@media (max-width: 920px) {
  .sd-landing .hero-grid { grid-template-columns: 1fr !important; }
  .sd-landing .nav-links { display: none !important; }
  .sd-landing .how-grid, .sd-landing .feat-grid, .sd-landing .quote-grid,
  .sd-landing .price-grid, .sd-landing .show-grid { grid-template-columns: 1fr !important; }
  .sd-landing .foot-grid { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 560px) {
  .sd-landing .nav-signin { display: none !important; }
  .sd-landing .foot-grid { grid-template-columns: 1fr !important; }
}

@media (prefers-reduced-motion: reduce) {
  .sd-landing .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
}
```

(Editorial-only rules — `.edi-band`, `.bold-cluster` — are dropped with their heroes. Font families reference the `next/font` CSS variables `--font-inter` / `--font-dm-serif` set in Task 5.)

`next.config.ts` — add alongside existing config (do NOT touch the webpack/turbopack/headers blocks):

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
},
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bunx vitest run components/landing/__tests__/foundation.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add components/landing/ next.config.ts
git commit -m "feat(landing): foundation — tokens, demo catalog, brand marks, scoped CSS"
```

---

### Task 2: ChatDemo — auto-playing hero demo

**Files:**
- Create: `components/landing/use-typewriter.ts`
- Create: `components/landing/chat-demo.tsx`
- Test: `components/landing/__tests__/chat-demo.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/landing/__tests__/chat-demo.test.tsx
import { render, screen, act } from '@testing-library/react';
import { ChatDemo } from '../chat-demo';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('ChatDemo', () => {
  it('renders drawer header with store name and online status', () => {
    render(<ChatDemo />);
    expect(screen.getByText('Ask Field & Form')).toBeInTheDocument();
    expect(screen.getByText(/Online · powered by AI/)).toBeInTheDocument();
  });

  it('starts idle with prompt chips, then types the first query', () => {
    render(<ChatDemo />);
    expect(screen.getByText('What are you looking for? 👋')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(900 + 50 * 60); }); // idle delay + typing
    expect(
      screen.getAllByText(/A low-maintenance plant for my office/).length
    ).toBeGreaterThan(0);
  });

  it('eventually shows product results for the first scenario', () => {
    render(<ChatDemo />);
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByText('Snake Plant in Terracotta')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `bunx vitest run components/landing/__tests__/chat-demo.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`components/landing/use-typewriter.ts` — port `useTypewriter` from `docs/design/landing/chat-demo.jsx:14-30` as a typed client hook:

```ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTypewriter(): [string, (full: string, ms: number, done?: () => void) => void, () => void] {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const run = useCallback((full: string, ms: number, done?: () => void) => {
    let i = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      i++;
      setText(full.slice(0, i));
      if (i >= full.length) {
        if (timer.current) clearInterval(timer.current);
        done?.();
      }
    }, ms);
  }, []);
  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setText('');
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  return [text, run, reset];
}
```

`components/landing/chat-demo.tsx` — `'use client'`. Port `DEMO_SCRIPT`, `MiniProduct`, `ChatDemo` from `docs/design/landing/chat-demo.jsx` per the porting rules. Key adaptations:
- `const reduce = React.useRef(window.matchMedia…)` is NOT SSR-safe → replace with state set in `useEffect`:
  ```ts
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  ```
  and include `reduce` in the cycle effect's dependency array semantics carefully — keep the effect keyed on `scenario` as in the prototype (the `reduce` value is read at cycle start; an extra initial render with `reduce=false` is acceptable).
- Phase union type: `type Phase = 'idle' | 'typing' | 'searching' | 'products' | 'streaming' | 'done'`.
- All styles, timings (900/550/1400/900/4200ms, 42ms/char compose, 18ms/char reply), and copy stay exactly as in the source.

- [ ] **Step 4: Run tests, verify pass**

Run: `bunx vitest run components/landing/__tests__/chat-demo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/
git commit -m "feat(landing): auto-playing ChatDemo with typewriter hook"
```

---

### Task 3: Nav + Conversation hero

**Files:**
- Create: `components/landing/use-reveal.ts`
- Create: `components/landing/hero.tsx`
- Create: `components/landing/nav.tsx`
- Test: `components/landing/__tests__/hero-nav.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/landing/__tests__/hero-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { HeroConversation } from '../hero';
import { Nav } from '../nav';

describe('HeroConversation', () => {
  it('renders headline, subhead, CTAs and trust line', () => {
    render(<HeroConversation />);
    expect(screen.getByText('Your shoppers describe it.')).toBeInTheDocument();
    expect(screen.getByText('Your store finds it.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add to Shopify — free/ })).toHaveAttribute('href', '/api/auth');
    expect(screen.getByText('Installs in minutes')).toBeInTheDocument();
    expect(screen.getByText('No theme edits')).toBeInTheDocument();
  });
  it('mounts the chat demo', () => {
    render(<HeroConversation />);
    expect(screen.getByText('Ask Field & Form')).toBeInTheDocument();
  });
});

describe('Nav', () => {
  it('renders brand, anchor links and install CTA', () => {
    render(<Nav />);
    expect(screen.getByText(/SmartDiscovery/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bunx vitest run components/landing/__tests__/hero-nav.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`components/landing/use-reveal.ts` — `'use client'`; port `useReveal` from `docs/design/landing/sections.jsx:3-14` typed (`useRef<HTMLElement | null>`); IntersectionObserver wholly inside `useEffect` (SSR-safe by construction).

`components/landing/hero.tsx` — `'use client'`. Port from `docs/design/landing/heroes.jsx`: `HEADLINE`/`HEADLINE2`/`SUBHEAD` constants, `CTAButton`, `TrustLine`, `Eyebrow`, `HeroConversation` (lines 78-106). Skip `HeroEditorial`, `HeroBold`, `EditorialSearch`, `FloatCard`. Adaptations:
- `CTAButton` gains optional `href` prop; when set renders `<a>` styled identically (hover handlers stay). Hero primary CTA: `href="/api/auth"`. "Watch the 90-sec demo": plain `<button>` (no behavior in prototype).
- Hero's `.reveal in` classes stay hard-coded `"reveal in"` as in the source (hero is visible immediately; only below-fold sections use the observer).

`components/landing/nav.tsx` — `'use client'`. Port `Nav` from `docs/design/landing/sections.jsx:27-63`, dropping `hero`/`setHero` props. Scroll-solid state via `window.addEventListener('scroll')` inside `useEffect` (SSR-safe). "Add to Shopify" CTA → `href="/api/auth"`. "Sign in" keeps `href="#"`.

- [ ] **Step 4: Run, verify pass**

Run: `bunx vitest run components/landing/__tests__/hero-nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/
git commit -m "feat(landing): sticky nav and Conversation hero"
```

---

### Task 4: Below-fold sections

**Files:**
- Create: `components/landing/sections.tsx` (`SectionLabel`, `LogoStrip`, `HowItWorks`, `ProductCard`, `Showcase`, `Features`)
- Create: `components/landing/sections-lower.tsx` (`Testimonials`, `Pricing`, `FAQItem`, `FAQ`, `FinalCTA`, `Footer`)
- Test: `components/landing/__tests__/sections.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/landing/__tests__/sections.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LogoStrip, HowItWorks, Showcase, Features } from '../sections';
import { Testimonials, Pricing, FAQ, FinalCTA, Footer } from '../sections-lower';

describe('sections', () => {
  it('LogoStrip lists the trusted brands', () => {
    render(<LogoStrip />);
    expect(screen.getByText('Field & Form')).toBeInTheDocument();
    expect(screen.getByText('Loom & Field')).toBeInTheDocument();
  });
  it('HowItWorks renders 3 steps with anchor id', () => {
    const { container } = render(<HowItWorks />);
    expect(container.querySelector('#how')).toBeTruthy();
    expect(screen.getByText('Connect & sync')).toBeInTheDocument();
    expect(screen.getByText('Drop in the drawer')).toBeInTheDocument();
    expect(screen.getByText('Shoppers just ask')).toBeInTheDocument();
  });
  it('Showcase renders the example query and 3 product cards', () => {
    render(<Showcase />);
    expect(screen.getByText(/A low-maintenance plant for my office/)).toBeInTheDocument();
    expect(screen.getByText('Snake Plant in Terracotta')).toBeInTheDocument();
  });
  it('Features renders 6 feature cards with anchor id', () => {
    const { container } = render(<Features />);
    expect(container.querySelector('#features')).toBeTruthy();
    expect(screen.getByText('Bring your own model')).toBeInTheDocument();
    expect(screen.getByText('Anonymous-first')).toBeInTheDocument();
  });
  it('Testimonials renders 3 quotes with stats', () => {
    render(<Testimonials />);
    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('+31%')).toBeInTheDocument();
  });
  it('Pricing renders 3 tiers, Growth highlighted', () => {
    const { container } = render(<Pricing />);
    expect(container.querySelector('#pricing')).toBeTruthy();
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });
  it('FAQ items expand on click', () => {
    render(<FAQ />);
    const q = screen.getByRole('button', { name: /Does it edit my theme files\?/ });
    fireEvent.click(q);
    expect(screen.getByText(/Theme App Extension — an injected overlay/)).toBeInTheDocument();
  });
  it('FinalCTA and Footer render', () => {
    render(<FinalCTA />);
    expect(screen.getByText(/Give every shopper their/)).toBeInTheDocument();
    render(<Footer />);
    expect(screen.getByText(/© 2026 SmartDiscovery AI/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bunx vitest run components/landing/__tests__/sections.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Port each component from `docs/design/landing/sections.jsx` per the porting rules, copy and styles verbatim. Both files `'use client'` (they use `useReveal`/`useState`). Section-specific notes:
- `Showcase`/`ProductCard`: products from `CATALOG` import; `<img>` with alt = product title.
- `Pricing` tier CTAs: "Add to Shopify" → `<a href="/api/auth">`, "Start free trial" → `<a href="/api/auth">` (same destination, install IS the trial), styled as in source.
- `FAQItem`: keep `<button>` + max-height transition exactly; content must be in the DOM only when measurable — prototype keeps it mounted with `maxHeight: 0` — preserve that (the test's `getByText` works because content is always mounted).
- `Footer` columns/links stay `href="#"`.
- `FinalCTA` "Add to Shopify — free" → `/api/auth`; "Book a 15-min walkthrough" stays a button.

- [ ] **Step 4: Run, verify pass**

Run: `bunx vitest run components/landing/__tests__/sections.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/
git commit -m "feat(landing): below-fold sections — how-it-works through footer"
```

---

### Task 5: Page assembly + fonts + full verification

**Files:**
- Rewrite: `app/page.tsx`
- Test: `app/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// app/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import Home from '../page';

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  DM_Serif_Display: () => ({ variable: '--font-dm-serif' }),
}));

describe('landing page', () => {
  it('assembles all sections in order', () => {
    const { container } = render(<Home />);
    expect(screen.getByText('Your shoppers describe it.')).toBeInTheDocument();
    expect(container.querySelector('#how')).toBeTruthy();
    expect(container.querySelector('#features')).toBeTruthy();
    expect(container.querySelector('#pricing')).toBeTruthy();
    expect(container.querySelector('#faq')).toBeTruthy();
    expect(screen.getByText(/© 2026 SmartDiscovery AI/)).toBeInTheDocument();
  });
  it('wraps content in .sd-landing scope', () => {
    const { container } = render(<Home />);
    expect(container.querySelector('.sd-landing')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bunx vitest run app/__tests__/page.test.tsx`
Expected: FAIL — current page.tsx is boilerplate (no such content).

- [ ] **Step 3: Implement `app/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import { Nav } from '@/components/landing/nav';
import { HeroConversation } from '@/components/landing/hero';
import { LogoStrip, HowItWorks, Showcase, Features } from '@/components/landing/sections';
import { Testimonials, Pricing, FAQ, FinalCTA, Footer } from '@/components/landing/sections-lower';
import '@/components/landing/landing.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const dmSerif = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
});

export const metadata: Metadata = {
  title: 'SmartDiscovery AI — Conversational product discovery for Shopify',
  description:
    'SmartDiscovery adds a conversational search assistant to your Shopify storefront. Shoppers ask in plain language — and instantly see real products from your catalog.',
};

export default function Home() {
  return (
    <div id="top" className={`sd-landing ${inter.variable} ${dmSerif.variable}`}>
      <Nav />
      <HeroConversation />
      <LogoStrip />
      <HowItWorks />
      <Showcase />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
```

(No reveal safety-net timeout from `landing-app.jsx` — that guarded a throttled preview iframe; `useReveal`'s observer is reliable in production. The hero renders with `reveal in` hard-coded so above-fold content can never be invisible.)

- [ ] **Step 4: Run page test, verify pass**

Run: `bunx vitest run app/__tests__/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `bun run test`
Expected: 0 failed (66+ files passing including 5 new landing test files).

Run: `bun run build`
Expected: build succeeds; `/` is in the route list. (Build requires env vars present in `.env` — already the case locally.)

Run: `bun lint`
Expected: no NEW errors in `components/landing/` or `app/page.tsx` (pre-existing repo lint errors are out of scope).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/__tests__/ docs/design/landing/
git commit -m "feat(landing): assemble marketing landing page at /

Replaces the create-next-app boilerplate with the SmartDiscovery AI
landing page from the Claude Design handoff (Conversation hero, indigo
accent). Design reference sources committed to docs/design/landing/."
```

---

## Self-Review

- **Spec coverage:** README → chats → landing files all read. Conversation hero ✓ (Task 3), ChatDemo ✓ (Task 2), all 10 page sections ✓ (Tasks 3-5 assemble Nav→Footer matching `landing-app.jsx` order minus dropped Tweaks). Tokens/keyframes/responsive/reduced-motion from `landing-page.html` ✓ (Task 1). Dropped pieces are explicitly enumerated (porting rule 9) and user-approved.
- **Placeholder scan:** every port step names exact source file:lines + exact adaptations; foundation/assembly code is complete inline. No TBDs.
- **Type consistency:** `ACCENT`/`shade`/`rgba` defined Task 1, consumed Tasks 2-4; `CATALOG`/`LandingProduct` Task 1 → Tasks 2,4; `useTypewriter` Task 2 signature matches prototype's `[text, run, reset]`; export names match import sites in Task 5's page.tsx.
