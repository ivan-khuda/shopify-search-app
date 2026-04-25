import crypto from "node:crypto";

export class ShopifyWebhookService {
    async verifyWebhook(req: Request) {
        const hmac = req.headers.get("x-shopify-hmac-sha256");
        const body = await req.text();
        const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
        if (!secret || !hmac) return false;
        const calculatedHmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
        return hmac === calculatedHmac;
    }
}