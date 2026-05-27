import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const resp = await prisma.shopifySession.create({
        data: {
            id: "offline_segal-jewellery.myshopify.com",
            shop: "segal-jewellery.myshopify.com",
            state: "906014051218910",
            isOnline: false,
            scope: "write_products,write_orders",
            accessToken: process.env.SHOPIFY_DEV_ACCESS_TOKEN!,
        }
    });

    console.log({ resp });
}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
