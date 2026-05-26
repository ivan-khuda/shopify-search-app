export interface ChatIdentityAdapter {
  endpoint: string;
  getAuthHeaders(): Promise<Record<string, string>>;
  getRequestBody(): Promise<Record<string, unknown>>;
}
