# UI Strategy: Polaris Web Components vs Custom Design

**Date:** 2026-06-10
**Status:** Approved
**Decision:** Approach A — split by surface role. Polaris owns admin chrome; custom design owns product surfaces.

## Context

The app has three UI surfaces with different audiences:

1. **Embedded admin pages** (`app/(embedded)/onboarding`, `app/(embedded)/settings`) — merchant-facing, rendered inside Shopify admin. Currently built with Polaris web components (`<s-page>`, `<s-section>`, `<s-banner>`, `<s-button>`), loaded via CDN scripts (`app-bridge.js`, `polaris.js`) in `app/(embedded)/layout.tsx` and typed by `@shopify/polaris-types`.
2. **Admin chat page** (`app/(embedded)/chat`) — merchant-facing product experience. Built with Tailwind 4 + shadcn-style primitives.
3. **Storefront chat drawer** (`extensions/chat-drawer`) — customer-facing Theme App Extension with its own assets.

A custom design system exists (built during design sessions in Claude Code) covering the admin chat page, the storefront drawer, and parts of the embedded admin pages. The question was whether to keep Polaris, replace it with the custom design, or combine both.

## Decision

**Rule: Polaris owns admin chrome, custom design owns product surfaces.**

| Surface | Shell | Content |
|---|---|---|
| Onboarding, settings, future sync-status/billing pages | Polaris `s-*` | Polaris by default; custom design only for illustrations, empty states, and decorative content |
| Admin chat page | Optional bare `<s-page>` wrapper for consistent header/max-width | Custom design (Tailwind/shadcn) |
| Storefront drawer | None | Custom design only — Polaris must never load on the storefront |
| Marketing landing | None | Custom design (already pixel-faithful to `docs/design/landing/`) |

### Rationale

- **Native admin feel earns merchant trust.** Settings and onboarding are "admin tasks"; merchants expect them to look like the rest of Shopify admin. Polaris provides this plus free dark mode, accessibility, and App Bridge integration (toasts, modals, navigation). It also smooths app review and Built for Shopify eligibility.
- **Differentiation belongs in the product surfaces.** The chat page and storefront drawer are where the app's identity lives; the custom design applies there without restriction.
- **Full custom everywhere (rejected)** would mean rebuilding banners, toasts, loading states, dark mode, and accessibility that Polaris gives for free, and the app would look alien inside Shopify admin.
- **Full Polaris in admin (rejected)** would discard the custom design on the chat page, defeating its purpose.

## Mixing Mechanics

When a Polaris-shelled page needs custom content:

- Use `<s-page>` / `<s-section>` as the structural shell; place Tailwind-styled content inside as light-DOM children. Polaris web components slot their children, so Tailwind classes apply normally.
- Do **not** restyle the internals of Polaris components (e.g. `s-button` internals live in shadow DOM and use Polaris tokens). Per context, pick either `s-button` or the shadcn `Button` — never a hybrid.
- The Polaris CDN scripts load only in `app/(embedded)/layout.tsx`; they must never be added to the storefront drawer or landing page.

## Testing

- Polaris web components don't render in jsdom; keep the existing `container.querySelector('s-page')`-style assertions for `s-*` tags (see `app/(embedded)/__tests__/onboarding.test.tsx`).
- Custom (shadcn/Tailwind) components are tested normally via Testing Library queries.

## Impact on Existing Code

No migration required. Existing surfaces already comply:

- Onboarding and settings keep their `s-*` markup.
- Chat page keeps Tailwind/shadcn; adding a bare `<s-page>` wrapper is optional polish, not required.
- Drawer and landing remain fully custom.

This document is the reference for future admin pages: start from the table above when choosing components.
