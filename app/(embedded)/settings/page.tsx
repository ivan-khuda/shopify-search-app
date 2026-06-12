/**
 * Settings-redesign Task 8 — /settings Server Component.
 *
 * No `'use client'` directive: this file runs server-side. It SSR-fetches in
 * parallel everything the side-nav shell's five sections need — model catalog,
 * per-shop active model, the full ShopSettings bundle, the usage snapshot
 * (shared with GET /api/settings/usage via getUsageSnapshot), the webhook
 * last-fired map, and the last successful sync run — then hands the bundle to
 * the client shell (`settings-shell.tsx`).
 *
 * T-04-25 (Phase 4 deferred) — `searchParams.shop` ↔ `session.shop` asymmetry:
 *   This page reads `searchParams.shop` to scope the SSR reads only (mirrors
 *   the `/chat` Server Component verbatim). All write paths
 *   (`/api/settings/model`, `/api/settings/shop`, `/api/settings/appearance`)
 *   are session-bound — shop is derived strictly from `withShopifySession`,
 *   never from query/body. SSR reads from searchParams are acceptable;
 *   writes are session-bound.
 *
 * Constraints (CLAUDE.md): zero `console.*`.
 */
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { getShopSettings } from '@/services/settings/getShopSettings';
import { getUsageSnapshot } from '@/services/settings/getUsageSnapshot';
import { SettingsShell } from './settings-shell';
import type { LastSyncSummary, WebhookLastFiredMap } from './sections/types';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop: shopFromQuery } = await searchParams;
  // WR-01: searchParams.shop is attacker-controllable on direct navigation.
  // Mirror the `.myshopify.com` hostname validation that the session-token
  // path applies (lib/shopify/server-resolve-shop.ts) before letting the
  // query value drive shop-scoped reads (model, settings, usage, webhooks,
  // sync history).
  const shop =
    shopFromQuery && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopFromQuery)
      ? shopFromQuery
      : '';

  const [catalog, activeModel, settings, usage, webhookRows, lastSyncRow] =
    await Promise.all([
      fetchModelCatalog(),
      getActiveChatModel(shop),
      getShopSettings(shop),
      getUsageSnapshot(shop),
      shop
        ? prisma.webhookEvent.groupBy({
            by: ['topic'],
            where: { shop },
            _max: { receivedAt: true },
          })
        : Promise.resolve([]),
      shop
        ? prisma.syncRun.findFirst({
            where: { shop, state: 'succeeded' },
            orderBy: { finishedAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);

  // Webhook topic → ISO last-fired. Serialized to strings at the RSC boundary.
  const webhooks: WebhookLastFiredMap = {};
  for (const row of webhookRows) {
    if (row._max.receivedAt) {
      webhooks[row.topic] = row._max.receivedAt.toISOString();
    }
  }

  const lastSync: LastSyncSummary | null = lastSyncRow?.finishedAt
    ? {
        startedAt: lastSyncRow.startedAt.toISOString(),
        finishedAt: lastSyncRow.finishedAt.toISOString(),
        processedCount: lastSyncRow.processedCount,
      }
    : null;

  return (
    <SettingsShell
      catalog={catalog}
      activeModel={activeModel}
      settings={settings}
      usage={usage}
      webhooks={webhooks}
      lastSync={lastSync}
    />
  );
}
