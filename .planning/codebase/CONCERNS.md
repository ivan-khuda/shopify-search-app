# Codebase Concerns

**Analysis Date:** 2026-05-22

## Tech Debt

### Incomplete Shopify Product Sync Pipeline

**Files:** `app/api/shopify/sync/route.ts`, `services/shopify/ShopifyProductService.ts`, `lib/sync/productSync.ts`, `lib/db/repositories/ProductRepository.ts`

**Issue:** The entire product synchronization chain is stubbed and non-functional. The endpoint exists to accept sync requests but executes no real sync:
- `ShopifyProductService.fetchAllProducts()` returns empty array (line 6)
- `ShopifyProductService.mapToLocalProduct()` is void and does nothing (line 9)
- `ProductRepository.upsert()` is unimplemented (line 4)
- `productSync()` is called with no actual side effects (line 42 in route.ts has TODO comment)

**Impact:** The sync API endpoint `/api/shopify/sync` accepts authenticated requests but silently does nothing. Merchants cannot populate the database with products from their Shopify store. This makes the entire product discovery feature non-functional since `MOCK_PRODUCTS` is hardcoded and never updated from real catalog data.

**Fix approach:**
1. Implement `ShopifyProductService.fetchAllProducts()` to call Shopify GraphQL API with pagination
2. Implement `ShopifyProductService.mapToLocalProduct()` to transform Shopify schema to local Product schema (handle variants, images, options, pricing)
3. Implement `ProductRepository.upsert()` to insert/update products via Prisma
4. Wire the actual `syncProducts()` call in the route (currently just returns `{ success: true }`)
5. Add error handling for partial failures (one product failing shouldn't halt entire sync)

### Webhook Handler Not Implemented

**File:** `app/api/shopify/webhook/route.ts`

**Issue:** The webhook endpoint is a stub with no implementation:
- HMAC signature verification not implemented (line 2)
- Event parsing not implemented (line 4)
- Product change sync logic not implemented (line 5)

**Impact:** Real-time product updates from Shopify (product.create, product.update, product.delete events) cannot be processed. Catalog stays out of sync with Shopify Admin until a full re-sync is triggered manually.

**Fix approach:** Implement HMAC verification using `crypto`, parse webhook event type, route to appropriate sync handler (upsert single product or delete).

### Mock Products Are Hardcoded

**File:** `components/chat/mock-products.ts`

**Issue:** Search results are driven entirely by hardcoded `MOCK_PRODUCTS` array. The chat component has logic to search against this static dataset (line 87-102 in `chat.tsx`).

**Impact:** The chat AI cannot search against real merchant products. All demo queries return the same 3 hardcoded items. After sync is implemented, this search path will need to query the database with semantic search or full-text search, not keyword matching against mock data.

**Fix approach:** Replace `buildMockResults()` in chat.tsx to query database using embeddings or full-text search instead of simple string matching on mock products.

## Security Considerations

### Console Logging of Auth Tokens and Sensitive Data

**Files:** `middleware.ts`, `app/api/auth/route.ts`, `app/api/auth/callback/route.ts`, `app/(embedded)/onboarding/page.tsx`

**Issue:** Multiple console.log statements expose sensitive information:
- Line 9, 13 in `middleware.ts`: logs raw auth headers and tokens
- Line 8, 9 in `app/api/auth/route.ts`: logs shop parameter
- Line 16 in `app/api/auth/callback/route.ts`: logs full redirect URL with shop context
- Line 13 in `app/(embedded)/onboarding/page.tsx`: logs session token

**Current mitigation:** None — tokens are logged to server logs in development and potentially retained in production.

**Risk:** If logs are centralized (DataDog, Sentry, CloudWatch) or if server logs are breached, attackers gain access to valid session tokens and shop identifiers. Tokens can be replayed to perform actions as the merchant.

**Recommendations:**
1. Remove all `console.log` statements from auth/middleware code
2. Implement structured logging with sensitive data redaction (e.g., mask tokens to last 4 chars)
3. Use a logger that supports PII masking filters in production

### Session Token Validation May Be Insufficient

**File:** `app/api/shopify/sync/route.ts`

**Issue:** The sync endpoint decodes the session token and validates the `dest` URL format (lines 15-32), but:
- No rate limiting on this endpoint
- No additional validation that the requester owns the shop (relies entirely on Shopify's session token validity)
- Token reuse is not checked (same token can make multiple requests)

**Risk:** If a token is leaked, it could be replayed indefinitely until it expires (session tokens have finite TTL). No per-request nonce or replay protection.

**Recommendations:**
1. Implement rate limiting per shop (e.g., 1 sync per 5 minutes)
2. Add request ID tracking to detect replayed requests
3. Log all sync requests with requester info for audit trail

### Middleware Auth Check Is Disabled

**File:** `middleware.ts`

**Issue:** Lines 22-32 show the actual session validation logic is commented out:
```typescript
// if (!shop) {
//   return redirectToAuth(request);
// }
// const offlineSessionId = shopifyClient.session.getOfflineId(shop);
// const session = await sessionStorage.loadSession(offlineSessionId);
// if (!session) {
//   return redirectToAuth(request, shop);
// }
```

**Impact:** Any request matching the middleware routes (see line 46, matcher is empty so middleware is not active) would not require a valid Shopify session. If the matcher is enabled without uncommenting the validation, unauthenticated users could access protected pages.

**Recommendations:**
1. Uncomment the session validation checks
2. Ensure the `config.matcher` is set correctly to protect all embedded routes
3. Add test coverage for middleware authentication (currently no test exists for positive auth case)

## Fragile Areas

### Chat Component State Management Is Client-Only

**File:** `app/(embedded)/chat/page.tsx`

**Issue:** Chat history and saved products are stored entirely in React state (lines 15-16):
```typescript
const [history, setHistory] = useState<ChatHistoryItem[]>([]);
const [savedProducts, setSavedProducts] = useState<ChatProduct[]>([]);
```

**Why fragile:** On page refresh, all history and saved products are lost. The component has no persistence layer.

**Safe modification:** To add persistence safely:
1. Use `useEffect` to load from localStorage on mount
2. Add a database table for saved products (with userId/shop foreign key)
3. Consider syncing to server on each state change (debounced)
4. Test edge cases: rapid saves, offline, server sync conflicts

**Test coverage:** The integration test in `chat.integration-test.tsx` only tests in-memory state, not persistence.

### ProductRepository Pattern Started But Never Completed

**File:** `lib/db/repositories/ProductRepository.ts`

**Issue:** A repository pattern was started with a singleton export (line 9), but:
- The class has no actual implementation (upsert is unimplemented)
- Only one method exists (no read, delete, or query methods)
- No type safety on upsert input (accepts full Product type, should validate)

**Safe modification:** Either fully implement the repository pattern with all CRUD methods and type guards, or remove it and use Prisma client directly throughout codebase to avoid the inconsistency.

## Performance Bottlenecks

### Product Search Is O(N) Keyword Matching on Client

**File:** `components/chat/chat.tsx`, lines 87-103

**Issue:** The `buildMockResults()` function filters all products in memory:
```typescript
return MOCK_PRODUCTS.filter((product) => {
    const haystack = [...all fields].join(' ').toLowerCase();
    return searchWords.some((word) => haystack.includes(word));
}).slice(0, 3);
```

**Current impact:** With only 3 mock products, performance is fine. But when connected to real database with thousands of products, this will be unacceptably slow:
- No indexing on search fields
- No semantic/embedding search (requires pgvector, which is declared in schema but never used)
- Concatenates all product text on every search (memory waste)

**Improvement path:**
1. Move search to server-side API route
2. Use full-text search (PostgreSQL `tsvector` with indexes)
3. Implement embedding-based semantic search using `ProductEmbedding.embedding` and pgvector
4. Add query timeouts (5-10 second max) to prevent slow queries

### No Lazy Loading for Chat Messages

**File:** `app/(embedded)/chat/page.tsx`

**Issue:** All chat messages are rendered in a single scrollable div (line 173) with no pagination or virtualization:
```typescript
<div className='h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4'>
    {messages.map((message) => { ... })}
</div>
```

**Impact:** With hundreds of messages, the DOM grows unbounded and rendering performance degrades. Each message re-render causes layout recalculation.

**Improvement path:** Implement windowing/virtualization using a library like `react-window` to render only visible messages.

## Scaling Limits

### Prisma Client Is Singleton, May Exhaust Connections

**File:** `lib/db/client.ts`

**Issue:** A single `PrismaClient` instance is shared across all requests:
```typescript
export const prisma = new PrismaClient({
    accelerateUrl: process.env["DATABASE_URL"]!,
});
```

**Current capacity:** Prisma Accelerate has connection pooling, but the singleton pattern can cause:
- All requests competing for the same connection pool
- Cold starts due to connection reuse across requests
- No per-request isolation

**Scaling path:** This is acceptable with Prisma Accelerate (which includes pooling), but monitor connection usage. If database queries increase 10x, consider connection pool size tuning.

### Shopify API Rate Limits Not Handled

**File:** `services/shopify/ShopifyProductService.ts`

**Issue:** Once implemented, `fetchAllProducts()` will call Shopify GraphQL API but has no rate limit handling:
- No exponential backoff on 429 errors
- No queue for batched requests
- Syncing large catalogs (10k+ products) could hit API limits and silently fail

**Improvement path:** Implement backoff strategy and request queuing before full product sync goes to production.

## Dependencies at Risk

### Unsupported pgvector in Prisma Schema

**File:** `prisma/schema.prisma`, line 122

**Issue:** ProductEmbedding.embedding uses `Unsupported("vector")` type:
```typescript
embedding Unsupported("vector")? // pgvector extension - will need raw SQL for migration
```

**Risk:** Prisma cannot generate proper types or migrations for pgvector columns. This requires hand-written SQL for migrations, making schema evolution fragile.

**Migration path:**
1. Document the raw SQL migration in `prisma/migrations/` with a `.sql` file
2. Create a separate migration tool for embedding updates (outside Prisma)
3. Or, store embeddings in a separate service (e.g., Pinecone, Weaviate) instead of PostgreSQL

### Shopify App Session Storage Package

**File:** `package.json`, line 18; `lib/shopify/session-storage.ts`

**Issue:** Using `@shopify/shopify-app-session-storage-prisma@8.0.1`. This is a pre-release/alpha package that:
- May have breaking changes in future versions
- Has limited test coverage in the broader ecosystem
- Depends on specific Prisma versions

**Risk:** Upgrading Prisma or the session storage package could break session persistence.

**Mitigation:** Pin both `@shopify/shopify-api` (12.3.0) and `@shopify/shopify-app-session-storage-prisma` (8.0.1) and test thoroughly before upgrades.

## Test Coverage Gaps

### No Tests for Database Sync Operations

**What's not tested:** 
- `ShopifyProductService.fetchAllProducts()` — no unit tests
- `ProductRepository.upsert()` — no unit tests
- `syncProducts()` orchestration — no integration tests
- Partial failure scenarios (1 product fails, others succeed) — untested

**Files:** `services/shopify/ShopifyProductService.ts`, `lib/sync/productSync.ts`, `lib/db/repositories/ProductRepository.ts`

**Risk:** Sync pipeline could silently fail (missing products, duplicates, data loss) without detection.

**Priority:** High — these are critical paths for the app's core functionality.

### No Tests for Error Handling in Chat

**What's not tested:**
- API errors from `/api/chat` endpoint
- Network failures during message send
- Malformed message payloads
- Rate limiting/quota exceeded responses

**Files:** `components/chat/chat.tsx`, `app/api/chat/route.ts`

**Risk:** Users see cryptic errors or silent failures with no recovery path.

**Priority:** Medium

### No Webhook Tests

**What's not tested:** 
- HMAC signature validation
- Event parsing and routing
- Concurrent webhook requests from same shop

**File:** `app/api/shopify/webhook/route.ts`

**Risk:** Since the endpoint is stubbed, writing tests before implementation will guide correct behavior.

**Priority:** High (before webhook implementation ships)

### Auth Middleware Test Coverage Is Incomplete

**What's not tested:**
- Valid session allows request through
- Invalid/expired token redirects to auth
- Bearer token parsing from Authorization header

**File:** `middleware.ts`

**Test file:** `__tests__/middleware.test.ts` (no test file exists)

**Risk:** Middleware auth is currently disabled (see Security Considerations), so enabling it without test coverage could break protected routes.

**Priority:** High

## Missing Critical Features

### No Rate Limiting on Sync Endpoint

**What's missing:** Merchants can trigger unlimited sync requests. With no implementation, this is harmless, but once sync is working, unbounded requests could:
- Exhaust API quotas with Shopify
- Create duplicate database records if sync is not idempotent
- Overwhelm the server during concurrent syncs

**Blocks:** Can't safely enable sync in production without rate limiting.

**Implementation:** Add per-shop rate limit (Redis or in-memory) before shipping sync feature.

### No Audit Trail for Product Changes

**What's missing:** When products are synced or updated via webhooks, no record of who triggered the change or when.

**Blocks:** Merchants cannot debug sync issues (e.g., "why is this product missing?").

**Implementation:** Add `ProductSyncLog` table with timestamp, shop, product count, errors, and triggered-by (manual sync or webhook).

### No Pagination for Saved Products

**What's missing:** If a merchant saves hundreds of products, the `SavedProductsPanel` renders them all at once without pagination.

**Blocks:** Performance degradation with large saved lists.

**Implementation:** Add pagination or infinite scroll to saved products view.

---

*Concerns audit: 2026-05-22*
