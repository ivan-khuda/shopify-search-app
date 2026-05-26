import type { ChatIdentityAdapter } from './types';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/proxy/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};
    let visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
    return { visitor_id: visitorId };
  }
}
