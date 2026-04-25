export async function POST(req: Request) {
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    // 1. Verify webhook signature
    // 2. Parse event (products/create, products/update, products/delete)
    // 3. Call sync logic for just that product
}