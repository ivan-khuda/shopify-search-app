/**
 * POST /api/proxy/chat — Storefront AI search concierge (Phase 6, D-21).
 *
 * Wraps the admin /api/chat pattern with App Proxy HMAC, IDN-02 customer_id
 * cross-check (enforced at the wrapper layer by withAppProxyHmac), rate
 * limiting, conversation lifecycle, and the D-19 atomic onFinish persist.
 *
 * Security:
 *   - STR-04: HMAC validation via withAppProxyHmac. shop comes from the
 *     validated signed query — never from raw URL or body.
 *   - IDN-02: Body customer_id (when present) MUST match the signed
 *     logged_in_customer_id. The wrapper enforces this at request entry;
 *     this handler additionally asserts the match before any DB write.
 *   - Multi-tenancy lock: every Prisma query filters by shop from the
 *     wrapper closure. searchCatalog tool execute closure captures shop;
 *     the LLM cannot hallucinate a different shop (inputSchema does not
 *     declare a shop field).
 *   - Pitfall 3: Mid-stream failure does NOT write the user message —
 *     onFinish only fires on stream-complete. The client retains the
 *     prompt for retry.
 *
 * v6 lock (Pitfall 1): tool uses inputSchema; response is
 * toUIMessageStreamResponse — toAIStreamResponse (v5) must not appear.
 *
 * Hard cap (Phase 8): D-21 step 4 enforces CAP-02/03 via tryConsumeRequest
 * after HMAC + customer-id + rate-limit gates, before conversation lifecycle.
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
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { mergeVisitorIntoCustomer } from '@/lib/identity/merge';
import { prisma } from '@/lib/db/client';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { hybridSearch } from '@/services/search/SearchService';
import { tryConsumeRequest } from '@/services/chat/CapService';
import { capReachedResponse } from '@/lib/chat/cap-reached-response';

function assertCustomerMatch(
  bodyCustomerId: string | undefined,
  signed: string | null
): true | 'customer_id_mismatch' {
  const a = bodyCustomerId || null;
  const b = signed || null;
  if (a === null && b === null) return true;
  if (a !== null && b !== null && a === b) return true;
  return 'customer_id_mismatch';
}

function extractUserText(msg: UIMessage): string {
  const parts = (msg as unknown as { parts?: unknown[] }).parts;
  if (!parts || !Array.isArray(parts)) return '';
  return parts
    .map((p: unknown) => {
      if (p && typeof p === 'object' && (p as { type?: string }).type === 'text') {
        return (p as { text?: string }).text ?? '';
      }
      return '';
    })
    .join('')
    .trim();
}

export const POST = withAppProxyHmac(async ({ shop, query, req }) => {
  const body = (await req.json()) as {
    messages: UIMessage[];
    visitor_id?: string;
    customer_id?: string;
    conversation_id?: string;
  };

  if (!body.visitor_id) {
    return Response.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const signedCustomerId = query.get('logged_in_customer_id');
  const match = assertCustomerMatch(body.customer_id, signedCustomerId);
  if (match !== true) {
    return Response.json({ error: match }, { status: 403 });
  }

  const rl = rateLimit(body.visitor_id, 'chat');
  if (!rl.ok) {
    return Response.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  // D-21 step 4 / D-14: hard cap (CAP-02/03). Last gate before AI Gateway.
  const consume = await tryConsumeRequest(shop);
  if (!consume.allowed) return capReachedResponse();

  // D-21 steps 6 + 7: conversation lifecycle + merge.
  let conversationId: string;
  if (body.conversation_id) {
    conversationId = body.conversation_id;
  } else {
    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
    const rawText = lastUser ? extractUserText(lastUser) : '';
    const truncated = rawText.slice(0, 60);
    const title = truncated.length > 0 ? truncated : '(no title)';
    const created = await prisma.conversation.create({
      data: {
        shop,
        visitorId: body.visitor_id,
        customerId: body.customer_id ?? null,
        title,
        messages: [],
      },
    });
    conversationId = created.id;
  }

  if (body.customer_id) {
    await mergeVisitorIntoCustomer(shop, body.visitor_id, body.customer_id);
  }

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
    messages: await convertToModelMessages(body.messages),
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
    // D-19: atomic single-row append on stream completion. Mid-stream abort
    // means onFinish never fires → user message not persisted, retry-friendly.
    onFinish: async ({ response }) => {
      const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
      const newTurns: unknown[] = [];
      if (lastUser) newTurns.push(lastUser);
      const respMessages = (response as { messages?: unknown[] }).messages;
      if (Array.isArray(respMessages)) {
        newTurns.push(...respMessages);
      }
      await prisma.conversation.update({
        where: { id: conversationId, shop } as never,
        data: {
          messages: newTurns as never,
          lastMessageAt: new Date(),
        },
      });
    },
  });

  return result.toUIMessageStreamResponse();
});
