/**
 * Shopify webhook handler — products/create, products/update, products/delete.
 *
 * IMPORTANT: Raw body MUST be read via req.text() BEFORE any JSON.parse —
 * shopifyClient.webhooks.validate requires the unparsed bytes for HMAC
 * computation. See 02-PATTERNS.md §webhook for rationale.
 *
 * Inline handler (D-06): HMAC verify → P2002 dedup → ProductRepository call.
 * No Inngest indirection for V1 (deliberate; webhooks are 1-event-each and
 * Shopify retries on non-2xx).
 */
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/db/client';
import { productRepository } from '@/lib/db/repositories/ProductRepository';
import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';

interface WebhookProductPayload {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  status?: string;
  tags?: string | string[];
  updated_at?: string;
  variants?: Array<{
    id: number | string;
    title?: string;
    sku?: string | null;
    price?: string;
    compare_at_price?: string | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
  }>;
  images?: Array<{
    id: number | string;
    src: string;
    alt?: string | null;
    width?: number;
    height?: number;
    position?: number;
  }>;
  options?: Array<{
    id: number | string;
    name: string;
    position?: number;
    values?: string[];
  }>;
}

function mapWebhookPayloadToUpsertInput(payload: WebhookProductPayload): ProductUpsertInput {
  const tags: string[] = typeof payload.tags === 'string'
    ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : (payload.tags ?? []);

  return {
    shopifyId: BigInt(payload.id),
    title: payload.title ?? '',
    handle: payload.handle ?? '',
    description: payload.body_html ?? null,
    descriptionHtml: payload.body_html ?? null,
    vendor: payload.vendor ?? null,
    productType: payload.product_type ?? null,
    status: payload.status ?? 'active',
    tags,
    updatedAtShopify: payload.updated_at ? new Date(payload.updated_at) : null,
    variants: (payload.variants ?? []).map((v, idx) => ({
      shopifyId: BigInt(v.id),
      title: v.title ?? 'Default',
      sku: v.sku ?? null,
      price: v.price ? parseFloat(v.price) : 0,
      compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
      position: idx + 1,
      option1: v.option1 ?? null,
      option2: v.option2 ?? null,
      option3: v.option3 ?? null,
    })),
    images: (payload.images ?? []).map((i, idx) => ({
      shopifyId: BigInt(i.id),
      url: i.src,
      altText: i.alt ?? null,
      width: i.width ?? null,
      height: i.height ?? null,
      position: i.position ?? idx + 1,
    })),
    options: (payload.options ?? []).map((o) => ({
      shopifyId: BigInt(o.id),
      name: o.name,
      position: o.position ?? 1,
      values: o.values ?? [],
    })),
  };
}

export async function POST(req: Request): Promise<Response> {
  // STEP 1: Raw body FIRST (required for HMAC validation).
  const rawBody = await req.text();

  // STEP 2: HMAC validation. shopifyClient.webhooks.validate is the correct
  // API for webhook HMAC (D-10). NOT utils.validateHmac — that's App Proxy.
  const validation = await shopifyClient.webhooks.validate({
    rawBody,
    rawRequest: req,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: 'invalid_hmac' }, { status: 401 });
  }

  const shop = validation.domain;
  const topic = validation.topic;
  const eventId = validation.webhookId;

  // STEP 3: Dedup via WebhookEvent insert. P2002 = unique violation = duplicate.
  try {
    await prisma.webhookEvent.create({ data: { eventId, shop, topic } });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ ok: true, dedup: true }, { status: 200 });
    }
    throw err;
  }

  // STEP 4: Now safe to JSON.parse (HMAC + dedup behind us).
  const payload = JSON.parse(rawBody) as WebhookProductPayload;

  // STEP 5: Topic dispatch.
  if (topic === 'products/create' || topic === 'products/update') {
    // SYN-11: stale-event guard via updatedAtShopify comparison.
    if (payload.handle) {
      const existing = await productRepository.findByShopAndHandle(shop, payload.handle);
      if (
        existing?.updatedAtShopify &&
        payload.updated_at &&
        new Date(payload.updated_at) < existing.updatedAtShopify
      ) {
        return NextResponse.json({ ok: true, skipped: 'stale' }, { status: 200 });
      }
    }
    await productRepository.upsertProduct(shop, mapWebhookPayloadToUpsertInput(payload));
  } else if (topic === 'products/delete') {
    // Delete payload has only `id` — look up by shopifyId.
    const product = await prisma.product.findFirst({
      where: { shop, shopifyId: BigInt(payload.id) },
    });
    if (product) {
      await productRepository.deleteProduct(shop, product.id);
    }
  } else {
    return NextResponse.json({ ok: true, ignored: topic }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
