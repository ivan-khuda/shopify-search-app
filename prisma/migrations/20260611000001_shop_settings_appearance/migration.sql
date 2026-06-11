-- AlterTable
ALTER TABLE "shop_settings" 
  ALTER COLUMN "activeChatModelId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "emptyStateVariant" TEXT NOT NULL DEFAULT 'cards',
  ADD COLUMN IF NOT EXISTS "cardDensity" TEXT NOT NULL DEFAULT 'standard';
