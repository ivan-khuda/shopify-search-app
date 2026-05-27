import { prisma } from '@/lib/db/client';
import type { Product } from '@/app/generated/prisma/client';

export interface ProductVariantInput {
  shopifyId?: bigint | null;
  title: string;
  sku?: string | null;
  barcode?: string | null;
  price: number | string;
  compareAtPrice?: number | string | null;
  position?: number;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string;
  availableForSale?: boolean;
  requiresShipping?: boolean;
  taxable?: boolean;
  weight?: number | string | null;
  weightUnit?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface ProductImageInput {
  shopifyId?: bigint | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  position?: number;
  variantId?: number | null;
}

export interface ProductOptionInput {
  shopifyId?: bigint | null;
  name: string;
  position: number;
  values: string[];
}

export interface ProductUpsertInput {
  shopifyId?: bigint | null;
  title: string;
  handle: string;
  description?: string | null;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status?: string;
  tags?: string[];
  publishedAt?: Date | null;
  updatedAtShopify?: Date | null; // Phase 2 D-17: SYN-11 conflict resolution
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  compareAtPriceMin?: number | string | null;
  compareAtPriceMax?: number | string | null;
  variants?: ProductVariantInput[];
  images?: ProductImageInput[];
  options?: ProductOptionInput[];
}

export interface ListOpts {
  status?: string;
  limit?: number;
  offset?: number;
}

export class ProductRepository {
  async upsertProduct(shop: string, input: ProductUpsertInput): Promise<Product> {
    return prisma.$transaction(async (tx) => {
      const productData = {
        shop,
        shopifyId: input.shopifyId ?? null,
        title: input.title,
        handle: input.handle,
        description: input.description ?? null,
        descriptionHtml: input.descriptionHtml ?? null,
        vendor: input.vendor ?? null,
        productType: input.productType ?? null,
        status: input.status ?? 'ACTIVE',
        tags: input.tags ?? [],
        publishedAt: input.publishedAt ?? null,
        updatedAtShopify: input.updatedAtShopify ?? null,
        priceMin: input.priceMin ?? null,
        priceMax: input.priceMax ?? null,
        compareAtPriceMin: input.compareAtPriceMin ?? null,
        compareAtPriceMax: input.compareAtPriceMax ?? null,
      };

      // Upsert by (shop, handle) compound unique. Handle is always present in input;
      // shopifyId is optional. Using shop_handle avoids the null-shopifyId edge case.
      const product = await tx.product.upsert({
        where: { shop_handle: { shop, handle: input.handle } },
        create: productData,
        update: productData,
      });

      // Replace children (variants, images, options) in one shot — easier than
      // diffing and matches Shopify-sync semantics where a product's full child
      // set is overwritten on each sync. Composite FK filter ensures scope.
      await tx.productVariant.deleteMany({ where: { productShop: shop, productId: product.id } });
      await tx.productImage.deleteMany({ where: { productShop: shop, productId: product.id } });
      await tx.productOption.deleteMany({ where: { productShop: shop, productId: product.id } });

      if (input.variants && input.variants.length > 0) {
        await tx.productVariant.createMany({
          data: input.variants.map((v) => ({
            shop,
            productShop: shop,
            productId: product.id,
            shopifyId: v.shopifyId ?? null,
            title: v.title,
            sku: v.sku ?? null,
            barcode: v.barcode ?? null,
            price: v.price as never,
            compareAtPrice: (v.compareAtPrice ?? null) as never,
            position: v.position ?? 1,
            inventoryQuantity: v.inventoryQuantity ?? null,
            inventoryPolicy: v.inventoryPolicy ?? 'DENY',
            availableForSale: v.availableForSale ?? true,
            requiresShipping: v.requiresShipping ?? true,
            taxable: v.taxable ?? true,
            weight: (v.weight ?? null) as never,
            weightUnit: v.weightUnit ?? null,
            option1: v.option1 ?? null,
            option2: v.option2 ?? null,
            option3: v.option3 ?? null,
          })),
        });
      }

      if (input.images && input.images.length > 0) {
        await tx.productImage.createMany({
          data: input.images.map((img) => ({
            shop,
            productShop: shop,
            productId: product.id,
            shopifyId: img.shopifyId ?? null,
            url: img.url,
            altText: img.altText ?? null,
            width: img.width ?? null,
            height: img.height ?? null,
            position: img.position ?? 1,
            variantId: img.variantId ?? null,
          })),
        });
      }

      if (input.options && input.options.length > 0) {
        await tx.productOption.createMany({
          data: input.options.map((o) => ({
            shop,
            productShop: shop,
            productId: product.id,
            shopifyId: o.shopifyId ?? null,
            name: o.name,
            position: o.position,
            values: o.values,
          })),
        });
      }

      return product;
    });
  }

  async findByShopAndId(shop: string, id: number): Promise<Product | null> {
    return prisma.product.findFirst({ where: { shop, id } });
  }

  async findByShopAndHandle(shop: string, handle: string): Promise<Product | null> {
    return prisma.product.findFirst({ where: { shop, handle } });
  }

  async listByShop(shop: string, opts: ListOpts = {}): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        shop,
        ...(opts.status ? { status: opts.status } : {}),
      },
      ...(opts.limit !== undefined ? { take: opts.limit } : {}),
      ...(opts.offset !== undefined ? { skip: opts.offset } : {}),
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteProduct(shop: string, id: number): Promise<void> {
    await prisma.product.deleteMany({ where: { shop, id } });
  }
}

export const productRepository = new ProductRepository();
