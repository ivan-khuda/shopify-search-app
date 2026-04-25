import { Product } from "@/app/generated/prisma/browser";

export class ProductRepository {
    async upsert(product: Product) {
        // upsert product
    }
}

export const productRepository = new ProductRepository();
