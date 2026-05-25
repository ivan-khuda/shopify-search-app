// Phase 4 RED scaffold for ADM-05 / D-09. Implementation target: services/chat/getActiveChatModel.ts (created in plan 04-02).
import { describe, it, expect } from 'vitest';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';

describe('getActiveChatModel', () => {
  it("returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' } for any shop", async () => {
    const result = await getActiveChatModel('any-shop.myshopify.com');
    expect(result).toEqual({
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    });
  });

  it('returns the same constant for two different shops (Phase 4 is shop-agnostic by design; Phase 7 will diverge)', async () => {
    const a = await getActiveChatModel('shop-a.myshopify.com');
    const b = await getActiveChatModel('shop-b.myshopify.com');
    expect(a).toEqual(b);
  });

  it('id field is the AI Gateway provider/model namespaced string format', async () => {
    const result = await getActiveChatModel('shop.myshopify.com');
    expect(result.id).toMatch(/^[a-z-]+\/[a-z0-9.-]+$/);
  });
});
