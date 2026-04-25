import type { ShopifyProduct } from "@/types/shopify";

export class ShopifyProductService {
    async fetchAllProducts() {
        // paginate through Shopify GraphQL API
        return [];
    }

    mapToLocalProduct(shopifyProduct: ShopifyProduct): void {
        // transform Shopify shape → your DB shape
    }
}