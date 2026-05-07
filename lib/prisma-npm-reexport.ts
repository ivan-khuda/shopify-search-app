/**
 * `@shopify/shopify-app-session-storage-prisma` imports `@prisma/client` (for `Prisma.PrismaClientKnownRequestError`).
 * Prisma 7 generates the client to `app/generated/prisma`; `next.config` aliases `@prisma/client` to this file.
 */
export * from "../app/generated/prisma/client";
