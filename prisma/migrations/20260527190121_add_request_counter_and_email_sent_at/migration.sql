-- AlterTable
ALTER TABLE "sync_runs" ADD COLUMN     "emailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "request_counter" (
    "shop" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_counter_pkey" PRIMARY KEY ("shop","period")
);
