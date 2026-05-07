import type { Product } from "@prisma/client";

export class ProductRepository {
    async upsert(product: Product) {
        // upsert product
    }
}

export const productRepository = new ProductRepository();
