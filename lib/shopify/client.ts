// import { createStorefrontApiClient } from "@shopify/storefront-api-client";
// or for admin API:
import '@shopify/shopify-api/adapters/node';
import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import { Session } from "@shopify/shopify-api";
import { prisma } from '@/lib/db/client';

export const shopifyClient = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecretKey: process.env.SHOPIFY_API_SECRET!,
    scopes: ["read_products"],
    hostName: process.env.HOST!,
    apiVersion: ApiVersion.January26,
    isEmbeddedApp: true,
});

export async function getSessionFromStorage(
    sessionId: string | undefined
): Promise<Session | undefined> {
    if (!sessionId) return undefined;

    const sessionData = await prisma.shopifySession.findUnique({
        where: {
            id: sessionId
        },
    });

    if (!sessionData) return undefined;

    return new Session({
        id: sessionData.id,
        shop: sessionData.shop,
        state: sessionData.state,
        isOnline: sessionData.isOnline,
        accessToken: sessionData.accessToken!,
        scope: sessionData.scope!,
        expires: sessionData.expires ? new Date(sessionData.expires) : undefined,
    });
}