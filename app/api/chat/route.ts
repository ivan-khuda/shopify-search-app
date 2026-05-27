/**
 * POST /api/chat — Admin-facing AI search concierge (Phase 4).
 *
 * Requirements:
 *   - ADM-06: Grounded chat results sourced from SearchService.hybridSearch
 *     (real merchant catalog), never from any client-side mock list.
 *   - EMB-07: This route does not reference any client-side mock product list;
 *     product results are produced by the searchCatalog tool call against
 *     pgvector + tsvector.
 *
 * Decisions locked:
 *   - D-04: Tool-call-only wiring. The route does NOT pre-search; the LLM
 *     decides when to invoke searchCatalog. stopWhen=stepCountIs(3) gives one
 *     tool round-trip plus an answer with safety margin.
 *   - D-05: Single tool keyed 'searchCatalog' (camelCase, singular). The tool
 *     accepts only { query, priceMin?, priceMax? } — no shop, no tags, no
 *     vendor. Vercel AI SDK v6 uses `inputSchema` (NOT `parameters`).
 *   - D-07: Price-only structured filters in V1. The system prompt instructs
 *     the LLM to extract price phrases ("under $X", "between $A and $B",
 *     "around $X") into priceMin/priceMax and strip them from the natural-
 *     language query before invoking the tool.
 *   - D-10: AI Gateway is the sole runtime entry point for chat completions.
 *     The model id is a plain string ('google/gemini-2.5-flash') routed via
 *     `process.env.AI_GATEWAY_API_KEY` by the `ai` package's bundled gateway
 *     provider — no direct provider SDK import, no provider helper call.
 *
 * Security:
 *   - Multi-tenancy lock (T-04-07 / T-04-09 / T-04-13):
 *     `shop` is sourced from `withShopifySession` and captured in the tool's
 *     execute closure. The LLM cannot specify or override the shop — the Zod
 *     inputSchema does not declare a `shop` field, and the closure variable
 *     shadows any hallucinated arg.
 *   - SQL/Prompt injection bottleneck (T-04-08):
 *     Tool args are validated by Zod (query: string 1..500, priceMin/priceMax:
 *     optional number). SearchService passes `query` through Prisma tagged-
 *     template binding — never string concatenation.
 *   - Secret-leak lock (T-04-10):
 *     Zero log statements in this file. AI_GATEWAY_API_KEY is read implicitly
 *     by the `ai` package; it is never referenced in source.
 *   - DoS lock (T-04-11):
 *     Zod inputSchema caps `query` at 500 chars. AI Gateway and the Phase 8
 *     hard cap (CAP-01/02/03) layer atop this.
 *
 * v6 lock (Pitfall 1):
 *   The tool uses `inputSchema` with a real z.object schema. The legacy v5
 *   field name MUST NOT appear in this file.
 */
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import dedent from 'dedent';
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { hybridSearch } from '@/services/search/SearchService';

export const POST = withShopifySession(async ({ shop, req }) => {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const model = await getActiveChatModel(shop);

  const system = dedent`
    You are a product search assistant for ${shop}.
    Always call the \`searchCatalog\` tool before recommending products — never invent products from memory.
    When the user mentions a price phrase like "under $X", "between $A and $B", or "around $X" (interpret ±20%), extract it into the \`priceMin\`/\`priceMax\` tool args.
    Strip the price phrase from the natural-language \`query\` so the embedding/lexical signal does not waste tokens on it.
    Present 3–5 top matches with a brief "Why this fits" note.
    If the tool returns no products, say "I couldn't find anything matching that" — do not invent products.
    Never mention internal cost, margin, or SKU patterns; results are customer-facing only.
  `;

  const result = streamText({
    model: model.id,
    system,
    messages: await convertToModelMessages(messages),
    tools: {
      searchCatalog: tool({
        description: dedent`
          Search the merchant's catalog by natural-language query plus optional price filters.
          Returns up to 10 matching products with title, description, price range, image, and tags.
          Always call this before recommending products.
        `,
        inputSchema: z.object({
          query: z.string().min(1).max(500).describe('Natural-language search query'),
          priceMin: z.number().optional().describe('Minimum price filter (USD)'),
          priceMax: z.number().optional().describe('Maximum price filter (USD)'),
        }),
        execute: async ({ query, priceMin, priceMax }) => {
          return hybridSearch(shop, query, { priceMin, priceMax });
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
});
