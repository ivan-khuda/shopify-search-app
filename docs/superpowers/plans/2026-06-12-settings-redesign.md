# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/settings` to the design-handoff side-nav layout with five functional sections, backed by new ShopSettings columns, a per-shop cap override, surface-split request counting, and a storefront drawer that honors the new presentation settings.

**Architecture:** One `ShopSettings` migration + a `getShopSettings` resolver feed both the embedded settings page (SSR + `PATCH /api/settings/shop`) and the storefront drawer (extended `/api/proxy/_meta/appearance`). The page itself becomes a client side-nav shell with five section components, Tailwind arbitrary values per the prototype.

**Tech Stack:** Next.js 16 App Router, Tailwind 4, Prisma 7, zod, Vitest + RTL. Spec: `docs/superpowers/specs/2026-06-12-settings-redesign-design.md`. Prototype: `/tmp/design-handoff2/smart-discovery-ai-high-fidelity/project/src/screens/settings.jsx` (READ IT — every pixel value lives there).

**Conventions:** bun only; single test `bunx vitest run <path>`; full suite `bun run test`; NEVER `bun test`. Accent var `--sd-accent` fallback `#5B4FE9`. Zero `console.*`. Commits: Conventional Commits, body ends `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Existing seams (verified):**
- Cap: `services/chat/CapService.ts` — `DEFAULT_CAP = 2000`, env `HARD_CAP_REQUESTS_PER_MONTH`, called by `app/api/chat/route.ts:66` and `app/api/proxy/chat/route.ts:105`.
- Counter: `lib/db/repositories/RequestCounterRepository.ts` `tryConsume(shop, period, cap)` — atomic upsert with `WHERE requestCount < cap`.
- Email: `inngest/functions/sync-products.ts:61` `fetchShopContactEmail(session)` (also used in the success path — grep `contactEmail` in that file for both sites).
- Model catalog: `services/chat/model-catalog.ts` `CatalogModel { id, displayName, provider, contextWindow, inputPricePerMillion, outputPricePerMillion, bestFor }`; default model id in `services/chat/getActiveChatModel.ts` (`DEFAULT_MODEL`).
- Drawer meta: `app/api/proxy/_meta/appearance/route.ts` returns `getShopAppearance(shop)`; `DrawerBody.tsx` fetches it.
- EmptyChat props: `{ variant, onPick, catalogCount?, modelName? }` in `lib/chat-ui/components/empty-chat.tsx`; `SUGGESTED_PROMPTS` exported there.

---

### Task 1: Schema migration + settings contract module

**Files:**
- Modify: `prisma/schema.prisma` (ShopSettings + RequestCounter)
- Create: `lib/settings/contract.ts`
- Test: `lib/settings/__tests__/contract.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/settings/__tests__/contract.test.ts
import { describe, expect, it } from 'vitest';
import {
  DRAWER_ACCENT_PALETTE,
  DEFAULT_SHOP_SETTINGS,
  MAX_SUGGESTED_PROMPTS,
  parseShopSettings,
} from '../contract';

describe('shop settings contract', () => {
  it('exposes palette and defaults', () => {
    expect(DRAWER_ACCENT_PALETTE).toEqual(['#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A']);
    expect(MAX_SUGGESTED_PROMPTS).toBe(6);
    expect(DEFAULT_SHOP_SETTINGS).toMatchObject({
      emptyStateVariant: 'cards',
      cardDensity: 'standard',
      drawerAccent: '#5B4FE9',
      greetingMessage: null,
      suggestedPrompts: [],
      monthlyCapRequests: null,
      notificationEmail: null,
      drawerEnabled: true,
      editorPreviewVisible: true,
    });
  });

  it('parseShopSettings sanitises bad values to defaults', () => {
    expect(parseShopSettings({
      emptyStateVariant: 'hero',
      drawerAccent: '#008060',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
      drawerEnabled: false,
    })).toMatchObject({
      emptyStateVariant: 'hero',
      drawerAccent: '#008060',
      suggestedPrompts: [{ icon: '☕', text: 'coffee' }],
      drawerEnabled: false,
    });
    expect(parseShopSettings({
      drawerAccent: 'red',                       // not in palette → default
      suggestedPrompts: 'nope',                  // not array → []
      monthlyCapRequests: -5,                    // non-positive → null
    })).toMatchObject({
      drawerAccent: '#5B4FE9',
      suggestedPrompts: [],
      monthlyCapRequests: null,
    });
    expect(parseShopSettings(null)).toEqual(DEFAULT_SHOP_SETTINGS);
  });

  it('caps suggestedPrompts at MAX and drops malformed entries', () => {
    const prompts = Array.from({ length: 9 }, (_, i) => ({ icon: '✨', text: `p${i}` }));
    const parsed = parseShopSettings({ suggestedPrompts: [...prompts, { bad: true }] });
    expect(parsed.suggestedPrompts).toHaveLength(6);
    expect(parsed.suggestedPrompts[0]).toEqual({ icon: '✨', text: 'p0' });
  });
});
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement**

```ts
// lib/settings/contract.ts
// Full per-shop settings contract. Superset of lib/chat-ui/appearance.ts:
// appearance stays the chat-surface subset; this module owns everything the
// settings page and the drawer meta endpoint exchange. parseShopSettings is
// the single tolerant decoder (DB row → typed bundle, defaults on garbage).
import {
  DEFAULT_APPEARANCE,
  parseAppearance,
  type ShopAppearance,
} from '@/lib/chat-ui/appearance';

export const DRAWER_ACCENT_PALETTE = [
  '#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A',
] as const;
export type DrawerAccent = (typeof DRAWER_ACCENT_PALETTE)[number];

export const MAX_SUGGESTED_PROMPTS = 6;
export const MAX_PROMPT_TEXT = 120;
export const MAX_PROMPT_ICON = 8;
export const MAX_GREETING = 200;

export interface SuggestedPrompt {
  icon: string;
  text: string;
}

export interface ShopSettingsBundle extends ShopAppearance {
  drawerAccent: DrawerAccent;
  greetingMessage: string | null;
  suggestedPrompts: SuggestedPrompt[];
  monthlyCapRequests: number | null;
  notificationEmail: string | null;
  drawerEnabled: boolean;
  editorPreviewVisible: boolean;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettingsBundle = {
  ...DEFAULT_APPEARANCE,
  drawerAccent: '#5B4FE9',
  greetingMessage: null,
  suggestedPrompts: [],
  monthlyCapRequests: null,
  notificationEmail: null,
  drawerEnabled: true,
  editorPreviewVisible: true,
};

function parsePrompts(raw: unknown): SuggestedPrompt[] {
  if (!Array.isArray(raw)) return [];
  const out: SuggestedPrompt[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SUGGESTED_PROMPTS) break;
    if (
      item && typeof item === 'object' &&
      typeof (item as SuggestedPrompt).icon === 'string' &&
      typeof (item as SuggestedPrompt).text === 'string'
    ) {
      out.push({
        icon: (item as SuggestedPrompt).icon.slice(0, MAX_PROMPT_ICON),
        text: (item as SuggestedPrompt).text.slice(0, MAX_PROMPT_TEXT),
      });
    }
  }
  return out;
}

export function parseShopSettings(raw: unknown): ShopSettingsBundle {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const appearance = parseAppearance(obj);
  const accent = DRAWER_ACCENT_PALETTE.includes(obj.drawerAccent as DrawerAccent)
    ? (obj.drawerAccent as DrawerAccent)
    : DEFAULT_SHOP_SETTINGS.drawerAccent;
  const cap = typeof obj.monthlyCapRequests === 'number' &&
    Number.isInteger(obj.monthlyCapRequests) && obj.monthlyCapRequests > 0
    ? obj.monthlyCapRequests
    : null;
  return {
    ...appearance,
    drawerAccent: accent,
    greetingMessage:
      typeof obj.greetingMessage === 'string' && obj.greetingMessage.length > 0
        ? obj.greetingMessage.slice(0, MAX_GREETING)
        : null,
    suggestedPrompts: parsePrompts(obj.suggestedPrompts),
    monthlyCapRequests: cap,
    notificationEmail:
      typeof obj.notificationEmail === 'string' && obj.notificationEmail.includes('@')
        ? obj.notificationEmail
        : null,
    drawerEnabled: obj.drawerEnabled === false ? false : true,
    editorPreviewVisible: obj.editorPreviewVisible === false ? false : true,
  };
}
```

- [ ] **Step 4: Schema** — in `prisma/schema.prisma`:

```prisma
model ShopSettings {
  shop                 String   @id
  activeChatModelId    String?
  emptyStateVariant    String   @default("cards")
  cardDensity          String   @default("standard")
  drawerAccent         String   @default("#5B4FE9")
  greetingMessage      String?  @db.VarChar(200)
  suggestedPrompts     Json     @default("[]")
  monthlyCapRequests   Int?
  notificationEmail    String?
  drawerEnabled        Boolean  @default(true)
  editorPreviewVisible Boolean  @default(true)
  updatedAt            DateTime @updatedAt

  @@map("shop_settings")
}
```

and add to RequestCounter: `adminRequestCount Int @default(0)`.

Migrate: `bunx prisma migrate dev --name shop-settings-page` then `bunx prisma generate`. KNOWN ISSUE: dev DB has pgvector index drift — if `migrate dev` refuses, follow the precedent from migration `20260611000001_shop_settings_appearance`: write the migration SQL by hand into `prisma/migrations/<timestamp>_shop_settings_page/migration.sql` (use `ADD COLUMN IF NOT EXISTS`), apply it with a one-off `bun` script using `prisma.$executeRawUnsafe` statement-by-statement, and INSERT the `_prisma_migrations` row (copy the shape of the existing manual row). NEVER run `prisma migrate reset`.

- [ ] **Step 5: Tests pass + full suite green. Commit** `feat(db): shop settings page columns + admin counter split`

---

### Task 2: getShopSettings resolver

**Files:**
- Create: `services/settings/getShopSettings.ts`
- Test: `services/settings/__tests__/getShopSettings.test.ts`

- [ ] **Step 1: Failing test** — mirror `services/chat/__tests__/getShopAppearance.test.ts` structure (hoisted `findUnique` mock on `@/lib/db/client`):
  - empty shop → `DEFAULT_SHOP_SETTINGS`, no DB call
  - no row → defaults
  - row values flow through `parseShopSettings` (e.g. `drawerAccent: '#008060'`, `suggestedPrompts` array, `drawerEnabled: false` survive; `cardDensity: 'banana'` → 'standard')
  - DB throws → defaults

- [ ] **Step 2: FAIL. Step 3: Implement**

```ts
// services/settings/getShopSettings.ts
// Read path for the full per-shop settings bundle. Same philosophy as
// getShopAppearance (which remains for chat-surface callers): absence or
// error IS the defaults signal; never throws into a render path.
import { prisma } from '@/lib/db/client';
import {
  DEFAULT_SHOP_SETTINGS,
  parseShopSettings,
  type ShopSettingsBundle,
} from '@/lib/settings/contract';

export async function getShopSettings(shop: string): Promise<ShopSettingsBundle> {
  if (!shop) return DEFAULT_SHOP_SETTINGS;
  try {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!row) return DEFAULT_SHOP_SETTINGS;
    return parseShopSettings(row);
  } catch {
    return DEFAULT_SHOP_SETTINGS;
  }
}
```

- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): getShopSettings resolver`

---

### Task 3: PATCH /api/settings/shop

**Files:**
- Modify: `lib/db/repositories/ShopSettingsRepository.ts` (add `upsertFields`)
- Create: `app/api/settings/shop/route.ts`
- Test: `app/api/settings/shop/__tests__/route.test.ts`

- [ ] **Step 1: Failing test** — copy the mock idiom from `app/api/settings/appearance/__tests__/route.test.ts` (withShopifySession passthrough + hoisted repo mock). Cases:
  - valid partial `{ drawerAccent: '#008060' }` → 200 `{ ok: true, settings: <parsed> }`, repo called with `('test.myshopify.com', { drawerAccent: '#008060' })`
  - `{ greetingMessage: '' }` → stored as null (clearing)
  - `{ suggestedPrompts: [{icon:'☕',text:'coffee'}] }` → 200
  - `{ suggestedPrompts: [7 items] }` → 400 invalid_body
  - `{ monthlyCapRequests: 5000 }` (above effective cap 2000) → 400 `{ error: 'cap_above_limit' }`
  - `{ monthlyCapRequests: 500 }` → 200; `{ monthlyCapRequests: null }` → 200 (reset to default)
  - `{ drawerAccent: '#FF0000' }` (off-palette) → 400
  - `{}` → 400; `{ shop: 'evil' , drawerEnabled: false }` → 400 (strict)
  - `{ notificationEmail: 'not-an-email' }` → 400; `{ notificationEmail: null }` → 200

- [ ] **Step 2: FAIL. Step 3: Implement**

```ts
// app/api/settings/shop/route.ts
// PATCH — single write path for the settings-page fields outside model
// selection and chat appearance. Auth/idiom mirrors /api/settings/appearance.
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';
import {
  DRAWER_ACCENT_PALETTE,
  MAX_GREETING,
  MAX_PROMPT_ICON,
  MAX_PROMPT_TEXT,
  MAX_SUGGESTED_PROMPTS,
  parseShopSettings,
} from '@/lib/settings/contract';
import { readEffectiveDefaultCap } from '@/services/chat/CapService';

const Body = z
  .object({
    drawerAccent: z.enum(DRAWER_ACCENT_PALETTE).optional(),
    greetingMessage: z.string().max(MAX_GREETING).nullable().optional(),
    suggestedPrompts: z
      .array(z.object({
        icon: z.string().min(1).max(MAX_PROMPT_ICON),
        text: z.string().min(1).max(MAX_PROMPT_TEXT),
      }).strict())
      .max(MAX_SUGGESTED_PROMPTS)
      .optional(),
    monthlyCapRequests: z.number().int().min(1).nullable().optional(),
    notificationEmail: z.string().email().nullable().optional(),
    drawerEnabled: z.boolean().optional(),
    editorPreviewVisible: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0);

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
  // Lowering-only cap override (spec): merchant may not raise above the
  // operator default while V1 is free.
  if (
    parsed.data.monthlyCapRequests != null &&
    parsed.data.monthlyCapRequests > readEffectiveDefaultCap()
  ) {
    return Response.json({ error: 'cap_above_limit' }, { status: 400 });
  }
  const fields = {
    ...parsed.data,
    // Empty-string greeting means "clear back to built-in copy".
    ...(parsed.data.greetingMessage === '' ? { greetingMessage: null } : {}),
  };
  const row = await shopSettingsRepository.upsertFields(shop, fields);
  return Response.json({ ok: true, settings: parseShopSettings(row) });
});
```

ORDERING NOTE: `readEffectiveDefaultCap` does not exist yet (Task 4 reworks CapService). Add it to `services/chat/CapService.ts` NOW as part of this task — one exported wrapper around the existing private `readCap()`:

```ts
/** Operator default cap (env override or 2000) — the ceiling merchants may lower under. */
export function readEffectiveDefaultCap(): number {
  return readCap();
}
```

Repository addition (generalises the appearance helper — keep `upsertAppearance` delegating to it so existing tests stay green):

```ts
async upsertFields(
  shop: string,
  fields: Record<string, unknown>,
): Promise<ShopSettings> {
  const data = fields as Prisma.ShopSettingsUncheckedUpdateInput;
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, ...(fields as Prisma.ShopSettingsUncheckedCreateInput) },
    update: data,
  });
}
```

(`suggestedPrompts` arrives as a plain array — Prisma Json column accepts it directly. Import `Prisma` types from `@/app/generated/prisma/client`.)

- [ ] **Step 4: PASS. Step 5: Commit** `feat(api): PATCH /api/settings/shop`

---

### Task 4: Cap override + surface-split counting

**Files:**
- Modify: `services/chat/CapService.ts`
- Modify: `lib/db/repositories/RequestCounterRepository.ts`
- Modify: `app/api/chat/route.ts:66` (`tryConsumeRequest(shop, 'admin')`)
- Modify: `app/api/proxy/chat/route.ts:105` (`tryConsumeRequest(shop, 'storefront')`)
- Test: existing CapService/counter tests (find via `grep -rl tryConsume --include='*.test.ts'`) — extend

- [ ] **Step 1: Failing tests** — (a) CapService: when `prisma.shopSettings.findUnique` (mock) returns `{ monthlyCapRequests: 100 }`, `tryConsume` is called with cap 100; null override → env/default path unchanged; settings read failure → default cap (never block chat on a settings outage). (b) Repository: `tryConsume(shop, period, cap, 'admin')` increments `adminRequestCount`; `'storefront'` does not.

- [ ] **Step 2: FAIL. Step 3: Implement.**

CapService — export the default-cap reader (Task 3 imports it) and resolve the override:

```ts
export function readEffectiveDefaultCap(): number {
  return readCap(); // existing env/2000 logic, renamed exposure
}

export type ChatSurface = 'storefront' | 'admin';

export async function tryConsumeRequest(
  shop: string,
  surface: ChatSurface,
): Promise<{ allowed: boolean }> {
  const period = getCurrentPeriod();
  let cap = readCap();
  try {
    const row = await prisma.shopSettings.findUnique({
      where: { shop },
      select: { monthlyCapRequests: true },
    });
    if (row?.monthlyCapRequests != null && row.monthlyCapRequests > 0) {
      cap = Math.min(cap, row.monthlyCapRequests);
    }
  } catch {
    // settings outage must not block chat — fall through with default cap
  }
  const r = await requestCounterRepository.tryConsume(shop, period, cap, surface);
  return { allowed: r.allowed };
}
```

Repository: extend the atomic upsert SQL — admin surface adds `"adminRequestCount" = request_counter."adminRequestCount" + 1` to the DO UPDATE set (and 1 vs 0 in the INSERT values). Read the existing raw SQL carefully; the cap WHERE-clause semantics must not change.

- [ ] **Step 4: All cap/counter/chat-route tests pass (update route tests for the new arg). Step 5: Commit** `feat(chat): per-shop cap override + surface-split counting`

---

### Task 5: GET /api/settings/usage

**Files:**
- Create: `app/api/settings/usage/route.ts`
- Test: `app/api/settings/usage/__tests__/route.test.ts`

- [ ] **Step 1: Failing test** — session-wrapper passthrough mock; prisma `requestCounter.findUnique` mock + `shopSettings.findUnique` mock. Returns:

```json
{ "used": 1284, "adminUsed": 182, "storefrontUsed": 1102, "cap": 2000,
  "periodLabel": "June 2026", "resetsAt": "2026-07-01T00:00:00.000Z" }
```

No counter row → zeros. Cap reflects override when set.

- [ ] **Step 2: FAIL. Step 3: Implement** — `getCurrentPeriod()` for the key; `periodLabel` via `new Date(period + '-01T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })`; `resetsAt` = first instant of next month UTC; `storefrontUsed = requestCount − adminRequestCount`; cap = `min(readEffectiveDefaultCap(), override ?? ∞)`.

- [ ] **Step 4: PASS. Step 5: Commit** `feat(api): usage endpoint for settings page`

---

### Task 6: Drawer meta extension + EmptyChat custom greeting/prompts

**Files:**
- Modify: `app/api/proxy/_meta/appearance/route.ts` (return full storefront bundle)
- Modify: `lib/chat-ui/components/empty-chat.tsx` (props `greeting?: string | null`, `prompts?: SuggestedPrompt[] | null`)
- Modify: `extensions-src/chat-drawer/components/DrawerBody.tsx` + `StorefrontDrawer.tsx` (apply accent var, greeting, prompts; hide on `drawerEnabled: false`; designMode + `editorPreviewVisible: false` → hide)
- Tests: proxy route test, `lib/chat-ui/__tests__/empty-chat.test.tsx`, `extensions-src/chat-drawer/__tests__/drawer-body.test.tsx`

- [ ] **Step 1: Failing tests** —
  - proxy route returns the full bundle (mock `getShopSettings` → assert passthrough of drawerAccent/greetingMessage/suggestedPrompts/drawerEnabled/editorPreviewVisible alongside the appearance pair).
  - EmptyChat: `greeting` overrides the cards-variant headline (and the minimal-variant heading); `prompts` (non-empty) replace `SUGGESTED_PROMPTS`; null/empty fall back to built-ins.
  - DrawerBody: fetched accent lands as `--sd-accent` style on the pane wrapper; `drawerEnabled: false` → renders null AND notifies parent (new optional `onDisabled?: () => void` so StorefrontDrawer can hide the FAB); greeting/prompts threaded into ChatPane.
- [ ] **Step 2: FAIL. Step 3: Implement.** Proxy route swaps `getShopAppearance` for `getShopSettings`, returns the whole parsed bundle (it contains nothing secret — presentation + flags only; notificationEmail and monthlyCapRequests MUST be stripped: build the response object explicitly, never spread). ChatPane gains pass-through props `greeting?`/`prompts?` → EmptyChat. designMode detection in the drawer: `window.Shopify?.designMode === true`.
- [ ] **Step 4: PASS + `bun run build:storefront-bundle` exit 0. Step 5: Commit** `feat(drawer): honor accent, greeting, prompts, and kill-switch`

---

### Task 7: Notification email override in sync emails

**Files:**
- Modify: `inngest/functions/sync-products.ts` (both `contactEmail` sites)
- Test: extend the function's existing test file (find via `grep -rl "fetchShopContactEmail" --include='*.test.ts'`)

- [ ] **Step 1: Failing test** — settings row with `notificationEmail: 'ops@x.com'` → email sent to it, `fetchShopContactEmail` NOT called; null override → existing behavior.
- [ ] **Step 2: FAIL. Step 3: Implement** — at both sites:

```ts
const settings = await getShopSettings(shop);
const contactEmail = settings.notificationEmail ?? (await fetchShopContactEmail(session));
```

- [ ] **Step 4: PASS. Step 5: Commit** `feat(sync): notification email override`

---

### Task 8: Settings page shell — side nav + SSR data

**Files:**
- Modify: `app/(embedded)/settings/page.tsx` (rewrite)
- Create: `app/(embedded)/settings/settings-shell.tsx` (client side-nav)
- Create: `app/(embedded)/settings/sections/types.ts` (shared section prop types)
- Test: `app/(embedded)/settings/__tests__/page.test.tsx` (rewrite), new `settings-shell.test.tsx`

- [ ] **Step 1: Failing tests** — page: SSR loads in parallel `fetchModelCatalog`, `getActiveChatModel`, `getShopSettings`, webhook last-fired (`prisma.webhookEvent.groupBy({ by: ['topic'], where: { shop }, _max: { receivedAt: true } })`), last success (`prisma.syncRun.findFirst({ where: { shop, state: 'succeeded' }, orderBy: { finishedAt: 'desc' } })`), usage snapshot (reuse the same queries as Task 5 via a small shared helper `services/settings/getUsageSnapshot.ts` — create it here, route from Task 5 refactors to call it); WR-01 shop validation retained. Shell: renders "Settings" heading + 5 nav items; clicking switches the visible section; active item carries accent classes.
- [ ] **Step 2: FAIL. Step 3: Implement** — page.tsx assembles `{ catalog, activeModel, settings, usage, webhooks, lastSync, shop }` and renders `<SettingsShell …/>`. Shell: prototype layout (`max-w-[1080px] mx-auto grid grid-cols-[200px_1fr] gap-7 px-7 pt-7 pb-20`), nav buttons per prototype lines 17–38, `SettingsIcon` ported (sparkle/paint/gauge/sync/gear), section components stubbed as placeholders rendering their headings (filled in Tasks 9–13). Old `settings-form.tsx` stays until Task 9 replaces its usage; do NOT delete yet.
- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): side-nav shell with SSR data plumbing`

---

### Task 9: AI model section

**Files:**
- Create: `app/(embedded)/settings/sections/model-section.tsx`
- Delete (after port): `app/(embedded)/settings/settings-form.tsx` + its test
- Test: `app/(embedded)/settings/__tests__/model-section.test.tsx`

- [ ] **Step 1: Failing test** — renders a radio card per catalog model (name, "by {provider}", bestFor, `$X.XX in · $Y.YY out`, context label `1M`/`128K` per prototype line 147 logic); "Recommended" badge only on the DEFAULT_MODEL id; clicking a card selects it (aria-checked); Save calls PATCH `/api/settings/model` with Bearer token and shows "Currently active: {name}" after success; failure shows the error code inline. Port the fetch/idToken mock idiom from the old settings-form test before deleting it.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype `ModelSection` (lines 66–183): provider tile colors map (Google `#fef3e2/#d97706` "G", OpenAI `#dcfce7/#15803d` "A", Anthropic `#fef0e6/#c2410c` "C", Meta `#dbeafe/#1d4ed8` "M", fallback grey + first letter), selected card `border-[var(--sd-accent)] + ring shadow`, footer info note verbatim, dark Save button. The appearance radios DO NOT live here (they move to Drawer styling, Task 10) — delete `settings-form.tsx` and its test once all its behavior is reproduced (model save in this task; appearance save in Task 10).
- [ ] **Step 4: PASS; old form file deleted; suite green. Step 5: Commit** `feat(settings): model section radio cards`

---

### Task 10: Drawer styling section

**Files:**
- Create: `app/(embedded)/settings/sections/drawer-section.tsx`
- Test: `app/(embedded)/settings/__tests__/drawer-section.test.tsx`

- [ ] **Step 1: Failing test** — accent swatches render 5 palette colors, selected has the dark ring, click + Save PATCHes `/api/settings/shop` `{ drawerAccent }`; greeting input prefilled from settings (placeholder = built-in copy when null), save sends `{ greetingMessage }` (empty → `''` which the route nulls); prompts editor lists current prompts, delete removes, add appends (icon + text inputs), 6 disables add, save sends the full array; empty-state + density radio groups present and save to `/api/settings/appearance` (port assertions from the deleted settings-form test).
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype `DrawerSection` (lines 185–241) + `SettingsCard` (368–383) + `inputStyle`. One section-level "Save changes" for the `/api/settings/shop` fields; appearance radios keep their own save (different endpoint). Prompt edit = inline text inputs (pencil toggles edit mode); icon field is a short text input (emoji).
- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): drawer styling section`

---

### Task 11: Usage & limits section

**Files:**
- Create: `app/(embedded)/settings/sections/limits-section.tsx`
- Test: `app/(embedded)/settings/__tests__/limits-section.test.tsx`

- [ ] **Step 1: Failing test** — given usage `{ used: 1284, cap: 2000, adminUsed: 182, storefrontUsed: 1102, periodLabel, resetsAt }`: renders `1,284`, "of 2,000 chat requests", "64% used" in accent; given used 1800 → "90% used" with `#bf4800` class and bar color shift; Storefront/Admin stats; cap input prefilled, Save PATCHes `/api/settings/shop` `{ monthlyCapRequests }`, server `cap_above_limit` error shows inline message.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype `LimitsSection` (243–290) + `Stat` (385–394); "resets in N days" computed from `resetsAt`. Usage data arrives as SSR prop (no client fetch needed V1).
- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): usage and limits section`

---

### Task 12: Sync & webhooks section

**Files:**
- Create: `app/(embedded)/settings/sections/webhooks-section.tsx`
- Test: `app/(embedded)/settings/__tests__/webhooks-section.test.tsx`

- [ ] **Step 1: Failing test** — four topic rows (`products/create|update|delete`, `app/uninstalled`) monospace with green dot; last-fired renders relative time from the SSR map ("—" when absent); "Run full resync" POSTs `/api/shopify/sync` with Bearer token, button shows running state and "Sync queued" confirmation; last-success line renders when present ("Last successful sync: {date}, {time} · {N} products · {duration}") and is absent otherwise.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype `WebhooksSection` (292–339). Relative time helper: minutes/hours/days ("2m ago", "3h ago", "5d ago") — small local function, no dependency. Duration = `finishedAt − startedAt` formatted `Xm Ys`.
- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): sync and webhooks section`

---

### Task 13: General section

**Files:**
- Create: `app/(embedded)/settings/sections/general-section.tsx`
- Create: `app/(embedded)/settings/sections/toggle.tsx` (ported prototype Toggle)
- Test: `app/(embedded)/settings/__tests__/general-section.test.tsx`

- [ ] **Step 1: Failing test** — email input prefilled (placeholder "Shop contact email" when null), save sends `{ notificationEmail }` (empty input → null); "Enable on storefront" toggle reflects `drawerEnabled` and PATCHes immediately on flip (optimistic, like the chat-header density control); "Show in Theme Editor preview" likewise for `editorPreviewVisible`; toggle is a `role="switch"` button with `aria-checked`.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype `GeneralSection` (341–366) + `Toggle` (396–414, add the switch ARIA).
- [ ] **Step 4: PASS. Step 5: Commit** `feat(settings): general section`

---

### Task 14: Verification sweep + final review

- [ ] `bun run test` green; `bunx eslint` clean on all changed files; `bunx tsc --noEmit` no NEW errors; `bun run build` + `bun run build:storefront-bundle` succeed.
- [ ] Manual: side nav switches sections; model save; accent/greeting/prompt save reflected in storefront drawer (and accent in admin chat? — accent var currently hardcoded in chat-shell: out of scope, drawer only); usage numbers real; resync runs (needs Inngest dev server); toggles persist across reload; drawer disappears from storefront when disabled.
- [ ] Final integration review subagent over the whole branch (seams: settings → DB → SSR/page, → proxy meta → drawer; cap override → CapService → both chat routes; counter split arithmetic; no secrets in storefront bundle; multi-tenancy on every new query).
