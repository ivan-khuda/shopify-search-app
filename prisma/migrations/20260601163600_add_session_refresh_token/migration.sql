-- Add refresh-token columns required by
-- @shopify/shopify-app-session-storage-prisma v8 (sessionToRow always writes them).
ALTER TABLE "shopify_sessions" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "shopify_sessions" ADD COLUMN IF NOT EXISTS "refreshTokenExpires" TIMESTAMP(3);
