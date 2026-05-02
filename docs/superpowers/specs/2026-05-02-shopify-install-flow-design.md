# Shopify App Installation Flow — Design Spec

**Date:** 2026-05-02
**Status:** Approved

## Overview

Implement the OAuth installation flow for SmartDiscovery AI as a public Shopify embedded app distributed through the Shopify App Store. The app runs inside Shopify Admin via an iframe using App Bridge. Both offline sessions (permanent, for background product sync) and online sessions (per-user, for the embedded UI) are acquired during install.

---

## 1. OAuth Flow & Routes

Two-stage OAuth acquires both session types in a single install sequence.

**Flow:**
1. Merchant clicks "Install" on App Store → Shopify calls `GET /api/auth?shop=xxx.myshopify.com`
2. App redirects to Shopify OAuth (offline, `callbackPath: /api/auth/callback`)
3. Merchant approves → Shopify hits `/api/auth/callback` → app stores offline session (permanent access token for background sync)
4. Callback redirects to `GET /api/auth/online` → begins second OAuth pass (online, `callbackPath: /api/auth/online/callback`)
5. Shopify hits `/api/auth/online/callback` → app stores online session (per-user, for iframe)
6. Final redirect: `https://{shop}/admin/apps/{handle}/onboarding`

**New routes:**
```
app/api/auth/route.ts                    # GET - begin offline OAuth
app/api/auth/callback/route.ts           # GET - complete offline, begin online
app/api/auth/online/route.ts             # GET - begin online OAuth
app/api/auth/online/callback/route.ts    # GET - complete online, redirect to onboarding
```

Both `/api/auth/callback` and `/api/auth/online/callback` must be registered as allowed redirect URLs in the Shopify Partner Dashboard.

**Scopes:** `read_products` (current). Additional scopes added as features are introduced (billing, webhooks).

---

## 2. Session Storage

**Package:** `@shopify/shopify-app-session-storage-prisma`

**Schema migration** — two changes to the existing `ShopifySession` model:
- `expires Int?` → `expires DateTime?`
- Add `userId BigInt?` (required for online sessions)

**New file:** `lib/shopify/session-storage.ts` — creates and exports a `PrismaSessionStorage` instance using the existing singleton `prisma` client.

**Updated:** `lib/shopify/client.ts` — passes `sessionStorage` into `shopifyApi()`. The existing manual `getSessionFromStorage` helper is removed (redundant once the adapter is wired in).

---

## 3. Middleware

**File:** `middleware.ts` at project root.

**Protected paths:** `/chat`, `/onboarding`
**Public paths (excluded):** `/api/auth/*`, `/api/auth/online/*`, `/_next/*`, `/favicon.ico`, static assets

**Logic for protected routes:**
1. Extract `shop` from query params or the App Bridge session token in the `Authorization` header
2. Look up the offline session for that shop — if missing, redirect to `/api/auth?shop=...`
3. Validate the App Bridge `id_token` (signed JWT) using `shopify.session.decodeSessionToken()`
4. If token is invalid or expired, redirect to `/api/auth?shop=...`

The middleware confirms the shop has a stored offline session (app is installed) and the JWT is legitimate. Online session verification is handled client-side by App Bridge.

---

## 4. Frontend — App Bridge & Onboarding Page

**New packages:** `@shopify/app-bridge-react`, `@shopify/polaris`

### Route group

`app/(embedded)/layout.tsx` — wraps all embedded pages with `AppProvider` from `@shopify/app-bridge-react`. Reads `shop` and `host` from query params (passed automatically by Shopify when loading the iframe).

The existing `/chat` page moves into this route group (`app/(embedded)/chat/page.tsx`) so it receives App Bridge context.

### Navigation

A `NavigationMenu` component (App Bridge) in the layout defines two sidebar links inside Shopify Admin:
- **Search** → `/chat`
- **Onboarding** → `/onboarding`

### Onboarding page

**File:** `app/(embedded)/onboarding/page.tsx`

```
Page title: "Welcome to SmartDiscovery AI"
Layout (two-column)
  Left column:
    Card "How it works"
      - We sync your product catalog automatically
      - Our AI uses it to answer customer search queries
      - You'll receive an email when the first sync completes
    Button "Start sync" (primary) → POST /api/shopify/sync
  Right column:
    Card "What's synced"
      - Product titles, descriptions, tags
      - Variants and pricing
      - Images
    Card "What's next"
      - After sync: use the Search tab to test queries
      - Billing will be introduced in a future update
```

---

## 5. New Dependencies

| Package | Purpose |
|---|---|
| `@shopify/shopify-app-session-storage-prisma` | Prisma-backed session storage adapter |
| `@shopify/app-bridge-react` | App Bridge React provider + NavigationMenu |
| `@shopify/polaris` | Shopify Admin UI components for onboarding |

---

## 6. Out of Scope

- Billing implementation (future)
- Webhook verification beyond the existing stub
- Product sync email notification (trigger exists; email sending is a separate feature)
- App uninstall handling
