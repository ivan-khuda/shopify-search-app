-- AlterTable: ShopSettings — add fab style and drawer position columns
ALTER TABLE "shop_settings"
  ADD COLUMN IF NOT EXISTS "fabStyle"       TEXT NOT NULL DEFAULT 'circle',
  ADD COLUMN IF NOT EXISTS "drawerPosition" TEXT NOT NULL DEFAULT 'side';
