import { shopifyClient } from '@/lib/shopify/client';
import type { Session } from '@shopify/shopify-api';
import type { ProductUpsertInput } from '@/lib/db/repositories/ProductRepository';

/**
 * Defensive Money parser. Shopify Admin GraphQL 2026-01 may return
 * `Money` scalar fields as either a plain string ("19.99") OR a
 * `MoneyV2` object ({ amount: "19.99", currencyCode: "USD" }). Calling
 * `parseFloat` directly on a `MoneyV2` object silently yields NaN —
 * which would corrupt every variant price in the database. Always
 * route price-shaped fields through this helper.
 *
 * (RESEARCH.md Q1 RESOLVED.)
 */
export function toDecimal(v: unknown): number {
  if (typeof v === 'string') return parseFloat(v);
  if (typeof v === 'object' && v !== null && 'amount' in v) {
    const amount = (v as { amount: unknown }).amount;
    if (typeof amount === 'string') return parseFloat(amount);
  }
  return NaN;
}

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        handle
        description
        descriptionHtml
        vendor
        productType
        status
        tags
        updatedAt
        publishedAt
        variants(first: 10) {
          nodes {
            id
            title
            sku
            barcode
            price
            compareAtPrice
            inventoryQuantity
            availableForSale
            selectedOptions {
              name
              value
            }
          }
        }
        images(first: 10) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
        options(first: 3) {
          nodes {
            id
            name
            position
            values
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const PRODUCTS_COUNT_QUERY = /* GraphQL */ `
  query ProductsCount {
    productsCount {
      count
    }
  }
`;

export interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status?: string;
  tags?: string[];
  updatedAt?: string;
  publishedAt?: string | null;
  variants?: { nodes: ShopifyVariantNode[] };
  images?: { nodes: ShopifyImageNode[] };
  options?: { nodes: ShopifyOptionNode[] };
}

export interface ShopifyVariantNode {
  id: string;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: unknown; // String or MoneyV2 — handle via toDecimal
  compareAtPrice?: unknown;
  inventoryQuantity?: number | null;
  availableForSale?: boolean;
  selectedOptions?: { name: string; value: string }[];
}

export interface ShopifyImageNode {
  id: string;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ShopifyOptionNode {
  id: string;
  name: string;
  position?: number;
  values?: string[];
}

export interface FetchBatchResult {
  products: ShopifyProductNode[];
  endCursor: string | null;
  hasNextPage: boolean;
}

function gidToBigInt(gid: string): bigint {
  return BigInt(gid.split('/').pop()!);
}

export async function fetchProductBatch(
  session: Session,
  cursor: string | null,
  batchSize: number = 100
): Promise<FetchBatchResult> {
  const client = new shopifyClient.clients.Graphql({ session });
  const response = await client.request<{
    products: {
      nodes: ShopifyProductNode[];
      pageInfo: { endCursor: string | null; hasNextPage: boolean };
    };
  }>(PRODUCTS_QUERY, { variables: { first: batchSize, after: cursor } });

  const products = response.data?.products;
  if (!products) {
    throw new Error('ShopifyProductService: malformed GraphQL response (products missing)');
  }

  return {
    products: products.nodes,
    endCursor: products.pageInfo.endCursor,
    hasNextPage: products.pageInfo.hasNextPage,
  };
}

export async function fetchTotalCount(session: Session): Promise<number | null> {
  const client = new shopifyClient.clients.Graphql({ session });
  try {
    const response = await client.request<{
      productsCount?: { count?: number };
    }>(PRODUCTS_COUNT_QUERY);
    return response.data?.productsCount?.count ?? null;
  } catch {
    return null; // D-04: nullable; UI handles unknown totals gracefully
  }
}

export function mapToUpsertInput(node: ShopifyProductNode): ProductUpsertInput {
  return {
    shopifyId: gidToBigInt(node.id),
    title: node.title,
    handle: node.handle,
    description: node.description ?? null,
    descriptionHtml: node.descriptionHtml ?? null,
    vendor: node.vendor ?? null,
    productType: node.productType ?? null,
    status: node.status ?? 'ACTIVE',
    tags: node.tags ?? [],
    publishedAt: node.publishedAt ? new Date(node.publishedAt) : null,
    updatedAtShopify: node.updatedAt ? new Date(node.updatedAt) : null,
    variants: (node.variants?.nodes ?? []).map((v, idx) => ({
      shopifyId: gidToBigInt(v.id),
      title: v.title ?? 'Default',
      sku: v.sku ?? null,
      barcode: v.barcode ?? null,
      price: toDecimal(v.price),
      compareAtPrice: v.compareAtPrice != null ? toDecimal(v.compareAtPrice) : null,
      position: idx + 1,
      inventoryQuantity: v.inventoryQuantity ?? null,
      availableForSale: v.availableForSale ?? true,
      option1: v.selectedOptions?.[0]?.value ?? null,
      option2: v.selectedOptions?.[1]?.value ?? null,
      option3: v.selectedOptions?.[2]?.value ?? null,
    })),
    images: (node.images?.nodes ?? []).map((img, idx) => ({
      shopifyId: gidToBigInt(img.id),
      url: img.url,
      altText: img.altText ?? null,
      width: img.width ?? null,
      height: img.height ?? null,
      position: idx + 1,
    })),
    options: (node.options?.nodes ?? []).map((o) => ({
      shopifyId: gidToBigInt(o.id),
      name: o.name,
      position: o.position ?? 1,
      values: o.values ?? [],
    })),
  };
}
