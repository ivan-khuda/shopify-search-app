# Feature Research

**Domain:** AI product-discovery Shopify app with embedded admin and customer-facing storefront chat drawer
**Researched:** 2026-05-22
**Confidence:** MEDIUM-HIGH (competitor feature sets from App Store listings + official docs; UX patterns from Shopify dev docs + published research; some chat-drawer micro-UX from practitioner sources rather than official references)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features merchants assume exist. Missing these means merchants won't install or will churn quickly.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time product sync with webhooks | Stale product data (wrong price, out-of-stock items appearing) is the #1 trust-killer; all major competitors (Boost, Klevu, Searchanise) provide webhook-driven incremental updates | MEDIUM | Full sync on install + `products/create|update|delete` webhook for incremental; already stubbed in codebase |
| Sync progress indicator during onboarding | Shopify's own onboarding UX guidelines mandate progress indicators for multi-step async flows; merchants need confidence the catalog is being ingested | SMALL | SSE/polling endpoint + progress bar; V1 scope already includes this |
| Typo tolerance / fuzzy matching | Shoppers misspell; any search that returns zero results on "summmer dress" fails the baseline expectation | MEDIUM | Hybrid pgvector+tsvector search covers this better than BM25 alone; `websearch_to_tsquery` handles many typo cases |
| Semantic / natural-language query understanding | "Klevu increases conversions up to 52%" specifically from NLP — merchants now consider this table stakes after Shopify's own Search & Discovery added semantic ranking in 2024 | HIGH | Core V1 deliverable: embeddings + hybrid search |
| Storefront chat widget (FAB + drawer) | The primary user-facing surface; without it the app has no storefront presence — all competitors that target "conversational AI" deliver a floating drawer | MEDIUM | Theme App Extension App Embed block pattern; already in V1 scope |
| Product cards inline in chat response | Shoppers expect to see images, prices, and product links in the answer — text-only responses with no visual product anchors feel unfinished; Rep AI, Boost, Klevu all do this | SMALL | Already in `components/chat/ProductCard`; wire to real search results |
| Zero-results handling with fallback suggestions | Nearly 50% of ecommerce sites fail on this (Baymard 2025); merchants evaluate it during trial | SMALL | Respond with "I didn't find an exact match — here are related products" rather than empty drawer; graceful LLM fallback |
| Embedded admin app | Merchants manage and evaluate from Shopify Admin; non-embedded apps feel off-platform and lack trust signals | SMALL | Already built; App Bridge shell in place |
| Onboarding → "ready" state within minutes | Leading apps advertise "5-minute setup"; Shopify UX guidelines cap onboarding at 5 steps; merchants equate long setup with high-maintenance apps | MEDIUM | Install → OAuth → sync trigger → progress → "Your store is ready" with product count |
| Completion notification after sync | Merchant closes browser during sync; email is the fallback channel to confirm readiness; Rep AI and Boost both confirm sync states | SMALL | Resend transactional email; already in V1 scope |
| Anonymous visitor identity (no login required) | Forcing login before the first chat query is the single biggest friction point in storefront apps; drops engagement by ~60% (industry benchmarks) | MEDIUM | Signed cookie visitor_id pattern; V1 scope |
| Hard usage cap / graceful rate-limit response | Merchants in free tiers expect abuse protection; uncapped free tiers create unit-economics risk that scares investors and ops teams | SMALL | Per-shop counter + "limit reached" graceful response; V1 scope |

---

### Differentiators (Competitive Advantage)

Features that could make SmartDiscovery AI competitive against Boost, Klevu, Rep AI.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Model picker in admin (merchant chooses LLM) | No competitor in the Shopify app space exposes model selection to merchants; power users on Shopify Plus want quality/cost control; positions SmartDiscovery as transparent and configurable | MEDIUM | List Vercel AI Gateway models with context window + cost-per-token; persist choice per shop; V1 scope |
| Citation-grounded product answers (RAG with evidence) | Academic research (arXiv 2503.04830) shows grounded answers improve engagement 3–10% in A/B tests; reduces hallucinations; builds merchant trust by proving answers come from their catalog not LLM imagination | MEDIUM | RAG pipeline already in plan (hybrid search → rerank → LLM with context); surface product references inline in chat response |
| Conversational multi-turn refinement with clarifying questions | Conversion rates on chatbot-assisted discovery run 20–30% higher than browse-and-filter (hellorep.ai research); competitors like Rep AI do product recommendation but lack true intent-narrowing dialogue | MEDIUM | System prompt design + conversation context passing; no new infrastructure beyond conversation persistence |
| Hybrid pgvector + tsvector search (brand/SKU precision) | Pure vector search fails on exact brand names, SKUs, and short product codes; pure BM25 fails on natural-language intent — hybrid with RRF achieves 91% recall@10 vs 65–78% for either alone | HIGH | Core V1 deliverable; differentiates from apps using Algolia-only or vector-only approaches |
| History tab (persistent conversation log) | Rep AI records chats for merchants (admin-side) but no competitor exposes customer-facing conversation history in the drawer itself; returning shoppers can resume previous searches | MEDIUM | Conversation persistence keyed by visitor_id; History tab in storefront drawer; V1 scope |
| Saved-products bookmark tab | No Shopify app in the search/discovery category offers an in-chat bookmark that persists across sessions without requiring Shopify login; small but sticky | SMALL | Our own bookmark list (not Shopify wishlist); Saved tab in drawer; V1 scope |
| Customer-id upgrade when logged in (cross-device history) | Visitors who log into the store see their saved products and history on any device — without mandating login; balances reach with stickiness | MEDIUM | `window.Shopify.customer` check at drawer init; link visitor_id → customer_id; V1 scope |
| Admin chat playground / test preview | Merchants want to stress-test the assistant before enabling it for customers; Klevu provides a "test and schedule" UI; Boost offers live preview for merchandising; an integrated playground creates confidence | SMALL | Admin chat tab is already the playground; wire to real search so demo == production behavior |

---

### Anti-Features (Deliberately Not Building in V1)

Cross-referenced against PROJECT.md Out of Scope. No contradictions introduced.

| Feature | Why Requested | Why Problematic in V1 | Alternative / When to Revisit |
|---------|---------------|----------------------|-------------------------------|
| Voice / audio input | "Hands-free search" appeal; Searchanise lists it as a differentiator | Adds Web Speech API complexity, browser compat surface area, accessibility requirements; core conversational value is already text-based; mobile keyboard is fine for V1 | Post-product-market-fit, V2; keep input text-only per PROJECT.md |
| Image-based / visual search | "Show me something like this photo" is compelling for fashion/home verticals | Requires CLIP multimodal embeddings, image ingestion pipeline, separate model hosting — 3-4x complexity increase; text embeddings already cover the dominant SMB use case | Revisit when targeting fashion vertical specifically (V3+); blocked by "no multimodal embeddings" in PROJECT.md Out of Scope |
| Personalization based on purchase/browsing history | "Amazon-style recommendations" appeal; Klevu and Findify sell this at $400+/month | A distinct product from search-by-intent; requires behavioral event logging, ML training pipeline, user profile storage — separate engineering milestone; conflates "search" and "recommendations" use cases | V2+ dedicated recommendations milestone; outside V1 scope per PROJECT.md |
| Shopify Billing API / plans / credit ledger | Merchants expect tiered pricing long-term | Billing introduces payment friction before the discovery loop is validated; premature monetization kills trial conversions | Dedicated billing milestone post-V1; V1 ships free with hard cap per PROJECT.md |
| Multi-language UI / translated drawer | International merchants expect localization | English-first is valid for SMB launch market; l10n adds translation maintenance overhead, RTL layout, and date/number formatting complexity | V1.x add-on; single English locale per PROJECT.md |
| Shopify wishlist integration / Saved Products as metafields | Merchants expect Saved to sync with native Shopify wishlist apps | Collision with installed wishlist apps creates undefined merge behavior; Shopify metafield writes require additional API scope requests | Keep Saved as our own bookmark list per PROJECT.md |
| Self-hosted / BYO LLM key option | Advanced merchants want to route to their own OpenAI org | Complicates billing, support surface, and observability; Vercel AI Gateway already provides multi-model access | V2 enterprise tier; outside V1 scope per PROJECT.md |
| Proactive exit-intent engagement (behavioral AI popup) | Rep AI's behavioral AI is cited as a key differentiator; "engage before they leave" | Aggressive popups create merchant brand risk; Shopify's App Review team flags intrusive overlays; adds behavioral tracking complexity | Consider as V2 feature with explicit merchant opt-in and strict frequency capping |
| Live agent handoff / human-in-the-loop chat | Gorgias/Tidio offer this; large merchants want escalation path | Support tooling is a different product vertical; V1 focus is product discovery, not customer support | Explicitly out of scope; recommend merchant use Gorgias/Tidio for support layer |
| Bulk Operations API for initial sync | Needed for 50k+ product catalogs | Over-engineered for the 5k SKU target in V1; Bulk Ops adds queue infrastructure and streaming complexity | Revisit when targeting enterprise catalogs (50k+ SKUs) per PROJECT.md |
| Search analytics dashboard (search term trends, zero-results report) | Klevu, Boost, and Athos Commerce all provide this as a core admin feature | Medium complexity; requires event logging pipeline distinct from the chat flow; V1 scope is already large | V1.x feature; add search event logging now as groundwork (low cost), expose UI in next milestone |

---

## Feature Dependencies

```
[Real product sync (full + incremental)]
    └──requires──> [ShopifyProductService GraphQL fetch]
    └──requires──> [ProductRepository.upsert transaction]
    └──enables──>  [Embedding generation]
                       └──requires──> [Real sync complete]
                       └──enables──>  [Hybrid search (pgvector + tsvector)]
                                          └──enables──> [Citation-grounded chat responses]
                                          └──enables──> [Product cards in storefront drawer]
                                          └──enables──> [Admin chat playground (real results)]

[Storefront FAB + drawer (Theme App Extension)]
    └──requires──> [App Proxy route /api/storefront/chat]
    └──requires──> [Anonymous visitor identity (signed cookie)]
    └──enables──>  [Conversation persistence (History tab)]
                       └──requires──> [visitor_id identity]
                       └──enables──>  [Customer-id upgrade (cross-device)]
    └──enables──>  [Saved products (bookmark list)]
                       └──requires──> [visitor_id identity]

[Model picker (admin settings)]
    └──requires──> [Vercel AI Gateway model catalog API]
    └──enables──>  [Merchant-selected model in chat]
    └──enhances──> [Admin chat playground]

[Onboarding progress UI]
    └──requires──> [Background sync job + SSE/polling status endpoint]
    └──enables──>  [Completion email via Resend]

[Hard usage cap]
    └──requires──> [Per-shop request counter in DB]
    └──blocks────> [Billing milestone (safe to defer)]
```

### Dependency Notes

- **Hybrid search requires real sync + embeddings:** The entire search quality story depends on the sync pipeline being real. Until `MOCK_PRODUCTS` is replaced, the admin playground can demo but not validate.
- **Storefront drawer requires App Proxy:** The drawer's backend calls must be HMAC-signed via App Proxy — direct calls from storefront to API routes aren't possible without CORS and auth complexity.
- **Citation grounding requires hybrid search:** LLM answers are only grounded when real product records are retrieved and passed as context. This means RAG quality is a downstream deliverable of the search pipeline.
- **History + Saved require visitor identity:** Both tabs are empty without a stable visitor_id. The anonymous cookie must be established at drawer init before any other persistence feature works.
- **Model picker enhances but doesn't block playground:** The admin playground can operate with a default model from day one; model picker adds merchant control on top.

---

## MVP Definition

### Launch With (V1)

Minimum viable product — what's needed for the "install → sync → ask → see real products" loop to close.

- [ ] Real product sync (GraphQL fetch + upsert + webhooks) — without this, no real search is possible
- [ ] Embedding generation + hybrid pgvector+tsvector search — the core quality claim
- [ ] Sync progress UI + completion email — merchant confidence that onboarding completed
- [ ] Storefront FAB + drawer (Theme App Extension + App Proxy) — the customer-facing surface
- [ ] Anonymous visitor identity — enables personalization without a login wall
- [ ] Product cards grounded in real catalog results in chat — proves the core value prop
- [ ] Conversation persistence + History tab — stickiness feature that no direct competitor surfaces in the drawer
- [ ] Saved products bookmark tab — differentiating retention hook
- [ ] Model picker in admin settings — unique differentiator; already in V1 scope
- [ ] Admin chat playground wired to real search — lets merchant validate before enabling storefront
- [ ] Hard request cap with graceful response — unit-economics protection before billing ships

### Add After Validation (V1.x)

Features to add once the core discovery loop is working and merchants are installing.

- [ ] Search analytics dashboard (zero-results, top queries, CTR) — groundwork for event logging can be laid in V1 without the UI; expose in V1.x
- [ ] Multi-language drawer (i18n) — trigger: first merchant with non-English primary storefront; architecture supports it but adds translation overhead
- [ ] A/B test framework for system prompts / model selection — trigger: enough installs to generate statistically significant data

### Future Consideration (V2+)

Features to defer until product-market fit is established.

- [ ] Personalization / recommendations engine — separate product from discovery
- [ ] Shopify Billing API + tiered plans — after discovery loop is validated
- [ ] Voice input — after mobile engagement data shows demand
- [ ] Image-based visual search — after fashion vertical becomes a meaningful segment
- [ ] Proactive exit-intent engagement — after V1 drawer proves non-intrusive brand fit
- [ ] Self-hosted / BYO-LLM-key option — enterprise tier only

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real product sync + webhooks | HIGH | MEDIUM | P1 |
| Embedding generation + hybrid search | HIGH | HIGH | P1 |
| Storefront FAB + drawer | HIGH | MEDIUM | P1 |
| Product cards grounded in real results | HIGH | SMALL | P1 |
| Onboarding progress + completion email | MEDIUM | SMALL | P1 |
| Anonymous visitor identity | HIGH | MEDIUM | P1 |
| Conversation persistence (History tab) | MEDIUM | MEDIUM | P1 |
| Saved products bookmark | MEDIUM | SMALL | P1 |
| Model picker (admin) | MEDIUM | MEDIUM | P1 |
| Admin chat playground (real results) | MEDIUM | SMALL | P1 |
| Hard usage cap | LOW (merchant) / HIGH (ops) | SMALL | P1 |
| Zero-results fallback messaging | MEDIUM | SMALL | P1 |
| Citation-grounded responses | HIGH | MEDIUM | P2 |
| Customer-id upgrade (cross-device) | MEDIUM | SMALL | P1 |
| Search analytics dashboard | MEDIUM | MEDIUM | P2 |
| Multi-language drawer | LOW (EN market) | MEDIUM | P3 |
| Voice input | LOW | HIGH | P3 |
| Image-based visual search | MEDIUM | HIGH | P3 |
| Behavioral exit-intent engagement | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for V1 launch
- P2: Should have; add in V1.x
- P3: Future consideration; V2+ or out of scope

---

## Competitor Feature Analysis

| Feature | Boost AI Search ($29+/mo) | Klevu / Athos ($449+/mo) | Rep AI ($79+/mo) | Searchanise ($19+/mo) | Our Approach |
|---------|--------------------------|--------------------------|------------------|-----------------------|--------------|
| Semantic / NLP search | Yes (AI semantic search) | Yes (NLP + intent) | Limited (product recs) | Yes (AI search) | Hybrid pgvector + tsvector — stronger than keyword-only |
| Typo tolerance | Yes | Yes | N/A | Yes | tsvector + vector similarity covers this |
| Real-time sync | Yes (webhook) | Yes (webhook) | Yes (live catalog) | Yes | Webhook incremental + full sync on install |
| Storefront chat drawer / FAB | No (search bar only) | No (search bar + filters) | Yes (full chat assistant) | No | Yes — primary differentiator vs search-bar-only tools |
| Multi-turn conversational refinement | No | No | Partial (scripted flows) | No | Yes — free-form LLM dialogue with context |
| Product cards inline in chat | N/A (results page) | N/A (results page) | Yes (carousels) | N/A | Yes — streaming chat with product card grid |
| Conversation history (customer-facing) | No | No | Admin-side only | No | Yes — History tab in drawer |
| Saved / bookmark tab | No | No | No | No | Yes — unique to our app |
| Model picker (admin) | No | No | No | No | Yes — unique differentiator |
| Admin analytics dashboard | Yes (engagement, CTR) | Yes (AI insights, A/B) | Partial (conversion) | Yes (search analytics) | V1: not shipped; groundwork laid for V1.x |
| Merchandising / pinning / boosting | Yes | Yes | No | Yes | Out of scope V1 |
| Onboarding progress + email | Not documented | Not documented | "5-min setup" claim | Not documented | Yes — progress bar + Resend email |
| Multi-language | Yes | Yes (Shopify Markets) | Yes | Yes | V1: English only |
| Pricing transparency | $29–$399/mo | $449+/mo | $79+/mo | $19+/mo | Free with hard cap; billing in V2 |

---

## UX Patterns: Storefront Chat Drawer

Based on research across Rep AI, Shopify's reference shop-chat-agent, and industry practitioner sources:

**FAB placement:** Bottom-right corner, fixed position, 56px circle with brand icon. App Embed Block injects into `<body>` closing tag via Theme App Extension — merchant toggles on/off in theme editor without code edits.

**Drawer layout:**
- Mobile: full-width bottom sheet or near-full-height slide-up panel (see PROJECT.md Image #1 reference)
- Desktop: side-panel overlay, ~380–420px wide, anchored bottom-right (see PROJECT.md Image #2 reference)
- Three tabs: Chat (active) / History / Saved — tab bar at top of drawer

**Empty state (first open):** Greeting message + 3–4 suggested prompt chips ("Find me a gift under $50", "Show me bestsellers", "I need a blue jacket"). Chips reduce blank-cursor anxiety and seed the conversation.

**No-results state:** LLM should never return a raw empty state. Instead: "I couldn't find an exact match for [query]. Here are some related products you might like:" followed by the top-K semantic nearest neighbors even if confidence is low. If zero products at all, fallback to category browsing prompt.

**Multi-turn refinement:** System prompt instructs the model to ask one clarifying question when intent is ambiguous ("Are you looking for men's or women's? What's your budget?"). Subsequent messages carry full conversation history as context — the drawer state machine never resets within a session.

**Add to cart affordance:** Product cards render below assistant messages with a primary CTA ("Add to Cart") that calls the Storefront API `cart/add.js` without leaving the chat. V1 can deep-link to the product PDP as the lower-complexity fallback if Storefront Cart API scope requires additional OAuth permission.

**Typing indicator:** Three-dot animated indicator while LLM streams — prevents "is it broken?" perception on slow models.

**Mobile vs desktop:** Same component tree, CSS breakpoints change layout. Mobile keyboard should push drawer content up (CSS `env(keyboard-inset-height)` or `dvh` units).

---

## UX Patterns: Admin Onboarding

Based on Shopify's official onboarding UX guidelines and competitor patterns:

**Max 5 steps:** Install → Connect (OAuth) → Sync Catalog → Enable Storefront → Done. Each step auto-advances when complete.

**Progress bar:** Show progress after install confirmation; hide step count during OAuth (reduces drop-off); show step count and remaining steps after OAuth completes.

**Sync step is async:** POST to `/api/shopify/sync` returns immediately; UI polls `/api/shopify/sync/status` for `{ state, processedCount, totalCount }`. Progress bar fills as products are ingested.

**Completion state:** On sync complete, show "Your store is ready — X products synced" with a primary CTA to enable the storefront drawer and a secondary CTA to open the chat playground.

**Completion email:** Sent via Resend after sync completes (or fails). Subject: "Your SmartDiscovery AI is ready — [shop_name]". Body: product count, link to admin, quick-start tips. This covers the "browser closed during sync" gap that no Shopify UX guideline addresses.

**Skip option:** Non-essential steps (e.g., model picker configuration) should be dismissible with "Set up later" to avoid blocking the critical sync → enable flow.

---

## UX Patterns: Admin Dashboard

Based on Klevu/Boost/Athos Commerce analytics features and V1 scope:

**Model picker screen:** Table of available Vercel AI Gateway models — columns: Model name, Provider, Context window, Cost/1K tokens, Best for. Radio-select with "Currently active" badge. Save button. Sensible default pre-selected (e.g., Gemini 2.5 Flash for balance of quality + cost).

**Chat playground:** Full-width chat interface identical to the storefront drawer (same shared component). Labeled "Preview mode — using your real catalog." Displays active model name. Allows merchant to test queries before enabling storefront.

**Analytics (V1.x, not V1):** Zero-results queries, top 10 search terms, conversation volume per day, click-through rate on product cards. V1 groundwork: log search events to a `SearchEvent` table; expose UI in V1.x.

---

## Sources

- [Boost AI Search & Filter — Shopify App Store](https://apps.shopify.com/product-filter-search) — feature list, 14k+ installs baseline
- [Klevu AI Search & Discovery — Shopify App Store](https://apps.shopify.com/klevu-smart-search) — enterprise tier, $449+/mo
- [Rep AI: AI Chat & Live Chat — Shopify App Store](https://apps.shopify.com/rep-ai-sales-associate) — conversational chat drawer, add-to-cart in chat
- [Searchanise Search & Filter — Shopify App Store](https://apps.shopify.com/searchanise) — SMB tier, voice search
- [Boost Commerce vs Klevu comparison](https://boostcommerce.net/platform/boost-klevu) — MEDIUM confidence, self-published
- [Athos Commerce (formerly Klevu) Data Insights](https://athoscommerce.com/products/data-insights/) — analytics dashboard feature set
- [Shopify App Onboarding UX Guidelines](https://shopify.dev/docs/apps/design/user-experience/onboarding) — official Shopify guidance
- [Shopify Theme App Extensions — About](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions) — FAB/App Embed Block pattern
- [Shopify Storefront MCP — Build an AI agent](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent) — chat bubble + drawer pattern in reference code
- [Rep AI blog: AI Shopping Assistants 2026](https://www.hellorep.ai/blog/ai-shopping-assistants) — conversion rate benchmarks
- [Rep AI blog: Conversational Search in Ecommerce](https://www.hellorep.ai/blog/conversational-search-in-ecommerce-how-ai-drives-better-product-discovery) — multi-turn refinement patterns
- [Baymard: 5 Proven UX Strategies for No Results Pages](https://baymard.com/blog/no-results-page) — no-results UX benchmark
- [arXiv 2503.04830: Cite Before You Speak — Citation Grounding in E-commerce LLM Agents](https://arxiv.org/abs/2503.04830) — A/B test evidence for grounded answers
- [Shoplyai: Best AI Search for Shopify in 2026](https://shoplyai.ai/blog/best-ai-search-for-shopify-in-2026) — category overview
- [ConversionBox: Top Ecommerce Search Features 2025](https://www.conversionbox.ai/blog/top-ecommerce-search-features-2025/) — table stakes taxonomy
- [Hybrid Search in PostgreSQL — ParadeDB](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual) — pgvector + BM25 technical benchmarks
- [Agentic commerce — Shopify news](https://www.shopify.com/news/ai-commerce-at-scale) — 2026 Shopify AI direction context

---

*Feature research for: AI product-discovery Shopify app (SmartDiscovery AI)*
*Researched: 2026-05-22*
