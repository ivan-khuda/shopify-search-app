# Landing Page Tailwind Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all `components/landing/` components from inline `style={{...}}` objects to Tailwind CSS 4 utility classes with zero visual change, shrinking `landing.css` to only what CSS must own (vars, keyframes, reveal pattern, focus-visible).

**Architecture:** Tailwind 4 is already active on the landing route (root layout imports `app/globals.css` which has `@import "tailwindcss"`). The landing keeps its `.sd-landing`-scoped CSS custom properties as the design-token source; utilities reference them via Tailwind 4's parenthesis shorthand (`bg-(--accent)`, `text-(--text-strong)`, `border-(--border)`). Exact pixel fidelity is non-negotiable: use arbitrary values (`px-[18px]`, `text-[14.5px]`, `rounded-[11px]`) — never snap to the nearest Tailwind scale step. The existing test suites are behavioral (text/hrefs/anchors) and MUST pass unchanged — they are the regression net; do not modify any test file in this plan.

**Tech Stack:** Tailwind CSS 4 (`@tailwindcss/postcss`), `cn()` from `lib/utils.ts` (clsx + tailwind-merge) for conditional classes, existing vitest suites.

---

## Conversion Conventions (binding for every task)

**What converts to Tailwind classes:**
1. Every static inline style → utility classes with arbitrary values preserving exact values: `style={{ padding: '11px 18px', borderRadius: 11 }}` → `className="px-[18px] py-[11px] rounded-[11px]"`.
2. Token references: `var(--accent)` → `(--accent)` shorthand: `bg-(--accent)`, `text-(--text-sub)`, `border-(--border-sub)`. NEVER hard-code hex where a var exists.
3. `rgba(ACCENT, 0.12)`-style computed tints → opacity modifier on the var: `bg-(--accent)/12`. (Tailwind 4 resolves var colors through color-mix; verify visually identical — if a modifier renders wrong in a given property, fall back to literal `bg-[rgba(91,79,233,0.12)]` with a `/* rgba(accent,.12) */` comment.)
4. `shade(ACCENT, n)` computed colors (accent is a fixed constant) → precompute the literal hex once, put it in `landing.css` as a var with a comment showing the formula (e.g. `--accent-46d: #18153f; /* shade(#5B4FE9,-46) */`), reference via shorthand. Compute values by running `node -e` against `components/landing/tokens.ts` logic — do not guess hex values.
5. Spaces in arbitrary values become underscores: `shadow-[0_8px_22px_-8px_rgba(91,79,233,0.7)]`, `bg-[linear-gradient(180deg,#fbfaf8_0%,#f6f6f7_100%)]`, `text-[clamp(38px,5.2vw,62px)]`, `[animation:sd-pop_0.4s_cubic-bezier(.2,.7,.2,1)_both]`.
6. Hover effects currently done with `onMouseEnter`/`onMouseLeave` style mutation → replace with `hover:` utilities and DELETE the handlers: CTA lift → `transition-[transform,box-shadow,background] duration-[120ms] hover:-translate-y-px`; nav link bg → `hover:bg-black/[.04]`; footer link → `hover:text-white`.
7. State-conditional styles with enumerable states → conditional classes via `cn()` from `@/lib/utils`: e.g. composer border `cn('rounded-xl border bg-white transition-colors', typing ? 'border-(--accent) shadow-[0_0_0_3px_rgba(91,79,233,0.12)]' : 'border-(--border)')`.
8. `.tnum` class → Tailwind's `tabular-nums` utility (then delete `.tnum` from landing.css). `.serif` class → `font-(family-name:--font-dm-serif) font-normal` (then delete `.serif`).
9. Responsive helper classes (`hero-grid`, `how-grid`, `feat-grid`, `quote-grid`, `price-grid`, `show-grid`, `foot-grid`, `nav-links`, `nav-signin`) → inline max-width variants, then DELETE the media-query blocks from landing.css:
   - grids: `max-[920px]:grid-cols-1` (foot-grid: `max-[920px]:grid-cols-2 max-[560px]:grid-cols-1`)
   - `nav-links`: `max-[920px]:hidden`; `nav-signin`: `max-[560px]:hidden`

**What stays as inline `style` (the ONLY permitted cases):**
- Values computed from runtime props: `SDLogo` size math (`width: size`, `borderRadius: size * 0.28`, gradient from `accent` prop), `MiniProduct`/section card `animationDelay: ${i * 0.09}s` (keep delay inline; the animation itself becomes a class).
- Values from component props that vary per call site where a class can't express it.

**What stays in `landing.css` (final contents after Task 5):**
- `.sd-landing` CSS custom properties block (+ the new precomputed shade vars)
- font-family/font-feature base on `.sd-landing` (font-feature-settings "cv11","ss01" has no utility)
- the five `@keyframes sd-*`
- `.reveal` / `.reveal.in` + `prefers-reduced-motion` override
- `:focus-visible` rule
- box-sizing/button/anchor resets
- NOTHING else (no media queries, no `.tnum`/`.serif`, no grid helpers)

**Per-task verification (every task):**
1. `bunx vitest run components/landing/__tests__/` → all pass, test files untouched (`git diff --stat` must show no `__tests__` changes).
2. `bunx eslint <changed files>` → clean.
3. Fidelity self-check: for each converted element, diff your class list against the original inline object (use `git show HEAD:components/landing/<file>` for the original) — every property accounted for, no value drift.
4. `grep -n "style={{" <file>` — each remaining hit must match a permitted case; list them in your report with justification.

---

## File Structure

No new components. Files modified per task:
- Task 1: `components/landing/landing.css`, `components/landing/brand.tsx`, `CLAUDE.md`
- Task 2: `components/landing/chat-demo.tsx`
- Task 3: `components/landing/hero.tsx`, `components/landing/nav.tsx`
- Task 4: `components/landing/sections.tsx`
- Task 5: `components/landing/sections-lower.tsx`, `components/landing/landing.css` (final slim-down), `components/landing/tokens.ts` (drop now-unused helpers if any)

Order matters: Task 1 establishes the precomputed shade vars and conventions the rest consume. Tasks 2–5 each convert one file and can verify independently. landing.css media-query/utility deletions happen ONLY in Task 5 (after the last consumer converts), so the page is never broken mid-plan.

---

### Task 1: Conventions foundation — shade vars, brand.tsx, CLAUDE.md

**Files:**
- Modify: `components/landing/landing.css`
- Modify: `components/landing/brand.tsx`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Inventory shade()/rgba() usages and precompute**

Run:
```bash
grep -rn "shade(\|rgba(" components/landing/*.tsx | grep -v "rgba(" --include=never; grep -rn "shade(ACCENT\|shade(accent" components/landing/*.tsx
```
For every `shade(<hex>, n)` call on a constant, compute the literal:
```bash
node -e "$(sed -n '/export function shade/,/^}/p' components/landing/tokens.ts | sed 's/export //'); console.log(shade('#5B4FE9', -46))"
```
Add each as a var in the `.sd-landing` block of `landing.css` with the formula comment (names: `--accent-d18`, `--accent-d46`, `--accent-l55`, etc. — match actual usages found).

- [ ] **Step 2: Convert brand.tsx**

`ShopifyMark`: fully static except `size`/`color` props → svg keeps `width={size} height={size} fill={color}` as props (permitted), no style object exists — likely no change.
`SDLogo`: size-math styles stay inline (permitted case); convert only the static parts (`display:inline-flex` etc.) to classes where separable. If everything is size/accent-derived, leave as-is and note it.

- [ ] **Step 3: Update CLAUDE.md**

Replace the styling note's exception sentence:
```
Exception: the marketing landing page (`components/landing/`) intentionally uses inline styles + `landing.css` to stay pixel-faithful to its design handoff — don't convert it to Tailwind.
```
with:
```
The marketing landing page (`components/landing/`) uses Tailwind utilities with arbitrary values to stay pixel-faithful to its design handoff (`docs/design/landing/`); its design tokens live as CSS vars in `components/landing/landing.css`.
```

- [ ] **Step 4: Verify**

`bunx vitest run components/landing/__tests__/foundation.test.tsx` → pass. `bunx eslint components/landing/brand.tsx` → clean.

- [ ] **Step 5: Commit**

```bash
git add components/landing/ CLAUDE.md
git commit -m "refactor(landing): precompute shade vars, prep Tailwind conversion conventions"
```

---

### Task 2: Convert chat-demo.tsx

**Files:**
- Modify: `components/landing/chat-demo.tsx`

- [ ] **Step 1: Convert every element per the conventions**

High-attention spots:
- Outer card: `rounded-[18px] border border-(--border) shadow-[0_1px_1px_rgba(0,0,0,0.04),0_18px_50px_-12px_rgba(26,29,33,0.22)]` etc.
- Conversation body gradient: `bg-[linear-gradient(180deg,#fcfcfd,#fafbfb)]`.
- Bubbles: asymmetric radii → `rounded-[14px_14px_4px_14px]` (arbitrary border-radius shorthand) or the four corner utilities (`rounded-tl-[14px] rounded-tr-[14px] rounded-br-[4px] rounded-bl-[14px]`) — pick ONE form and use it for both bubbles.
- Spinner: `[animation:sd-spin_0.7s_linear_infinite]`, caret: `[animation:sd-blink_1s_step-end_infinite]`.
- MiniProduct pop: class `[animation:sd-pop_0.4s_cubic-bezier(.2,.7,.2,1)_both]` + `style={{ animationDelay: \`${i * 0.09}s\` }}` (delay stays inline — per-index).
- Composer focus ring: conditional via `cn()` on `phase === 'typing'` (convention 7).
- Status dot: `shadow-[0_0_0_3px_rgba(0,128,96,0.16)]`.

- [ ] **Step 2: Verify per-task protocol** (tests, eslint, fidelity diff vs `git show HEAD:components/landing/chat-demo.tsx`, justified `style={{` survivors)

`bunx vitest run components/landing/__tests__/chat-demo.test.tsx` → 3/3.

- [ ] **Step 3: Commit**

```bash
git add components/landing/chat-demo.tsx
git commit -m "refactor(landing): convert ChatDemo to Tailwind utilities"
```

---

### Task 3: Convert hero.tsx + nav.tsx

**Files:**
- Modify: `components/landing/hero.tsx`
- Modify: `components/landing/nav.tsx`

- [ ] **Step 1: Convert hero.tsx**

High-attention spots:
- `CTAButton`: kinds become class maps; hover handlers DELETED in favor of `hover:-translate-y-px`; `large` prop toggles `px-[22px] py-[13px] text-[15px]` vs `px-[18px] py-[11px] text-sm`; primary shadow `shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_22px_-8px_rgba(91,79,233,0.7)]`; keep `<a>`/`<button>` dual render with shared classes.
- Headline: `text-[clamp(38px,5.2vw,62px)] leading-[1.04] tracking-[-0.03em] font-bold`.
- Hero grid: `grid grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] max-[920px]:grid-cols-1 gap-[clamp(36px,5vw,72px)] items-center` — replaces the `hero-grid` helper class (KEEP the helper class name in the markup until Task 5 removes the CSS, or remove now and rely on the inline variant — remove now; the inline `max-[920px]:` variant fully covers it).
- Section gradient bg: `bg-[linear-gradient(180deg,#fbfaf8_0%,#f6f6f7_100%)]`.
- Eyebrow pills: `rounded-full` + `/10`, `/20` accent tints (convention 3).
- ChatDemo column: `h-[min(560px,74vh)] min-h-[440px]`.

- [ ] **Step 2: Convert nav.tsx**

- Sticky header: conditional via `cn()` on `solid`: `bg-white/[.82] backdrop-blur-[14px] backdrop-saturate-[160%] border-b border-(--border-sub)` vs transparent; `transition-[background,border-color] duration-[250ms]`.
- `nav-links` → `max-[920px]:hidden`; `nav-signin` → `max-[560px]:hidden`; link hover → `hover:bg-black/[.04]` (delete handlers).

- [ ] **Step 3: Verify protocol**

`bunx vitest run components/landing/__tests__/hero-nav.test.tsx` → 3/3 (file untouched).

- [ ] **Step 4: Commit**

```bash
git add components/landing/hero.tsx components/landing/nav.tsx
git commit -m "refactor(landing): convert hero and nav to Tailwind utilities"
```

---

### Task 4: Convert sections.tsx

**Files:**
- Modify: `components/landing/sections.tsx`

- [ ] **Step 1: Convert** (SectionLabel, LogoStrip, HowItWorks, ProductCard, Showcase, Features)

High-attention spots:
- Grids: `grid-cols-3 max-[920px]:grid-cols-1` with `gap-[clamp(16px,2vw,26px)]` (per-section values from source).
- Step icon tiles: `bg-(--accent)/12`; step numbers `text-(--accent)/22`-equivalent — careful: source is `rgba(accent, 0.22)` on TEXT color → `text-(--accent)/[.22]` or literal fallback.
- ProductCard: `aspect-[4/3]`, heart badge `absolute top-[10px] right-[10px] size-[30px] rounded-full bg-white/90 grid place-items-center`.
- Showcase pill: `w-fit shadow-[0_10px_30px_-16px_rgba(0,0,0,0.25)]`.
- `reveal` class and per-index `animationDelay` style stay (observer pattern unchanged).
- `id="how"` / `id="features"` anchors unchanged.

- [ ] **Step 2: Verify protocol**

`bunx vitest run components/landing/__tests__/sections.test.tsx` → 8/8.

- [ ] **Step 3: Commit**

```bash
git add components/landing/sections.tsx
git commit -m "refactor(landing): convert top sections to Tailwind utilities"
```

---

### Task 5: Convert sections-lower.tsx + slim landing.css + cleanup

**Files:**
- Modify: `components/landing/sections-lower.tsx`
- Modify: `components/landing/landing.css`
- Modify: `components/landing/tokens.ts` (only if helpers became unused)

- [ ] **Step 1: Convert sections-lower.tsx**

High-attention spots:
- Pricing highlight tier: `border-2 border-(--accent) bg-(--accent)/[.035] shadow-[0_24px_60px_-28px_rgba(91,79,233,0.55)]`; badge `absolute -top-3 left-7 rounded-full uppercase`.
- FAQ panel: keep `maxHeight` animation — `cn('overflow-hidden transition-[max-height] duration-300 ease-in-out', open ? 'max-h-[320px]' : 'max-h-0')`; chevron rotate `cn('transition-transform duration-200', open && 'rotate-45')`.
- FinalCTA radial gradient + grid texture + mask: gradient/texture as arbitrary bg classes; `maskImage`/`WebkitMaskImage` have no clean utility — these two properties MAY stay inline (add to permitted list with comment).
- Footer: `grid-cols-[1.6fr_repeat(3,1fr)] max-[920px]:grid-cols-2 max-[560px]:grid-cols-1`; link hover → `hover:text-white` (delete handlers).
- Testimonial avatar initials circle: `bg-(--accent)/14` equivalent.

- [ ] **Step 2: Slim landing.css**

Delete (now fully replaced by utilities): `.tnum`, `.serif`, both `@media (max-width:...)` blocks. Keep: vars (incl. new shade vars), base font/feature-settings, resets, keyframes, `.reveal` rules + reduced-motion, focus-visible. Confirm no component references deleted classes: `grep -rn "tnum\|serif\|hero-grid\|how-grid\|feat-grid\|quote-grid\|price-grid\|show-grid\|foot-grid\|nav-links\|nav-signin" components/landing/ app/page.tsx` → zero hits.

- [ ] **Step 3: tokens.ts cleanup**

`grep -rn "shade(\|rgba(" components/landing/ app/page.tsx` — if `shade`/`rgba` retain consumers (SDLogo likely keeps both), keep them; remove only if zero consumers. Foundation test asserts their behavior — if removing, update that test too (ONLY allowed test change, and only deletions of tests for deleted functions).

- [ ] **Step 4: Full verification**

- `bunx vitest run components/landing/__tests__/ app/__tests__/page.test.tsx` → all pass (26+2).
- `bun run test` → 0 failed.
- `bunx eslint components/landing/` → clean.
- `grep -rn "onMouseEnter\|onMouseLeave" components/landing/` → zero hits (all hover via CSS now).
- `grep -c "style={{" components/landing/*.tsx` → report counts; each survivor justified (SDLogo size math, animationDelay, mask props).

- [ ] **Step 5: Commit**

```bash
git add components/landing/
git commit -m "refactor(landing): convert lower sections to Tailwind; slim landing.css to vars+keyframes"
```

---

## Self-Review

- **Spec coverage:** all 7 landing component files addressed (brand T1, chat-demo T2, hero+nav T3, sections T4, sections-lower T5); landing.css transformation split safely (additive T1, destructive T5 after last consumer converts); CLAUDE.md exception updated T1; app/page.tsx needs no change (no inline styles there).
- **Placeholder scan:** every task lists concrete high-attention conversions with exact target classes; conventions section is the complete decision table; no TBDs.
- **Type consistency:** `cn()` import path `@/lib/utils` (exists — used by components/ui); var names introduced in T1 are referenced in T3/T5 spots; permitted-inline list consistent across tasks.
- **Risk noted:** `bg-(--accent)/12` opacity-modifier-on-var behavior must be visually verified once in Task 1 era; fallback rule (convention 3) covers failure.
