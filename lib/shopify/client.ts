import '@shopify/shopify-api/adapters/web-api';
import { ApiVersion, shopifyApi } from '@shopify/shopify-api';
import { sessionStorage } from './session-storage';

export const shopifyClient = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: ['read_products'],
  hostName: process.env.HOST!,
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: true,
  sessionStorage,
});
