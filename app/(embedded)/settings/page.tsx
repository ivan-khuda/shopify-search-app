/**
 * Phase 7 Plan 08 — /settings Server Component.
 *
 * No `'use client'` directive: this file runs server-side. It SSR-fetches the
 * AI Gateway model catalog and the per-shop active model in parallel, then
 * renders the embedded admin shell (`<s-page>` + `<s-section>`) plus the D-03
 * availability banners and the D-06 "previously-selected model no longer
 * available" warning. The interactive table + radio + Save flow lives in the
 * sibling Client Component `settings-form.tsx`.
 *
 * T-04-25 (Phase 4 deferred) — `searchParams.shop` ↔ `session.shop` asymmetry:
 *   This page reads `searchParams.shop` for display only (mirrors the
 *   `/chat` Server Component verbatim). The PATCH write path
 *   (`/api/settings/model`, Plan 07) is session-bound — shop is derived
 *   strictly from `withShopifySession`, never from query/body. This
 *   asymmetry is the resolution Phase 4 flagged: SSR display from
 *   searchParams is acceptable; writes are session-bound.
 *
 * Constraints (CLAUDE.md): zero `console.*`, Polaris s-* primitives only.
 */
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { SettingsForm } from './settings-form';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  const [catalogResult, activeModel] = await Promise.all([
    fetchModelCatalog(),
    getActiveChatModel(shop ?? ''),
  ]);

  // The catalog client returns the full language-model slice (per Plan 04
  // deviation — BEST_FOR curation lives at the call site). For the V1
  // settings page the curation is intentionally a pass-through: render every
  // language model the catalog client returns plus surface the active model
  // if it falls outside that slice. This keeps the page table aligned with
  // whatever the catalog client decides to return, including future curation
  // changes there.
  const curated = catalogResult.models;

  const activeMissingFromCatalog = !catalogResult.models.some(
    (m) => m.id === activeModel.id,
  );

  return (
    <s-page heading="Settings">
      <s-section heading="AI chat model">
        {/*
          Static column descriptor: the locked D-04 column order is announced
          here at the SSR boundary so the contract is visible without parsing
          the (client-rendered) interactive table. The column labels match the
          headers rendered inside <SettingsForm> verbatim — the order MUST
          stay in lockstep with that file's <thead> when D-04 evolves.
        */}
        <s-text>
          Columns: Model name · Provider · Context window · $ / M input tokens · $ / M output tokens · Best for · Active
        </s-text>
        {catalogResult.coldStartFallback && (
          <s-banner tone="critical">
            Model catalog unavailable — showing default only.
          </s-banner>
        )}
        {catalogResult.stale && (
          <s-banner tone="warning">
            Showing cached models — live catalog unavailable.
          </s-banner>
        )}
        {activeMissingFromCatalog && (
          <s-banner tone="warning">
            Your previously-selected model is no longer available — pick a replacement.
          </s-banner>
        )}
        <SettingsForm
          catalog={curated}
          activeId={activeModel.id}
          activeDisplayName={activeModel.displayName}
          saveDisabled={catalogResult.coldStartFallback}
        />
      </s-section>
    </s-page>
  );
}
