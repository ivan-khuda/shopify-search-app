-- AlterTable: ShopSettings — add new settings page columns
ALTER TABLE "shop_settings"
  ADD COLUMN IF NOT EXISTS "drawerAccent"         TEXT    NOT NULL DEFAULT '#5B4FE9',
  ADD COLUMN IF NOT EXISTS "greetingMessage"      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "suggestedPrompts"     JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "monthlyCapRequests"   INTEGER,
  ADD COLUMN IF NOT EXISTS "notificationEmail"    TEXT,
  ADD COLUMN IF NOT EXISTS "drawerEnabled"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "editorPreviewVisible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: RequestCounter — add admin surface split column
ALTER TABLE "request_counter"
  ADD COLUMN IF NOT EXISTS "adminRequestCount" INTEGER NOT NULL DEFAULT 0;
