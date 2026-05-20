# Onboarding migration to Shopify App Home (Polaris web components)

**Status:** Draft for review
**Date:** 2026-05-20

## Goal

Migrate the embedded onboarding page from Polaris React (`@shopify/polaris`) to Shopify's App Home pattern: Polaris web components and App Bridge loaded from Shopify's CDN, with the "Start sync" action authenticated via App Bridge session tokens. As a side effect, remove the Polaris React dependency entirely (chat does not use it).

## Non-goals

- Migrating the chat page (`app/(embedded)/chat`) to web components.
- Enabling direct Admin GraphQL access from the client (`embedded_app_direct_api_access`). Sync stays a backend-orchestrated operation.
- Replacing the App Bridge React `<NavMenu>` with the `<ui-nav-menu>` web component.
- Implementing real product sync logic. The sync route remains a stub that proves the auth path; replacing the stub is a separate task.

## Background

Today's embedded layout:

- `app/(embedded)/layout.tsx` injects `<meta name="shopify-api-key">` so App Bridge can initialize.
- `app/(embedded)/EmbeddedProviders.tsx` wraps children in Polaris React's `AppProvider`, imports Polaris CSS, and renders App Bridge React's `<NavMenu>`.
- `app/(embedded)/onboarding/page.tsx` renders a two-column Polaris React layout with a "Start sync" button that does a credential-less `fetch('/api/shopify/sync')`.
- `app/api/shopify/sync/route.ts` is a stub: it hardcodes the shop (`segal-jewellery.myshopify.com`), loads the offline session from Prisma, and runs a single REST call against one product id.
- `middleware.ts` partially decodes `Authorization: Bearer` tokens via `shopifyClient.session.decodeSessionToken` but the route matcher is commented out, so it does not gate anything.

The Shopify App Home pattern (per `https://shopify.dev/docs/api/app-home`) is:

1. Load `polaris.js` and `app-bridge.js` from `cdn.shopify.com/shopifycloud/...` in `<head>`.
2. Use Polaris web components (`<s-page>`, `<s-section>`, `<s-button>`, ...) for UI.
3. Use the App Bridge global `shopify` for APIs (`shopify.idToken()`, `shopify.toast.show(...)`).
4. Authenticate backend calls by sending the session JWT as `Authorization: Bearer <token>`.

## Design

### File changes

| File | Change |
|------|--------|
| `app/(embedded)/layout.tsx` | Extend `metadata.other` to include script tags for `polaris.js` (with `data-api-key`) and `app-bridge.js`. Keep the existing `shopify-api-key` meta. |
| `app/(embedded)/EmbeddedProviders.tsx` | Remove `PolarisProvider` and `import '@shopify/polaris/build/esm/styles.css'`. File becomes a thin wrapper around `<NavMenu>` + children. |
| `app/(embedded)/onboarding/page.tsx` | Rewrite using `<s-page>`, `<s-section>`, `<s-paragraph>`, `<s-unordered-list>`, `<s-list-item>`, `<s-button>`. Sync handler calls `await shopify.idToken()` and sends `Authorization: Bearer <token>` to `/api/shopify/sync`. Uses `shopify.toast.show` for success/error feedback. |
| `app/(embedded)/__tests__/onboarding.test.tsx` | Drop the Polaris `AppProvider` wrapper and the `vi.mock('@shopify/polaris', ...)` block. Stub `globalThis.shopify` with `idToken` and `toast.show`. Assert behavior on click, success, and 401. |
| `app/api/shopify/sync/route.ts` | Require `Authorization: Bearer <token>`. Verify via `shopifyClient.session.decodeSessionToken`. Derive shop from `payload.dest`. Load offline session via `sessionStorage.loadSession(shopifyClient.session.getOfflineId(shop))`. Return 401 on missing/invalid token or missing offline session. Keep the existing stub REST call as the "work" for now. |
| `app/api/shopify/sync/__tests__/route.test.ts` | **New.** Cover missing token, invalid token, valid token + missing session, and happy path. Mock `@/lib/shopify/client` and `@/lib/shopify/session-storage`. |
| `types/shopify.d.ts` | **New.** Ambient declaration for the global `shopify` object (use `@shopify/app-bridge-types` types if they re-export a usable type; otherwise declare the surface this app touches: `idToken()` and `toast.show(message, options?)`). |
| `package.json` | Remove `@shopify/polaris`. Add `@shopify/polaris-types@latest` and `@shopify/app-bridge-types@latest` as devDependencies. |

No changes to `shopify.app.toml`, `middleware.ts`, or any other files.

### Components and responsibilities

- **Embedded layout** (`app/(embedded)/layout.tsx`): Sole entry point for loading Shopify's runtime (App Bridge + Polaris web components). Owns the script tags so every embedded page gets them.
- **EmbeddedProviders** (`app/(embedded)/EmbeddedProviders.tsx`): Renders the cross-frame nav menu only. With Polaris React gone, this file is small enough that we could inline it into the layout; we keep the wrapper to preserve the navigation contract and avoid touching unrelated files.
- **Onboarding page** (`app/(embedded)/onboarding/page.tsx`): Static informational content plus a single side-effecting action. No client-side data fetch on mount.
- **Sync API route** (`app/api/shopify/sync/route.ts`): Verifies session token, resolves shop, loads offline session, and executes sync work. Pure backend; no UI concerns.

### Data flow

**Page load:**

1. Merchant opens the embedded app at `/onboarding` inside the Shopify admin iframe.
2. The embedded layout injects the API-key meta plus the Polaris and App Bridge CDN script tags into `<head>`.
3. App Bridge boots, exposes `globalThis.shopify`.
4. React hydrates. `EmbeddedProviders` renders `<NavMenu>`. The page renders Polaris web components.

**Sync action:**

1. User clicks `<s-button>` "Start sync".
2. Client handler: `const token = await shopify.idToken()`.
3. Client: `fetch('/api/shopify/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })`.
4. Server:
   - Read `Authorization` header. Missing → `401 { error: 'missing_token' }`.
   - `await shopifyClient.session.decodeSessionToken(token)`. Throw → `401 { error: 'invalid_token' }`.
   - `shop = new URL(payload.dest).hostname`.
   - `sessionId = shopifyClient.session.getOfflineId(shop)`.
   - `session = await sessionStorage.loadSession(sessionId)`. Missing → `401 { error: 'no_offline_session' }`.
   - Run the existing stub REST call against the offline session. Return `{ success: true }`.
5. Client: on 2xx, `shopify.toast.show('Sync started')`. On 401, `shopify.toast.show('Session expired. Reload the app.', { isError: true })`. On other failure, `shopify.toast.show('Sync failed. Try again.', { isError: true })`.

### Why offline session

Sync is intended as a long-running, background-style operation that may outlive the user's browser tab. Offline sessions persist beyond the user's admin login; online sessions do not. The current code already uses offline sessions and we keep that.

### Error states

| Condition | HTTP | Toast |
|-----------|------|-------|
| No `Authorization` header | 401 | "Session expired. Reload the app." |
| Token signature invalid or expired | 401 | "Session expired. Reload the app." |
| Offline session not in DB | 401 | "Please reinstall the app." |
| Any other server error | 500 | "Sync failed. Try again." |

## Testing

### Component test (rewritten)

`app/(embedded)/__tests__/onboarding.test.tsx`:

- No CDN script load and no `customElements.define` shim. Vitest + jsdom render `<s-page>`, `<s-button>`, etc. as unknown elements with attributes — sufficient for behavioral assertions.
- Stub `globalThis.shopify` in `beforeEach`:
  ```ts
  (globalThis as any).shopify = {
    idToken: vi.fn().mockResolvedValue('test.jwt.token'),
    toast: { show: vi.fn() },
  };
  ```
- Mock `fetch` via `vi.spyOn(globalThis, 'fetch')`.
- Cases:
  1. Renders the headings and the "Start sync" trigger.
  2. Clicking "Start sync" calls `shopify.idToken()` and POSTs to `/api/shopify/sync` with `Authorization: Bearer test.jwt.token`.
  3. On 200, `shopify.toast.show` called with success message.
  4. On 401, `shopify.toast.show` called with the session-expired error message.

If `fireEvent.click` on `<s-button>` proves flaky in jsdom, fall back to invoking the onClick handler through a `data-testid` on an inner element.

### Route test (new)

`app/api/shopify/sync/__tests__/route.test.ts`:

1. Missing `Authorization` → 401.
2. Invalid token (`decodeSessionToken` throws) → 401.
3. Valid token, no session in storage → 401 with `no_offline_session`.
4. Valid token + session present → calls REST client and returns `{ success: true }`. REST client mocked so no network.

Module mocks for `@/lib/shopify/client` and `@/lib/shopify/session-storage`.

### Manual verification (called out, not automated)

1. `bun dev` with ngrok tunnel pointing at the app URL configured in `shopify.app.toml`.
2. Open the app from a dev store → onboarding renders inside the admin iframe, Polaris web components are styled, NavMenu items appear in the Shopify admin nav.
3. Click "Start sync" → DevTools Network tab shows `Authorization: Bearer <jwt>`. Server logs the decoded shop. A toast appears in the admin.

## Risks and open questions

- **Polaris web component versioning.** Loading from `cdn.shopify.com/shopifycloud/polaris.js` always pulls the latest. Shopify may ship breaking changes; mitigation is keeping `@shopify/polaris-types@latest` in lockstep and running the app smoke test after dep updates.
- **Test fidelity for web components.** jsdom does not upgrade custom elements. The tests validate our React tree and event wiring, not Shopify's component rendering. Acceptable: we don't own those components.
- **NavMenu styling during transition.** Removing `AppProvider` removes Polaris React's CSS reset. `<NavMenu>` from `@shopify/app-bridge-react` is a host-level component (renders to the admin chrome, not inside the iframe), so it should not depend on Polaris CSS. Verify in manual smoke test.
- **Middleware coupling.** `middleware.ts` already has session-token decoding logic but with the matcher commented out. This spec does not turn it on. We rely solely on per-route verification in `/api/shopify/sync`. If we later want middleware-level enforcement, the route's auth code can be lifted into a shared helper.

## Out of scope (for future work)

- Migrate `app/(embedded)/chat/page.tsx` to Polaris web components.
- Replace App Bridge React `<NavMenu>` with `<ui-nav-menu>`.
- Wire real product sync (replace the stub REST call with `syncProducts()`).
- Turn on `[access.admin] embedded_app_direct_api_access` and use `fetch('shopify:admin/api/graphql.json', ...)` for client-side reads.
- Promote shared session-token auth to middleware so additional embedded API routes don't each re-implement it.
