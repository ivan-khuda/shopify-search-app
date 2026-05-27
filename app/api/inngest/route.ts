import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { syncProductsFunction } from '@/inngest/functions/sync-products';
import { retentionSweepFunction } from '@/inngest/functions/retention-sweep';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProductsFunction, retentionSweepFunction],
});
