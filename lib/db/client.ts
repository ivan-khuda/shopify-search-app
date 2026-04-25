import '@shopify/shopify-api/adapters/node';
import { PrismaClient } from "@/app/generated/prisma/client";
import "dotenv/config";

export const prisma = new PrismaClient({
    accelerateUrl: process.env["DATABASE_URL"]!,
});
