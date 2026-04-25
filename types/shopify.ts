/**
 * Local product representation (used for mapping/search).
 */
export interface ShopifyProduct {
    id: string;
    title: string;
    description: string;
    price: number;
    image: string;
    link: string;
    shopifyId: string;
    shopifyHandle: string;
    shopifyTitle: string;
    shopifyDescription: string;
    shopifyPrice: number;
}

/**
 * Product status for productCreate mutation.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/enums/ProductStatus
 */
export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED" | "UNLISTED";

/**
 * SEO input for product create.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/input-objects/SEOInput
 */
export interface SEOInput {
    title?: string;
    description?: string;
}

/**
 * Product option value.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/input-objects/OptionValueCreateInput
 */
export interface OptionValueCreateInput {
    name: string;
    linkedMetafieldValue?: string;
}

/**
 * Product option (max 3 per product).
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/input-objects/OptionCreateInput
 */
export interface OptionCreateInput {
    name: string;
    values: OptionValueCreateInput[];
    position?: number;
}

/**
 * Metafield input for custom data.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/input-objects/MetafieldInput
 */
export interface MetafieldInput {
    namespace: string;
    key: string;
    value: string;
    type?: string;
    id?: string;
}

/**
 * Input for productCreate mutation.
 * Mirrors Shopify Admin API ProductCreateInput.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/input-objects/ProductCreateInput
 */
export interface ProductCreateInput {
    /** Product name displayed to customers (required for create). */
    title: string;
    /** Product description with HTML. */
    descriptionHtml?: string;
    /** Vendor name. */
    vendor?: string;
    /** Merchant-defined product type. */
    productType?: string;
    /** Unique URL handle (letters, hyphens, numbers only). */
    handle?: string;
    /** Searchable keywords. */
    tags?: string[];
    /** Visibility across sales channels. */
    status?: ProductStatus;
    /** SEO title and description. */
    seo?: SEOInput;
    /** Product options (max 3). */
    productOptions?: OptionCreateInput[];
    /** Custom metafields. */
    metafields?: MetafieldInput[];
    /** Whether product requires a selling plan (subscription). */
    requiresSellingPlan?: boolean;
    /** Theme template suffix. */
    templateSuffix?: string;
    /** Gift card template suffix. */
    giftCardTemplateSuffix?: string;
    /** Whether product is a gift card. */
    giftCard?: boolean;
    /** Collection IDs to associate. */
    collectionsToJoin?: string[];
    /** Category ID (product taxonomy). */
    category?: string;
}