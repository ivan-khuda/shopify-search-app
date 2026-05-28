/**
 * Phase 8 Wave 0 RED scaffold — anchors CAP-03 + D-13 (graceful streamed message).
 *
 * Pins the capReachedResponse helper contract:
 *   - returns a Response with HTTP status 200 (NOT 4xx — D-10)
 *   - body is an AI SDK v6 UI-message stream
 *   - chunk types appear in order: 'start', 'text-start', 'text-delta', 'text-end', 'finish'
 *   - text-delta(s) concatenate to the exported CAP_REACHED_MESSAGE constant
 *
 * Implementation lands in Plan 08-09 at lib/chat/cap-reached-response.ts.
 *
 * Note: we import CAP_REACHED_MESSAGE from the same module to lock the text-emitted
 * payload === exported constant, so the test stays correct when implementation refines
 * the exact copy (so long as the constant is the single source of truth).
 */
import { describe, it, expect } from 'vitest';

describe('capReachedResponse (CAP-03 / D-13)', () => {
  it('returns HTTP 200 (not 4xx) — chat UI handles as a normal response (D-10)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-09).
    const { capReachedResponse } = await import('@/lib/chat/cap-reached-response');
    const response: Response = capReachedResponse();
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });

  it('exports a CAP_REACHED_MESSAGE constant', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const mod = await import('@/lib/chat/cap-reached-response');
    expect(typeof mod.CAP_REACHED_MESSAGE).toBe('string');
    expect(mod.CAP_REACHED_MESSAGE.length).toBeGreaterThan(0);
  });

  it('streamed body emits the v6 chunk sequence start → text-start → text-delta → text-end → finish', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { capReachedResponse } = await import('@/lib/chat/cap-reached-response');
    const response: Response = capReachedResponse();
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();

    // Order assertions — each chunk type must appear, and indices must be ascending.
    const startIdx = raw.indexOf('"start"');
    const textStartIdx = raw.indexOf('"text-start"');
    const textDeltaIdx = raw.indexOf('"text-delta"');
    const textEndIdx = raw.indexOf('"text-end"');
    const finishIdx = raw.indexOf('"finish"');

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(textStartIdx).toBeGreaterThan(startIdx);
    expect(textDeltaIdx).toBeGreaterThan(textStartIdx);
    expect(textEndIdx).toBeGreaterThan(textDeltaIdx);
    expect(finishIdx).toBeGreaterThan(textEndIdx);
  });

  it('text-delta chunk(s) carry the CAP_REACHED_MESSAGE payload', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const mod = await import('@/lib/chat/cap-reached-response');
    const { capReachedResponse, CAP_REACHED_MESSAGE } = mod;
    const response: Response = capReachedResponse();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();

    // Extract every text-delta chunk's delta value (JSON-encoded inside the stream).
    // Tolerate either SSE framing or NDJSON: scan all JSON objects in the stream.
    const deltaMatches = Array.from(raw.matchAll(/"delta"\s*:\s*"((?:[^"\\]|\\.)*)"/g));
    expect(deltaMatches.length).toBeGreaterThan(0);

    const concatenated = deltaMatches
      .map((m) => JSON.parse(`"${m[1]}"`) as string)
      .join('');
    expect(concatenated).toBe(CAP_REACHED_MESSAGE);
  });

  it('CAP_REACHED_MESSAGE mentions the monthly limit + the 1st-of-month reset (user-facing copy contract)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — RED scaffold.
    const { CAP_REACHED_MESSAGE } = await import('@/lib/chat/cap-reached-response');
    expect(CAP_REACHED_MESSAGE).toMatch(/month/i);
    expect(CAP_REACHED_MESSAGE).toMatch(/limit/i);
    expect(CAP_REACHED_MESSAGE).toMatch(/1st/i);
  });
});
