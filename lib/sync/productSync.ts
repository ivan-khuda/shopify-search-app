import { ShopifyProductService } from "@/services/shopify/ShopifyProductService";

export async function syncProducts() {
    const shopifyService = new ShopifyProductService();
    const products = await shopifyService.fetchAllProducts();

    for (const product of products) {
        const mapped = shopifyService.mapToLocalProduct(product);
        // await productRepository.upsert(mapped); // insert or update
    }
}
