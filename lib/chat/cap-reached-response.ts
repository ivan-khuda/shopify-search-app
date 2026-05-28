/**
 * Cap-reached synthetic chat response (Phase 8 — CAP-03 / D-13).
 *
 * Single helper consumed by both /api/chat (admin) and /api/proxy/chat
 * (storefront) when CapService.tryConsumeRequest returns { allowed: false }.
 *
 * Decisions locked:
 *   - D-10: HTTP status is 200 (not 4xx). The chat UI treats this as a normal
 *     assistant message; the user sees the cap copy inline rather than an
 *     error toast.
 *   - D-13: The response is a streamed AI SDK v6 UI message — the same shape
 *     emitted by `streamText(...).toUIMessageStreamResponse()` — so existing
 *     `useChat` consumers handle it without branching on a special envelope.
 *   - CAP_REACHED_MESSAGE is a single locked constant shared across admin +
 *     storefront for V1 (Open Question 1 resolution). Future Phase 9 may
 *     specialize per-surface; until then, both routes import this constant.
 *
 * Security (T-08-09-I1): the message is a static string with zero
 * interpolation — no risk of leaking shop identity or session state.
 *
 * Anti-pattern avoided (Pitfall 5 / Anti-Pattern 2):
 *   Does NOT call streamText — there is no LLM round-trip on cap-reached.
 *   The 5-chunk sequence is synthesized directly using v6's chunk taxonomy:
 *     start → text-start → text-delta → text-end → finish
 *   The id passed to text-start / text-delta / text-end is the same
 *   generateId() value so chunks correlate (Pitfall 5).
 */
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';

export const CAP_REACHED_MESSAGE =
  "You've reached this month's message limit. It resets on the 1st of the month. To raise your limit, contact support.";

export function capReachedResponse(): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = generateId();
      writer.write({ type: 'start', messageId: id });
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: CAP_REACHED_MESSAGE });
      writer.write({ type: 'text-end', id });
      writer.write({ type: 'finish' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
