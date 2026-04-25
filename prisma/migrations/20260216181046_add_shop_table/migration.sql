-- CreateTable
CREATE TABLE "shopify_sessions" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL,
    "scope" TEXT,
    "expires" INTEGER,
    "onlineAccessInfo" TEXT,
    "accessToken" TEXT,

    CONSTRAINT "shopify_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_sessions_shop_idx" ON "shopify_sessions"("shop");

-- CreateIndex
CREATE INDEX "shopify_sessions_state_idx" ON "shopify_sessions"("state");
