/*
  Warnings:

  - You are about to drop the column `onlineAccessInfo` on the `shopify_sessions` table. All the data in the column will be lost.
  - The `expires` column on the `shopify_sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "shopify_sessions" DROP COLUMN "onlineAccessInfo",
ADD COLUMN     "accountOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collaborator" BOOLEAN DEFAULT false,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN DEFAULT false,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "userId" BIGINT,
DROP COLUMN "expires",
ADD COLUMN     "expires" TIMESTAMP(3);
