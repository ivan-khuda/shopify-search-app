// Settings-redesign — shared prop types for the /settings side-nav shell and
// its section components (Tasks 8–13). Everything here must stay
// JSON-serializable: the Server Component page assembles these props and
// hands them across the RSC boundary to the client shell.
import type { ActiveChatModel } from '@/services/chat/getActiveChatModel';
import type { CatalogResult } from '@/services/chat/model-catalog';
import type { ShopSettingsBundle } from '@/lib/settings/contract';
import type { UsageSnapshot } from '@/services/settings/getUsageSnapshot';

/** Last successful sync run, summarized for the Sync & webhooks section. */
export interface LastSyncSummary {
  /** ISO instant the run started. */
  startedAt: string;
  /** ISO instant the run finished. */
  finishedAt: string;
  processedCount: number;
}

/** Webhook topic → ISO instant the topic last fired (absent = never). */
export type WebhookLastFiredMap = Record<string, string>;

export interface SettingsShellProps {
  catalog: CatalogResult;
  activeModel: ActiveChatModel;
  settings: ShopSettingsBundle;
  usage: UsageSnapshot;
  webhooks: WebhookLastFiredMap;
  lastSync: LastSyncSummary | null;
}

export interface ModelSectionProps {
  catalog: CatalogResult;
  activeModel: ActiveChatModel;
}

export interface DrawerSectionProps {
  settings: ShopSettingsBundle;
}

export interface LimitsSectionProps {
  usage: UsageSnapshot;
}

export interface WebhooksSectionProps {
  webhooks: WebhookLastFiredMap;
  lastSync: LastSyncSummary | null;
}

export interface GeneralSectionProps {
  settings: ShopSettingsBundle;
}
