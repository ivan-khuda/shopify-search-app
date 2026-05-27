import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    productVariant: { deleteMany: vi.fn(), createMany: vi.fn() },
    productImage: { deleteMany: vi.fn(), createMany: vi.fn() },
    productOption: { deleteMany: vi.fn(), createMany: vi.fn() },
    productEmbedding: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { productRepository } from '../ProductRepository';
import { prisma } from '@/lib/db/client';

// Minimal ProductUpsertInput fixture for upsertProduct tests
const minimalInput = {
  title: 'Test Product',
  handle: 'test-product',
  status: 'ACTIVE',
  tags: ['test'],
  variants: [
    {
      title: 'Default',
      price: 9.99,
      position: 1,
      inventoryPolicy: 'deny',
      availableForSale: true,
      requiresShipping: true,
      taxable: true,
    },
  ],
  images: [
    {
      url: 'https://example.com/image.jpg',
      position: 1,
    },
  ],
  options: [
    {
      name: 'Size',
      position: 1,
      values: ['S', 'M', 'L'],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Wire $transaction to execute the callback synchronously with the prisma mock as tx
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  );
});

describe('ProductRepository', () => {
  describe('findByShopAndId', () => {
    it('scopes query to the given shop', async () => {
      (prisma.product.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await productRepository.findByShopAndId('shop-a.myshopify.com', 42);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { shop: 'shop-a.myshopify.com', id: 42 },
      });
    });

    it('shop appears in where clause — cross-shop isolation', async () => {
      (prisma.product.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await productRepository.findByShopAndId('shop-a.myshopify.com', 1);
      const callA = (prisma.product.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];

      vi.clearAllMocks();
      (prisma.product.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await productRepository.findByShopAndId('shop-b.myshopify.com', 1);
      const callB = (prisma.product.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // Same id, different shop — where clauses must differ on the shop field
      expect(callA.where.shop).toBe('shop-a.myshopify.com');
      expect(callB.where.shop).toBe('shop-b.myshopify.com');
      expect(callA.where).not.toEqual(callB.where);
    });
  });

  describe('listByShop', () => {
    it('calls findMany with where: { shop }', async () => {
      (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      await productRepository.listByShop('shop-a.myshopify.com');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shop: 'shop-a.myshopify.com' }),
        })
      );
    });

    it('includes status filter when opts.status is provided', async () => {
      (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      await productRepository.listByShop('shop-a.myshopify.com', { status: 'ACTIVE' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shop: 'shop-a.myshopify.com',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('respects limit and offset via take and skip', async () => {
      (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      await productRepository.listByShop('shop-a.myshopify.com', { limit: 10, offset: 20 });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('deleteProduct', () => {
    it('calls deleteMany with where: { shop, id } — avoids dependence on generated compound where name', async () => {
      (prisma.product.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      await productRepository.deleteProduct('shop-a.myshopify.com', 99);
      expect(prisma.product.deleteMany).toHaveBeenCalledWith({
        where: { shop: 'shop-a.myshopify.com', id: 99 },
      });
    });

    it('includes shop in where clause — prevents cross-shop deletion', async () => {
      (prisma.product.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      await productRepository.deleteProduct('shop-a.myshopify.com', 1);
      const call = (prisma.product.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where).toHaveProperty('shop', 'shop-a.myshopify.com');
    });
  });

  describe('upsertProduct', () => {
    it('wraps its work in prisma.$transaction', async () => {
      const mockProduct = { id: 1, shop: 'shop-a.myshopify.com', title: 'Test Product' };
      (prisma.product.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.productVariant.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productImage.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productOption.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await productRepository.upsertProduct('shop-a.myshopify.com', minimalInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('passes shop to product upsert', async () => {
      const mockProduct = { id: 1, shop: 'shop-a.myshopify.com', title: 'Test Product' };
      (prisma.product.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.productVariant.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productImage.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productOption.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productVariant.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productImage.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productOption.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await productRepository.upsertProduct('shop-a.myshopify.com', minimalInput);

      const upsertCall = (prisma.product.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // shop must appear in both create and update arms
      expect(upsertCall.create).toHaveProperty('shop', 'shop-a.myshopify.com');
      expect(upsertCall.update).toHaveProperty('shop', 'shop-a.myshopify.com');
    });

    it('uses productShop: shop in child deleteMany calls', async () => {
      const mockProduct = { id: 7, shop: 'shop-a.myshopify.com', title: 'Test Product' };
      (prisma.product.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.productVariant.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productImage.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productOption.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productVariant.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productImage.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productOption.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await productRepository.upsertProduct('shop-a.myshopify.com', minimalInput);

      const variantDeleteCall = (prisma.productVariant.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(variantDeleteCall.where).toHaveProperty('productShop', 'shop-a.myshopify.com');
    });

    it('includes shop and productShop on every child createMany row', async () => {
      const mockProduct = { id: 7, shop: 'shop-a.myshopify.com', title: 'Test Product' };
      (prisma.product.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.productVariant.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productImage.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productOption.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      (prisma.productVariant.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productImage.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      (prisma.productOption.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await productRepository.upsertProduct('shop-a.myshopify.com', minimalInput);

      const variantCreateCall = (prisma.productVariant.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Every row must have shop and productShop set
      for (const row of variantCreateCall.data) {
        expect(row).toHaveProperty('shop', 'shop-a.myshopify.com');
        expect(row).toHaveProperty('productShop', 'shop-a.myshopify.com');
      }
    });
  });
});
