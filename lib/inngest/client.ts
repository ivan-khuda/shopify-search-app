/**
 * Singleton Inngest client. Both the serve handler (app/api/inngest/route.ts)
 * and any code that fires events (e.g. app/api/shopify/sync/route.ts) import
 * from here. Env vars INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY / INNGEST_DEV
 * are read by Inngest internally (D-12).
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'smartdiscovery-ai' });
