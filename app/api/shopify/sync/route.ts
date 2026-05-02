import { shopifyClient } from "@/lib/shopify/client";
import { sessionStorage } from "@/lib/shopify/session-storage";
import { NextResponse } from 'next/server';


export async function POST(req: Request) {

    const sessionId = await shopifyClient.session.getOfflineId("segal-jewellery.myshopify.com");

    const session = await sessionStorage.loadSession(sessionId);

    if (!session) {
        return NextResponse.json({ success: false });
    }

    const client = new shopifyClient.clients.Rest({
        session
    });
    const response = await client.get<unknown>({
        path: 'products/7539258589318',
    });
    console.log("client", client);
    console.log("session", session);
    console.log("response", response);


    // await syncProducts();
    return Response.json({ sessionId, response, success: true });
}
