import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

// TODO(02-06): import syncProductsFunction from '@/inngest/functions/sync-products'
// and add to functions array once Plan 06 lands.
export const { GET, POST, PUT } = serve({ client: inngest, functions: [] });
