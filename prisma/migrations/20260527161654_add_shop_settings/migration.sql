-- CreateTable
CREATE TABLE "shop_settings" (
    "shop" TEXT NOT NULL,
    "activeChatModelId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("shop")
);
