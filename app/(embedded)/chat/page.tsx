import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { getShopAppearance } from '@/services/chat/getShopAppearance';
import { prisma } from '@/lib/db/client';
import { resolveShopFromRequest } from '@/lib/shopify/server-resolve-shop';
import { ChatShell } from './chat-shell';

// Chat-redesign Task 12: /chat is a Server Component that loads the playground
// shell's data in parallel — active model, per-shop appearance, and the
// shop-scoped catalog count. The old standalone preview banner is gone; its
// copy lives in the ChatShell header pill now.
//
// Phase 8.1 Plan 05 (W-2): shop is resolved from the embedded session-token
// Authorization header first, falling back to searchParams.shop for
// direct-navigation refreshes where no Bearer token is present.

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
    // query value drive shop-scoped reads (model lookup, ChatShell lookups).
    const validatedQueryShop =
        shopFromQuery && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopFromQuery)
            ? shopFromQuery
            : undefined;
    const shop = shopFromSession ?? validatedQueryShop ?? '';

    const [model, appearance, catalogCount] = await Promise.all([
        getActiveChatModel(shop),
        getShopAppearance(shop),
        // Degrade to 0 on DB errors — the count only seeds the empty-state
        // greeting; it must never crash the playground render path.
        shop
            ? prisma.product.count({ where: { shop } }).catch(() => 0)
            : Promise.resolve(0),
    ]);

    return (
        <div className="mx-auto flex h-dvh w-full flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
                <ChatShell
                    shop={shop}
                    modelName={model.displayName}
                    appearance={appearance}
                    catalogCount={catalogCount}
                />
            </div>
        </div>
    );
}
