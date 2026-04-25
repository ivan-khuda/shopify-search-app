## Sync strategy recommendation

Use a **two-pronged approach**:

- **Full sync** — triggered on deploy or via a cron job (e.g. Vercel Cron), calls `/api/shopify/sync`. Good for catching anything missed.
- **Webhooks** — register `products/create`, `products/update`, `products/delete` on Shopify so changes sync in near real-time.

This keeps your local DB always fresh without polling constantly.
