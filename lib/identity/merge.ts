/**
 * mergeVisitorIntoCustomer — atomic visitor → customer identity merge (D-09, D-10, D-11).
 *
 * Re-keys a visitor's anonymous data (Conversation rows, SavedProduct rows)
 * onto a Shopify customer ID once the storefront observes a new
 * (visitor_id, customer_id) pair. All work runs inside a single
 * prisma.$transaction so partial failure can never leave a visitor
 * half-migrated.
 *
 * Caller contract (IMPORTANT):
 *   The caller MUST verify body.customer_id === signed
 *   query.logged_in_customer_id BEFORE invoking this helper. Plan 09's
 *   /api/proxy/chat handler enforces this via withAppProxyHmac's IDN-02
 *   cross-check. This helper itself does NOT re-validate identity — it
 *   trusts that the (visitor_id, customer_id) pair is authentic.
 *
 * Idempotency:
 *   On the first call for a given (shop, visitor_id, customer_id) triple,
 *   the helper performs the merge and writes a VisitorCustomerLink marker.
 *   Subsequent calls short-circuit on the link row — no SQL executes.
 *
 * Partial-index dependency (Pitfall 4):
 *   The ON CONFLICT clause on the SavedProduct INSERT references the
 *   partial unique index `saved_products_customer_unique_idx`
 *   (db/manual-indexes.sql, D-20). Its WHERE predicate must be
 *   byte-identical to the ON CONFLICT predicate below; mismatch yields a
 *   Postgres error: "no unique or exclusion constraint matching the ON
 *   CONFLICT specification". If `bun db:indexes` was not run after a
 *   `prisma migrate reset`, this helper will throw at runtime — apply the
 *   manual indexes first.
 */
import { prisma } from '@/lib/db/client';

export async function mergeVisitorIntoCustomer(
  shop: string,
  visitorId: string,
  customerId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.visitorCustomerLink.findUnique({
      where: {
        shop_visitorId_customerId: { shop, visitorId, customerId },
      },
    });
    if (existing != null) {
      return;
    }

    // Re-key anonymous Conversation rows. Set customerId on rows that match
    // (shop, visitorId, customerId IS NULL) — these are the visitor's
    // anonymous-session conversations getting promoted to the new identity.
    await tx.$executeRaw`
      UPDATE "conversations" /* Conversation re-key */
      SET "customerId" = ${customerId}
      WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL
    `;

    // INSERT new SavedProduct rows with customerId set. SELECT from existing
    // visitor-only rows, ON CONFLICT against saved_products_customer_unique_idx
    // (partial unique on shop, customerId, productId WHERE customerId IS NOT NULL).
    // pgcrypto's gen_random_uuid() generates the id column value — Prisma's
    // @default(cuid()) does not run inside raw SQL.
    await tx.$executeRaw`
      INSERT INTO "saved_products" /* SavedProduct re-INSERT */ (id, shop, "visitorId", "customerId", "productId", "savedAt")
      SELECT gen_random_uuid()::text, shop, "visitorId", ${customerId}, "productId", "savedAt"
      FROM "saved_products"
      WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL
      ON CONFLICT (shop, "customerId", "productId") WHERE "customerId" IS NOT NULL DO NOTHING
    `;

    // DELETE the original visitor-only SavedProduct rows now that the
    // customer-linked rows exist (deduped by the partial unique index).
    await tx.$executeRaw`
      DELETE FROM "saved_products" /* SavedProduct visitor-only cleanup */
      WHERE shop = ${shop} AND "visitorId" = ${visitorId} AND "customerId" IS NULL
    `;

    await tx.visitorCustomerLink.create({
      data: { shop, visitorId, customerId },
    });
  });
}
