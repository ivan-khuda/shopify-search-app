import type { ChatIdentityAdapter } from './types';

export class EmbeddedAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await shopify.idToken();
    return { Authorization: `Bearer ${token}` };
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    return {};
  }
}
