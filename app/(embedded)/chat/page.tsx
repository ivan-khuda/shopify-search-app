import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { resolveShopFromRequest } from '@/lib/shopify/server-resolve-shop';
import { ChatShell } from './chat-shell';

// Phase 4 Plan 6 (D-11): /chat is a Server Component.
// See .planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md for the
// banner typography (em-dash U+2014, middle-dot U+00B7) and accessibility
// contract (banner is static — distinct from message-parts.tsx transient
// tool-state affordances). The banner interpolates the model displayName
// dynamically so Phase 7 is a body-only swap of getActiveChatModel.
//
// Phase 8.1 Plan 05 (W-2): shop is now resolved from the embedded session-token
// Authorization header first, falling back to searchParams.shop for direct-navigation
// refreshes where no Bearer token is present.

export default async function ChatPage({
    searchParams,
}: {
    searchParams: Promise<{ shop?: string }>;
}) {
    const { shop: shopFromQuery } = await searchParams;
    const shopFromSession = await resolveShopFromRequest();
    // WR-01: searchParams.shop is attacker-controllable on direct navigation.
    // Mirror the `.myshopify.com` hostname validation that the session-token
    // path applies (lib/shopify/server-resolve-shop.ts) before letting the
    // query value drive shop-scoped reads (model banner, ChatShell lookups).
    const validatedQueryShop =
        shopFromQuery && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopFromQuery)
            ? shopFromQuery
            : undefined;
    const shop = shopFromSession ?? validatedQueryShop ?? '';
    const model = await getActiveChatModel(shop);
    const displayName = model.displayName;
    const bannerAriaLabel = `Chat playground preview mode banner. Active model: ${displayName}.`;

    return (
        <div className="mx-auto flex h-dvh w-full flex-col overflow-hidden">
            <div
                role="status"
                aria-live="off"
                aria-label={bannerAriaLabel}
                className="shrink-0 bg-muted/40 text-muted-foreground text-xs py-1.5 px-4 sm:px-6 border-b border-border"
            >
                Preview mode — using your real catalog · Model:{' '}
                <span className="text-foreground font-semibold">{model.displayName}</span>
            </div>
            <div className="min-h-0 flex-1">
                <ChatShell shop={shop} />
            </div>
        </div>
    );
}
