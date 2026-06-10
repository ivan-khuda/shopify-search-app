# Plan 02-09 Summary

**Status:** complete
**Wave:** 4
**Requirements:** SYN-10, SYN-11

## What shipped

`app/api/shopify/webhook/route.ts` rewritten (~155 lines):

1. **Raw body first** (D-10): `const rawBody = await req.text();` BEFORE any `JSON.parse`
2. **HMAC validate** via `shopifyClient.webhooks.validate({ rawBody, rawRequest: req })` — NOT `utils.validateHmac` (that's for OAuth/App Proxy). 401 `invalid_hmac` on `valid: false`.
3. **Dedup** via `prisma.webhookEvent.create({ data: { eventId, shop, topic } })` with P2002 unique-violation catch (D-07) → 200 `{ ok: true, dedup: true }`
4. **Parse JSON** only after HMAC + dedup pass
5. **Topic dispatch:**
   - `products/create | products/update`: stale-event guard via `productRepository.findByShopAndHandle` — if `existing.updatedAtShopify > payload.updated_at`, return 200 `{ skipped: 'stale' }` (D-08, D-17, SYN-11). Otherwise `productRepository.upsertProduct(shop, mapWebhookPayloadToUpsertInput(payload))`.
   - `products/delete`: look up the local product via `prisma.product.findFirst({ shop, shopifyId: BigInt(payload.id) })`, then call `productRepository.deleteProduct(shop, product.id)`
   - Unknown topics: 200 `{ ignored: topic }` (already deduped; don't fail Shopify retries on unrelated topics)

`mapWebhookPayloadToUpsertInput(payload)` — REST-shape mapper distinct from the GraphQL mapper in `services/shopify/ShopifyProductService.ts`. Handles:
- numeric `payload.id` → `BigInt`
- `body_html` → `description`/`descriptionHtml`
- `tags` as comma-string OR array (defensive parse)
- `updated_at` → `updatedAtShopify` Date
- variants with `option1`/`option2`/`option3` flat fields (REST shape, not GraphQL `selectedOptions`)
- images with `src` field (REST), not `url` (GraphQL)

`ProductRepository.findByShopAndHandle(shop, handle)` added (Plan 02-05 already shipped this method as a follow-up of D-17).

## Verification

- `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` → 7/7 GREEN:
  - 401 invalid_hmac on `valid: false`
  - 200 dedup on P2002
  - products/update calls upsertProduct with mapped payload incl. `updatedAtShopify`
  - products/delete looks up product by `shopifyId` and deletes via repository
  - stale `updated_at` returns 200 `skipped: 'stale'` without calling upsertProduct
  - rawBody is read via `req.text()` BEFORE any JSON parsing (validator receives the unparsed string)
  - unknown topics return 200 `ignored: topic`
- grep gates: 1× `await req.text()`, 1× `shopifyClient.webhooks.validate`, 0× `utils.validateHmac`, 1× `P2002`, 1× `prisma.webhookEvent.create`, 1× `findByShopAndHandle`, 3× topic strings, 0× `console.log`

## Notes

The mapper is intentionally a separate function from the GraphQL mapper (in `ShopifyProductService.ts`). Webhook payloads come from the Shopify REST API, which has different field names than GraphQL: `body_html` vs `description`, `src` vs `url`, `option1/2/3` flat fields vs nested `selectedOptions`. Conflating them would either break webhooks or force the GraphQL mapper to handle both — neither is worth the savings.

Delete dispatch uses `findFirst({shop, shopifyId})` to look up the local row's `id`, then calls the repository's `deleteProduct(shop, id)`. This keeps repository's compile-time shop guard intact while accepting REST's numeric `payload.id`.

## Handoff

- The webhook handler is now ready to receive deliveries from Shopify. Webhook subscription registration is a separate manual step (D-16: declared in `shopify.app.toml` `[webhooks.subscriptions]`, registered via `bunx shopify app deploy`).
- Plan 02-11 verification: live webhook smoke test via Shopify Admin's "Resend webhook" button — confirm 200 on first delivery, 200 dedup on resend.
