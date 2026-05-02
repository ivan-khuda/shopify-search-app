import { PrismaSessionStorage } from '@shopify/shopify-app-session-storage-prisma';
import { prisma } from '@/lib/db/client';

export const sessionStorage = new PrismaSessionStorage(prisma, {
  tableName: 'shopifySession',
});
