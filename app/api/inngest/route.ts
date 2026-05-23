import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { syncProductsFunction } from '@/inngest/functions/sync-products';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction],
});
