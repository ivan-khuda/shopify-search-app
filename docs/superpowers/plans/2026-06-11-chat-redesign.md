# Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin Chat/History/Saved per the design handoff on both admin and storefront surfaces, with merchant-configurable empty-state variant and product-card density persisted in `ShopSettings`.

**Architecture:** All visual components live in `lib/chat-ui` (shared by admin `chat-shell.tsx` and storefront `DrawerBody.tsx`). Appearance settings are two new `ShopSettings` columns read via a `getShopAppearance` service (admin SSR + HMAC-verified proxy route for the drawer) and written via a session-token-authenticated `PATCH /api/settings/appearance` used by the Settings page and the chat-header density control.

**Tech Stack:** Next.js 16 App Router, Tailwind 4 (arbitrary values for handoff fidelity), Prisma 7, zod, Vitest + RTL. Spec: `docs/superpowers/specs/2026-06-11-chat-redesign-design.md`. Prototype reference: `/tmp/design-handoff/smart-discovery-ai-high-fidelity/project/src/screens/chat.jsx`.

**Conventions:** accent is `#5B4FE9`, exposed as CSS var `--sd-accent` with hex fallbacks in Tailwind arbitrary values. Run any single test with `bunx vitest run <path>`. Full suite: `bun run test`. NEVER `bun test`.

---

### Task 1: Appearance types module

**Files:**
- Create: `lib/chat-ui/appearance.ts`
- Test: `lib/chat-ui/__tests__/appearance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/chat-ui/__tests__/appearance.test.ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE_VARIANTS,
  CARD_DENSITIES,
  DEFAULT_APPEARANCE,
  parseAppearance,
  SD_ACCENT,
} from '../appearance';

describe('appearance module', () => {
  it('exposes the variant unions and defaults', () => {
    expect(EMPTY_STATE_VARIANTS).toEqual(['cards', 'minimal', 'hero']);
    expect(CARD_DENSITIES).toEqual(['compact', 'standard', 'hero']);
    expect(DEFAULT_APPEARANCE).toEqual({
      emptyStateVariant: 'cards',
      cardDensity: 'standard',
    });
    expect(SD_ACCENT).toBe('#5B4FE9');
  });

  it('parseAppearance falls back to defaults for unknown values', () => {
    expect(parseAppearance({ emptyStateVariant: 'hero', cardDensity: 'compact' }))
      .toEqual({ emptyStateVariant: 'hero', cardDensity: 'compact' });
    expect(parseAppearance({ emptyStateVariant: 'bogus', cardDensity: null }))
      .toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**

`bunx vitest run lib/chat-ui/__tests__/appearance.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/chat-ui/appearance.ts
// Shared appearance contract for both chat surfaces (admin + storefront).
// Persisted per-shop in ShopSettings; parseAppearance is the single
// tolerant decoder used by services, API routes, and the drawer fetch.

export const EMPTY_STATE_VARIANTS = ['cards', 'minimal', 'hero'] as const;
export const CARD_DENSITIES = ['compact', 'standard', 'hero'] as const;

export type EmptyStateVariant = (typeof EMPTY_STATE_VARIANTS)[number];
export type CardDensity = (typeof CARD_DENSITIES)[number];

export interface ShopAppearance {
  emptyStateVariant: EmptyStateVariant;
  cardDensity: CardDensity;
}

export const DEFAULT_APPEARANCE: ShopAppearance = {
  emptyStateVariant: 'cards',
  cardDensity: 'standard',
};

// Design-handoff accent (matches the landing page indigo).
export const SD_ACCENT = '#5B4FE9';

export function parseAppearance(raw: unknown): ShopAppearance {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const variant = EMPTY_STATE_VARIANTS.includes(obj.emptyStateVariant as EmptyStateVariant)
    ? (obj.emptyStateVariant as EmptyStateVariant)
    : DEFAULT_APPEARANCE.emptyStateVariant;
  const density = CARD_DENSITIES.includes(obj.cardDensity as CardDensity)
    ? (obj.cardDensity as CardDensity)
    : DEFAULT_APPEARANCE.cardDensity;
  return { emptyStateVariant: variant, cardDensity: density };
}
```

Also re-export from the barrel — append to `lib/chat-ui/index.ts`:

```ts
export {
  EMPTY_STATE_VARIANTS,
  CARD_DENSITIES,
  DEFAULT_APPEARANCE,
  parseAppearance,
  SD_ACCENT,
  type EmptyStateVariant,
  type CardDensity,
  type ShopAppearance,
} from './appearance';
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** `feat(chat-ui): add shared appearance contract`

---

### Task 2: Schema migration — appearance columns, nullable model id

**Files:**
- Modify: `prisma/schema.prisma` (ShopSettings model)
- Modify: `services/chat/getActiveChatModel.ts` (null id → DEFAULT_MODEL)
- Modify: `lib/db/repositories/ShopSettingsRepository.ts`
- Test: existing `services/chat/__tests__/getActiveChatModel.test.ts` (extend)

- [ ] **Step 1: Update schema**

```prisma
model ShopSettings {
  shop              String   @id
  activeChatModelId String? // nullable: appearance-only saves may create the row
  emptyStateVariant String   @default("cards")
  cardDensity       String   @default("standard")
  updatedAt         DateTime @updatedAt

  @@map("shop_settings")
}
```

- [ ] **Step 2: Migrate + regenerate**

```bash
bunx prisma migrate dev --name shop-settings-appearance
bunx prisma generate
```

- [ ] **Step 3: Extend getActiveChatModel test** — add case: row exists with `activeChatModelId: null` → returns DEFAULT_MODEL (mirror the existing "no row" test in that file, with `findUnique` mock returning `{ shop, activeChatModelId: null, emptyStateVariant: 'cards', cardDensity: 'standard', updatedAt: new Date() }`). Run — expect FAIL if resolver doesn't guard null.

- [ ] **Step 4: Guard the resolver** — in `getActiveChatModel.ts`, where the row's id is consumed, treat `null`/empty as the no-row branch:

```ts
const row = await prisma.shopSettings.findUnique({ where: { shop } });
if (!row || !row.activeChatModelId) return DEFAULT_MODEL;
```

- [ ] **Step 5: Update repository** — replace the model-only upsert with field-scoped helpers:

```ts
async upsert(shop: string, activeChatModelId: string): Promise<ShopSettings> {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, activeChatModelId },
    update: { activeChatModelId },
  });
}

async upsertAppearance(
  shop: string,
  fields: { emptyStateVariant?: string; cardDensity?: string },
): Promise<ShopSettings> {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, ...fields },
    update: { ...fields },
  });
}
```

- [ ] **Step 6: Run `bun run test` — suite green. Commit** `feat(db): appearance columns on ShopSettings, nullable model id`

---

### Task 3: getShopAppearance service

**Files:**
- Create: `services/chat/getShopAppearance.ts`
- Test: `services/chat/__tests__/getShopAppearance.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  prisma: { shopSettings: { findUnique } },
}));

import { getShopAppearance } from '../getShopAppearance';

describe('getShopAppearance', () => {
  beforeEach(() => findUnique.mockReset());

  it('returns defaults for empty shop without touching the DB', async () => {
    await expect(getShopAppearance('')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns defaults when no row exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
  });

  it('returns stored values, sanitised through parseAppearance', async () => {
    findUnique.mockResolvedValue({
      shop: 's.myshopify.com', activeChatModelId: null,
      emptyStateVariant: 'hero', cardDensity: 'banana', updatedAt: new Date(),
    });
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'hero', cardDensity: 'standard',
    });
  });

  it('returns defaults when the DB throws (chat hot path never breaks)', async () => {
    findUnique.mockRejectedValue(new Error('down'));
    await expect(getShopAppearance('s.myshopify.com')).resolves.toEqual({
      emptyStateVariant: 'cards', cardDensity: 'standard',
    });
  });
});
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement**

```ts
// services/chat/getShopAppearance.ts
// Read path for the per-shop appearance settings. Mirrors the
// getActiveChatModel resolver philosophy: absence of a row (or any
// error) IS the defaults signal; this never throws into a render path.
import { prisma } from '@/lib/db/client';
import { DEFAULT_APPEARANCE, parseAppearance, type ShopAppearance } from '@/lib/chat-ui/appearance';

export async function getShopAppearance(shop: string): Promise<ShopAppearance> {
  if (!shop) return DEFAULT_APPEARANCE;
  try {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!row) return DEFAULT_APPEARANCE;
    return parseAppearance(row);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
```

- [ ] **Step 4: PASS. Step 5: Commit** `feat(chat): getShopAppearance resolver`

---

### Task 4: PATCH /api/settings/appearance

**Files:**
- Create: `app/api/settings/appearance/route.ts`
- Test: `app/api/settings/appearance/__tests__/route.test.ts`

Mirror `app/api/settings/model/route.ts` exactly for auth/validation idiom (read that file first).

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertAppearance } = vi.hoisted(() => ({
  upsertAppearance: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/db/repositories/ShopSettingsRepository', () => ({
  shopSettingsRepository: { upsertAppearance },
}));
// withShopifySession passthrough: same hoisted-mock pattern as
// app/api/shopify/sync/__tests__/route.test.ts — read it and copy the
// wrapper mock that injects { shop: 'test.myshopify.com', req }.
vi.mock('@/lib/shopify/auth', () => ({
  withShopifySession:
    (handler: (ctx: { shop: string; req: Request }) => Promise<Response>) =>
    (req: Request) => handler({ shop: 'test.myshopify.com', req }),
}));

import { PATCH } from '../route';

const patch = (body: unknown) =>
  PATCH(
    new Request('http://x/api/settings/appearance', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('PATCH /api/settings/appearance', () => {
  beforeEach(() => upsertAppearance.mockClear());

  it('accepts a valid partial body and upserts for the session shop', async () => {
    const res = await patch({ cardDensity: 'compact' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      appearance: { emptyStateVariant: 'cards', cardDensity: 'compact' },
    });
    expect(upsertAppearance).toHaveBeenCalledWith('test.myshopify.com', {
      cardDensity: 'compact',
    });
  });

  it('rejects unknown enum values', async () => {
    const res = await patch({ emptyStateVariant: 'sparkly' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_body' });
    expect(upsertAppearance).not.toHaveBeenCalled();
  });

  it('rejects an empty body (at least one field required)', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement**

```ts
// app/api/settings/appearance/route.ts
// PATCH — single write path for ShopSettings.emptyStateVariant/cardDensity.
// Auth, multi-tenancy, and error-shape contract mirror
// app/api/settings/model/route.ts (shop from session only; zero logging).
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';
import {
  EMPTY_STATE_VARIANTS,
  CARD_DENSITIES,
  parseAppearance,
} from '@/lib/chat-ui/appearance';

const Body = z
  .object({
    emptyStateVariant: z.enum(EMPTY_STATE_VARIANTS).optional(),
    cardDensity: z.enum(CARD_DENSITIES).optional(),
  })
  .strict()
  .refine((b) => b.emptyStateVariant !== undefined || b.cardDensity !== undefined);

export const PATCH = withShopifySession(async ({ shop, req }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const row = await shopSettingsRepository.upsertAppearance(shop, parsed.data);
  return Response.json({ ok: true, appearance: parseAppearance(row) });
});
```

Note: the first test expects `{ emptyStateVariant: 'cards', cardDensity: 'compact' }` — the mocked repo returns `{}` so `parseAppearance` fills `cards` and… `standard`, not `compact`. Make the mock faithful instead: `upsertAppearance.mockResolvedValue({ emptyStateVariant: 'cards', cardDensity: 'compact' })` inside that test before calling.

- [ ] **Step 4: PASS. Step 5: Commit** `feat(api): PATCH /api/settings/appearance`

---

### Task 5: GET /api/proxy/_meta/appearance (storefront read)

**Files:**
- Create: `app/api/proxy/_meta/appearance/route.ts`
- Test: `app/api/proxy/_meta/appearance/__tests__/route.test.ts`

- [ ] **Step 1: Failing test** — mirror the test for `app/api/proxy/_meta/bundle-url` (read it first; copy its `withAppProxyHmac` mock idiom). Assertions:

```ts
const { getShopAppearance } = vi.hoisted(() => ({
  getShopAppearance: vi.fn().mockResolvedValue({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
  }),
}));
vi.mock('@/services/chat/getShopAppearance', () => ({ getShopAppearance }));
vi.mock('@/lib/shopify/app-proxy-auth', () => ({
  withAppProxyHmac:
    (handler: (ctx: { shop: string }) => Promise<Response>) => () =>
      handler({ shop: 'test.myshopify.com' }),
}));

import { GET } from '../route';

it('returns the shop appearance as JSON', async () => {
  const res = await GET(new Request('http://x'));
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    emptyStateVariant: 'hero',
    cardDensity: 'compact',
  });
  expect(getShopAppearance).toHaveBeenCalledWith('test.myshopify.com');
});
```

- [ ] **Step 2: FAIL. Step 3: Implement**

```ts
// app/api/proxy/_meta/appearance/route.ts
// HMAC-verified appearance read for the storefront drawer. Same auth
// boundary as bundle-url discovery; response carries no shop identifier.
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { getShopAppearance } from '@/services/chat/getShopAppearance';

export const GET = withAppProxyHmac(async ({ shop }) => {
  const appearance = await getShopAppearance(shop);
  return Response.json(appearance, {
    headers: { 'cache-control': 'private, max-age=60' },
  });
});
```

(Match `withAppProxyHmac`'s actual handler signature from `lib/shopify/app-proxy-auth.ts:123` — adjust ctx destructuring if it provides more fields.)

- [ ] **Step 4: PASS. Step 5: Commit** `feat(api): proxy appearance endpoint for drawer`

---

### Task 6: SDLogo component

**Files:**
- Create: `lib/chat-ui/components/sd-logo.tsx`
- Test: `lib/chat-ui/__tests__/sd-logo.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SDLogo } from '../components/sd-logo';

describe('SDLogo', () => {
  it('renders the compass-spark mark at the requested size', () => {
    const { container } = render(<SDLogo size={28} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('28px');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: FAIL. Step 3: Implement** — port `brand.jsx` SDLogo verbatim (gradient tile + compass/spark SVG), accent from `SD_ACCENT`:

```tsx
'use client';
// Compass-spark brand mark from the design handoff (brand.jsx).
import { SD_ACCENT } from '../appearance';

export function SDLogo({ size = 28 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${SD_ACCENT} 0%, #4a3fd1 100%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 4px 12px ${SD_ACCENT}33`,
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="6.5" stroke="white" strokeWidth="1.7" fill="none" opacity="0.95" />
        <path d="M14.5 14.5 L19 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 7.5 L12.2 10.3 L15 11 L12.2 11.7 L11 14.5 L9.8 11.7 L7 11 L9.8 10.3 Z" fill="white" />
      </svg>
    </div>
  );
}
```

Export from barrel: `export { SDLogo } from './components/sd-logo';`

- [ ] **Step 4: PASS. Step 5: Commit** `feat(chat-ui): SDLogo brand mark`

---

### Task 7: ProductCard density variants

**Files:**
- Modify: `lib/chat-ui/components/product-card.tsx` (rewrite)
- Test: `lib/chat-ui/__tests__/product-card.test.tsx` (extend — keep existing assertions that still apply)

- [ ] **Step 1: Extend test with density cases (failing)**

```tsx
it('compact density hides kicker and description', () => {
  const { container, queryByText } = render(
    <ProductCard product={PRODUCT} density="compact" isSaved={false} onSave={noop} />,
  );
  expect(queryByText(PRODUCT.description!)).toBeNull();
  expect(container.firstElementChild!.className).toContain('rounded-lg');
});

it('hero density renders the horizontal layout with View product button', () => {
  const { getByRole } = render(
    <ProductCard product={PRODUCT} density="hero" isSaved={false} onSave={noop} />,
  );
  expect(getByRole('button', { name: /view product/i })).toBeInTheDocument();
});

it('defaults to standard density with VIEW link affordance', () => {
  const { getByText } = render(
    <ProductCard product={PRODUCT} isSaved={false} onSave={noop} />,
  );
  expect(getByText(/view/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: FAIL. Step 3: Rewrite component** (visuals from prototype `ProductCard`/`SaveButton`; keep `next/image` and existing a11y labels):

```tsx
'use client';

import { Heart } from 'lucide-react';
import Image from 'next/image';
import type { ChatProduct } from '@/types/product';
import type { CardDensity } from '../appearance';

interface ProductCardProps {
  product: ChatProduct;
  isSaved: boolean;
  onSave: () => void;
  density?: CardDensity;
}

function SaveButton({ isSaved, onSave, small }: { isSaved: boolean; onSave: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={isSaved ? 'Remove saved product' : 'Save product'}
      onClick={onSave}
      className={`absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur ${small ? 'h-6 w-6' : 'h-7 w-7'}`}
    >
      <Heart size={small ? 12 : 14} className={isSaved ? 'fill-red-500 text-red-500' : 'text-[#6d7175]'} />
    </button>
  );
}

function CardImage({ product }: { product: ChatProduct }) {
  return product.image ? (
    <Image
      src={product.image}
      alt={product.title}
      fill
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      unoptimized
      className="object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
  );
}

export function ProductCard({ product, isSaved, onSave, density = 'standard' }: ProductCardProps) {
  if (density === 'hero') {
    return (
      <div className="grid grid-cols-[200px_1fr] overflow-hidden rounded-[14px] border border-[#e1e3e5] bg-white">
        <div className="relative aspect-square bg-[#f6f6f7]">
          <CardImage product={product} />
          <SaveButton isSaved={isSaved} onSave={onSave} />
        </div>
        <div className="flex flex-col p-4">
          <div className="mb-1 text-[10px] font-bold tracking-[0.06em] text-[#6d7175] uppercase">
            {[product.vendor, product.type].filter(Boolean).join(' · ')}
          </div>
          <div className="mb-1.5 text-[15px] font-semibold text-[#202223]">{product.title}</div>
          <p className="m-0 flex-1 text-[12.5px] leading-normal text-[#5c5f62] line-clamp-3">
            {product.description}
          </p>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[17px] font-semibold text-[#202223]">{product.price}</span>
            <button
              type="button"
              className="rounded-[7px] border-none bg-[var(--sd-accent,#5B4FE9)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              View product →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const compact = density === 'compact';
  return (
    <div className={`flex h-full flex-col overflow-hidden border border-[#e1e3e5] bg-white ${compact ? 'rounded-lg' : 'rounded-xl'}`}>
      <div className="relative aspect-square bg-[#f6f6f7]">
        <CardImage product={product} />
        <SaveButton isSaved={isSaved} onSave={onSave} small={compact} />
      </div>
      <div className={`flex flex-1 flex-col ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
        {!compact && product.type && (
          <div className="mb-0.5 text-[9.5px] font-bold tracking-[0.06em] text-[#8c9196] uppercase">
            {product.type}
          </div>
        )}
        <div className={`truncate font-semibold text-[#202223] ${compact ? 'text-xs' : 'text-[13px]'}`}>
          {product.title}
        </div>
        {!compact && (
          <div className="mt-0.5 text-[11.5px] leading-snug text-[#6d7175] line-clamp-2">
            {product.description}
          </div>
        )}
        <div className={`flex items-center justify-between ${compact ? 'mt-1' : 'mt-2'}`}>
          <span className={`font-semibold text-[#202223] ${compact ? 'text-[13px]' : 'text-sm'}`}>
            {product.price}
          </span>
          {!compact && (
            <span className="text-[10.5px] font-bold tracking-[0.04em] text-[var(--sd-accent,#5B4FE9)]">
              VIEW →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: `ChatProduct` may lack `vendor`/`type` fields — check `types/product.ts`; if absent, add them as optional strings (they flow from search results; absent values render nothing).

- [ ] **Step 4: Run product-card tests + fix any existing assertions tied to old markup. Step 5: Commit** `feat(chat-ui): product card density variants`

---

### Task 8: EmptyChat variants

**Files:**
- Create: `lib/chat-ui/components/empty-chat.tsx`
- Test: `lib/chat-ui/__tests__/empty-chat.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyChat, SUGGESTED_PROMPTS } from '../components/empty-chat';

describe('EmptyChat', () => {
  it('cards variant shows greeting, prompts, and tip', () => {
    render(<EmptyChat variant="cards" onPick={vi.fn()} catalogCount={151} />);
    expect(screen.getByText(/hi there/i)).toBeInTheDocument();
    expect(screen.getByText(/151 products/)).toBeInTheDocument();
    expect(screen.getByText(/RRF/)).toBeInTheDocument();
  });

  it('minimal variant shows the centered heading', () => {
    render(<EmptyChat variant="minimal" onPick={vi.fn()} />);
    expect(screen.getByText(/ask anything about your catalog/i)).toBeInTheDocument();
  });

  it('hero variant shows the banner headline', () => {
    render(<EmptyChat variant="hero" onPick={vi.fn()} modelName="Gemini 2.5 Flash" />);
    expect(screen.getByText(/what are your customers/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini 2.5 flash/i)).toBeInTheDocument();
  });

  it('clicking a prompt fires onPick with its text', () => {
    const onPick = vi.fn();
    render(<EmptyChat variant="cards" onPick={onPick} />);
    fireEvent.click(screen.getByText(SUGGESTED_PROMPTS[0].text));
    expect(onPick).toHaveBeenCalledWith(SUGGESTED_PROMPTS[0].text);
  });
});
```

- [ ] **Step 2: FAIL. Step 3: Implement** — port the three prototype variants (`EmptyChat` in chat.jsx lines 322–476) to Tailwind. Skeleton:

```tsx
'use client';

import { SDLogo } from './sd-logo';
import type { EmptyStateVariant } from '../appearance';

export const SUGGESTED_PROMPTS = [
  { icon: '☕', text: 'Something to drink coffee out of' },
  { icon: '🌿', text: 'A low-maintenance plant for my office' },
  { icon: '🍽️', text: 'Dinnerware for four — neutral, modern' },
  { icon: '🎁', text: 'Hostess gift under $50' },
] as const;

interface EmptyChatProps {
  variant: EmptyStateVariant;
  onPick: (text: string) => void;
  catalogCount?: number;
  modelName?: string;
}

export function EmptyChat({ variant, onPick, catalogCount, modelName }: EmptyChatProps) {
  if (variant === 'minimal') { /* centered SDLogo 44 + heading + single-col list with ↗ */ }
  if (variant === 'hero') { /* gradient banner (135deg accent→#4a3fd1, blobs) + "Try one" 2-col grid */ }
  /* default cards: SDLogo 40 + greeting + indexed-count line + 2-col TRY IT cards + RRF tip box */
}
```

Implement all three branches fully per the prototype source — colors/sizes are in the JSX inline styles; translate 1:1 to Tailwind arbitrary values (`text-[13.5px]`, `border-[#e1e3e5]`, `bg-[#5B4FE9]/5` etc.). The cards-variant greeting line is:
`I've indexed all <strong>{catalogCount ?? '—'} products</strong>. Ask me anything a shopper might — here are a few starters to try:` and the tip box text:
`Tip: queries with brand names or SKUs use BM25; descriptive queries use vector similarity. Both fuse via RRF.`

Export from barrel: `export { EmptyChat, SUGGESTED_PROMPTS } from './components/empty-chat';`

- [ ] **Step 4: PASS. Step 5: Commit** `feat(chat-ui): EmptyChat with cards/minimal/hero variants`

---

### Task 9: ChatMessage + MessageParts restyle (density-aware)

**Files:**
- Modify: `lib/chat-ui/components/chat-message.tsx`
- Modify: `lib/chat-ui/components/message-parts.tsx`
- Test: `lib/chat-ui/__tests__/message-parts.test.tsx` (extend), `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` (will keep passing — verify)

- [ ] **Step 1: Extend message-parts test (failing)** — assert density threads to grid + cards:

```tsx
it('renders the product grid single-column for hero density', () => {
  render(<MessageParts parts={TOOL_OUTPUT_PARTS} messageId="m1" density="hero"
    savedProductIds={new Set()} onToggleSave={noop} />);
  const list = screen.getByRole('list');
  expect(list.className).toContain('grid-cols-1');
  expect(list.className).not.toContain('lg:grid-cols-3');
});
```

- [ ] **Step 2: FAIL. Step 3: Implement.**

`message-parts.tsx`: add `density?: CardDensity` prop (default `'standard'`); grid classes become:

```tsx
const gridClass =
  density === 'hero'
    ? 'grid grid-cols-1 gap-3'
    : density === 'compact'
      ? 'grid grid-cols-2 gap-2 lg:grid-cols-3'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
```

Pass `density` into each `<ProductCard …/>`. Restyle the searching state to the prototype pill (white bg, `border-[#e1e3e5]`, rounded-xl, accent spinner via `border-[var(--sd-accent,#5B4FE9)]/20 border-t-[var(--sd-accent,#5B4FE9)] animate-spin`). Keep `role="status"` and copy `Searching your catalog…` (already matches the prototype). After the text part when streaming is finished the action row renders in `chat-message.tsx`, not here.

`chat-message.tsx`: rewrite the bubble shells —
- user: `bg-[var(--sd-accent,#5B4FE9)] text-white rounded-[14px] rounded-br-[4px] px-3.5 py-2.5 text-sm max-w-[480px] self-end shadow-[0_1px_2px_rgba(91,79,233,0.3)]`
- assistant: avatar `<SDLogo size={28}/>` (replaces the "S" circle), content column; text bubble `bg-white border border-[#e1e3e5] rounded-[14px] rounded-bl-[4px] px-3.5 py-3 text-sm max-w-[600px]`
- add props `density?: CardDensity` (forward to MessageParts) and `groundedCount?: number`; when `status !== 'streaming'` and the message is the last assistant message, render the action row:

```tsx
<div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8c9196]">
  <button type="button" className="rounded px-1.5 py-0.5">👍 Helpful</button>
  <button type="button" className="rounded px-1.5 py-0.5">👎</button>
  <button type="button" className="rounded px-1.5 py-0.5"
    onClick={() => navigator.clipboard?.writeText(textContent)}>📋 Copy</button>
  <span className="ml-auto flex items-center gap-1">
    <span className="h-[5px] w-[5px] rounded-full bg-[#008060]" />
    {groundedCount ?? 0} grounded result{(groundedCount ?? 0) === 1 ? '' : 's'}
  </span>
</div>
```

`groundedCount` is computed in ChatPane (Task 10) from the message's `tool-searchCatalog` output length; `textContent` is the concatenated text parts.

- [ ] **Step 4: Run message-parts + chat-pane integration tests; fix fallout. Step 5: Commit** `feat(chat-ui): redesign message bubbles per handoff`

---

### Task 10: ChatPane redesign (layout, composer, auto-scroll, resume)

**Files:**
- Modify: `lib/chat-ui/components/chat-pane.tsx`
- Test: `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` (extend)

New props:

```ts
interface ChatPaneProps {
  adapter: ChatIdentityAdapter;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  onHistoryAdd: (entry: ChatHistoryItem) => void;
  density?: CardDensity;            // default 'standard'
  emptyStateVariant?: EmptyStateVariant; // default 'cards'
  catalogCount?: number;            // cards-variant greeting
  modelName?: string;               // hero-variant badge
  autoSubmitQuery?: string | null;  // history-resume: submit once on change
}
```

- [ ] **Step 1: Extend integration test (failing)** — (a) empty state renders EmptyChat cards variant (`getByText(/hi there/i)`); (b) `autoSubmitQuery="red mug"` triggers `sendMessage` once with that text; (c) messages container ref scrolls (assert `scrollTop` set — jsdom: assign `scrollHeight` via `Object.defineProperty`, rerender with new message, expect `scrollTop === scrollHeight`).

- [ ] **Step 2: FAIL. Step 3: Implement.** Keep the PromptInput compound components (attachments machinery) but restyle the visual shell to the prototype composer:

  - Root: `flex h-full min-h-0 flex-col` (height contract from viewport-layout tests stays intact — messages list keeps `flex-1 min-h-0 overflow-y-auto`, composer wrapper keeps `shrink-0`).
  - Scroll area gains `bg-[#fafbfb]`; inner column `mx-auto w-full max-w-[780px] px-6 flex flex-col gap-4`.
  - Replace the old greeting + `PromptChips` block with `<EmptyChat variant={emptyStateVariant} onPick={submitText} catalogCount={catalogCount} modelName={modelName} />`.
  - Auto-scroll: `const scrollRef = useRef<HTMLDivElement>(null);` + `useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, status]);`
  - Resume: `useEffect(() => { if (autoSubmitQuery) submitText(autoSubmitQuery); }, [autoSubmitQuery]);` — the parent passes a fresh string (`{ query, nonce }` is unnecessary: parent appends `'​'.repeat(n)`? NO — keep it honest: parent passes `{ id, query }` object; see Task 12 for the shell side. Use prop `autoSubmitQuery?: { id: number; query: string } | null` and effect keyed on `autoSubmitQuery?.id`.)
  - Composer card: `rounded-[14px] border-[1.5px] border-[#c9ccd0] bg-white p-3 flex flex-col gap-2 focus-within:border-[var(--sd-accent,#5B4FE9)]`. Tools row: restyle existing attach menu trigger + a "Hybrid search" chip (`bg-[#f1f2f4] text-[#5c5f62] text-[11.5px] font-medium rounded-[7px] px-2.5 py-1`), hint `Press <kbd>↵</kbd> to send` (kbd: `px-1 py-px bg-[#f1f2f4] border border-[#e1e3e5] rounded text-[10px]`), submit button `h-[30px] w-[30px] rounded-lg bg-[var(--sd-accent,#5B4FE9)] text-white disabled:bg-[#dadada]` with the arrow SVG.
  - Compute `groundedCount` per assistant message from its `tool-searchCatalog` `output-available` part (`Array.isArray(part.output) ? part.output.length : 0`) and pass `density`/`groundedCount` into `ChatMessage`.
  - Set `style={{ '--sd-accent': SD_ACCENT } as React.CSSProperties}` on the root so every `var(--sd-accent, …)` below resolves (storefront drawer may override the var with the merchant theme accent later).

- [ ] **Step 4: Run integration + viewport-layout tests — PASS. Step 5: Commit** `feat(chat-ui): redesign chat pane and composer`

---

### Task 11: HistoryPanel (+resume) and SavedProductsPanel (density grid)

**Files:**
- Modify: `lib/chat-ui/components/history-panel.tsx`
- Modify: `lib/chat-ui/components/saved-products-panel.tsx`
- Test: `lib/chat-ui/__tests__/history-panel.test.tsx`, `lib/chat-ui/__tests__/saved-products-panel.test.tsx` (extend)

- [ ] **Step 1: Failing tests.** History: `onResume` prop fires with the row's query on click; header copy `Search history` + sub "Conversations from this preview session"; empty state shows dashed card with "No history yet". Saved: `density="compact"` grid has `lg:grid-cols-5`; header shows `N items bookmarked`; empty shows "Nothing saved".

- [ ] **Step 2: FAIL. Step 3: Implement both** per prototype `HistoryPane`/`SavedPane` (lines 694–830): history rows are full-width `<button>`s (search-icon tile 32px `bg-[#f1f2f4]`, query truncated, `timestamp · N results`, chevron); Clear-all is the small bordered red button. Saved grid:

```tsx
const gridClass =
  density === 'compact'
    ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'
    : 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';
// hero density renders standard cards in the standard grid (prototype line 821)
const cardDensity = density === 'hero' ? 'standard' : density;
```

Both panels keep their existing props and add: history `onResume: (query: string) => void`; saved `density?: CardDensity`. Empty states: inline dashed-border card (`border border-dashed border-[#e1e3e5] rounded-xl bg-white px-6 py-10 text-center`) with icon tile — replaces `EmptyState` import in these two panels (leave `empty-state.tsx` untouched; other consumers may use it).

- [ ] **Step 4: PASS. Step 5: Commit** `feat(chat-ui): redesign history and saved panels`

---

### Task 12: Admin chat shell — header, badges, density control, resume wiring

**Files:**
- Modify: `app/(embedded)/chat/chat-shell.tsx`
- Modify: `app/(embedded)/chat/page.tsx`
- Test: `app/(embedded)/chat/__tests__/chat-shell.test.tsx` (update), `app/(embedded)/chat/__tests__/new-chat.test.tsx` + `viewport-layout.test.tsx` (keep green)

- [ ] **Step 1: Update chat-shell tests (failing)** — new props `{ shop, modelName, appearance, catalogCount }`; assertions: tab badges render history/saved counts; density segmented control renders three options and clicking one PATCHes `/api/shopify/…` — mock `fetch` and `shopify.idToken`; "Playground" heading present; preview-mode pill text present.

- [ ] **Step 2: FAIL. Step 3: Implement.**

`page.tsx`: load in parallel and pass down; banner div is removed (its content moves into the header pill):

```tsx
const [model, appearance, catalogCount] = await Promise.all([
  getActiveChatModel(shop),
  getShopAppearance(shop),
  shop ? prisma.product.count({ where: { shop } }) : Promise.resolve(0),
]);
// …
<div className="min-h-0 flex-1">
  <ChatShell shop={shop} modelName={model.displayName}
    appearance={appearance} catalogCount={catalogCount} />
</div>
```

(Verify the `Product` model's shop column name in `prisma/schema.prisma` — adjust the `where` accordingly.)

`chat-shell.tsx`:
- Header per prototype: left column `Playground` h1 + pill row (accent dot pill "Preview mode — using your real catalog" + `· Model: <strong>{modelName}</strong>`); center: existing `Tabs`/`TabsList` restyled (`bg-[#f1f2f4] rounded-[10px] p-[3px]`, triggers `text-[12.5px]`, active = white bg + shadow) with badge spans (`history.items.length`, `saved.items.length`) — keep the motion `Tabs` primitives, only classNames change; right: density segmented control + New chat button (outlined: `border border-[#c9ccd0] rounded-lg px-3 py-[7px] text-[12.5px] font-semibold`).
- Density control state: `const [density, setDensity] = useState(appearance.cardDensity);` — on click: optimistic `setDensity(d)` then

```ts
const token = await shopify.idToken();
await fetch('/api/settings/appearance', {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ cardDensity: d }),
});
```

(no rollback UI in V1; failures leave the local value — same next-load source of truth as settings page).
- Resume: `const [resume, setResume] = useState<{ id: number; query: string } | null>(null);` `HistoryPanel onResume={(q) => { setResume({ id: Date.now(), query: q }); setSelectedTab('chat'); }}`; pass `autoSubmitQuery={resume}` to ChatPane.
- Thread `density={density}`, `emptyStateVariant={appearance.emptyStateVariant}`, `catalogCount`, `modelName` into ChatPane; `density` into SavedProductsPanel.
- Root keeps `h-full flex flex-col`; the height-chain classes from the viewport tests are untouched.

- [ ] **Step 4: Run all `app/(embedded)/chat/__tests__/` — PASS. Step 5: Commit** `feat(chat): redesigned playground shell with density control`

---

### Task 13: Settings page Appearance section

**Files:**
- Modify: `app/(embedded)/settings/page.tsx` (load appearance, pass prop)
- Modify: `app/(embedded)/settings/settings-form.tsx` (new section)
- Test: `app/(embedded)/settings/__tests__/` (extend existing form test)

- [ ] **Step 1: Failing test** — render `SettingsForm` with `appearance={{ emptyStateVariant: 'cards', cardDensity: 'standard' }}`; assert two `s-choice-list` groups ("Empty state style", "Product card density") render all options; selecting `hero` + clicking the appearance Save button calls `fetch('/api/settings/appearance', …)` with `{ emptyStateVariant: 'hero' }` (mock `shopify.idToken` + `fetch` per the existing model-save test idiom in that file).

- [ ] **Step 2: FAIL. Step 3: Implement.** `page.tsx`: `const appearance = await getShopAppearance(shop ?? '');` → `<SettingsForm … appearance={appearance} />`. `settings-form.tsx`: new `<s-section heading="Appearance">` after the model section with two `<s-choice-list>` radio groups (option labels: Cards/Minimal/Hero with one-line descriptions; Compact/Standard/Hero likewise), local state initialised from the prop, its own Save button calling PATCH `/api/settings/appearance` with only changed fields, success → `shopify.toast.show('Appearance saved')`, error → inline `<s-banner tone="critical">` with the error code (mirror the model-save handlers in the same file — copy the `s-choice` `selected`-attr spread idiom documented in the file header).

- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): appearance section (empty state + density)`

---

### Task 14: Storefront drawer wiring + bundle

**Files:**
- Modify: `extensions-src/chat-drawer/components/DrawerBody.tsx`
- Test: extend whichever `__tests__` covers DrawerBody (check `lib/chat-ui/__tests__/` and `__tests__/bundle-build.test.ts` neighbours; if none exists, create `extensions-src/chat-drawer/__tests__/drawer-body.test.tsx` with the same jsdom setup as chat-pane tests)

- [ ] **Step 1: Failing test** — mock `fetch` for `/apps/smartdiscovery/_meta/appearance` returning `{ emptyStateVariant: 'hero', cardDensity: 'compact' }`; render DrawerBody (chat tab) with mocked stores/adapters (copy mock idiom from existing storefront adapter tests); assert ChatPane receives `density="compact"` (stub ChatPane via `vi.mock('@/lib/chat-ui', …)` capturing props) and that before fetch resolves it rendered with defaults.

- [ ] **Step 2: FAIL. Step 3: Implement** —

```tsx
const [appearance, setAppearance] = React.useState<ShopAppearance>(DEFAULT_APPEARANCE);
React.useEffect(() => {
  let cancelled = false;
  fetch('/apps/smartdiscovery/_meta/appearance')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (!cancelled && data) setAppearance(parseAppearance(data)); })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);
```

Thread `density={appearance.cardDensity}` + `emptyStateVariant={appearance.emptyStateVariant}` into ChatPane and `density` into SavedProductsPanel. (App-proxy prefix `/apps/smartdiscovery` matches `shopify.app.toml` `[app_proxy]` subpath/prefix.)

- [ ] **Step 4: PASS. Step 5: Rebuild bundle + verify** `bun run build:storefront-bundle` exits 0 and `__tests__/bundle-build.test.ts` passes. **Commit** `feat(drawer): appearance-aware storefront drawer`

---

### Task 15: Full verification sweep

- [ ] `bun run test` — entire suite green.
- [ ] `bun lint` — no NEW errors vs. baseline (repo has pre-existing errors; compare your changed files with `bunx eslint <files>` → clean).
- [ ] `bunx tsc --noEmit` — no NEW errors mentioning changed files.
- [ ] `bun run build` — production build succeeds.
- [ ] Manual: `/chat` in embedded admin — header matches handoff, empty-state variant switches when changed in Settings, density control re-lays grids instantly, history resume re-runs the query, New chat clears.
- [ ] Commit any test/doc stragglers; update `CLAUDE.md` Components section if barrel exports changed materially.
