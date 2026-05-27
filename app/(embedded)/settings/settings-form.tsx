'use client';

/**
 * Phase 7 Plan 08 — /settings Client Component.
 *
 * `'use client'` rationale: this component owns three pieces of interactive
 * state — the radio selection, the column sort state, and the in-flight Save
 * flag — and it talks to two App Bridge runtime globals (`shopify.idToken()`,
 * `shopify.toast.show()`) that only exist in the browser. The Server
 * Component sibling (`page.tsx`) hydrates the catalog + active model on the
 * SSR pass and hands them in as props.
 *
 * Pitfall 1 (RESEARCH §Pitfalls) — `<s-table>` ships NO built-in sort. The
 *   sortable columns are wired by hand: a `<button>` inside each sortable
 *   header toggles `sort` state (null → asc → desc → null), and the rendered
 *   row order is derived from that state. Default (`sort === null`) preserves
 *   the catalog order handed in by the SSR parent (drives the page's table
 *   contract — third-click-returns-to-original assertion).
 *
 * Pitfall 2 — `<s-choice>` uses `selected`, not `checked`. The selected radio
 *   sets the `selected` boolean attribute via the `{...(condition ? { selected: '' } : {})}`
 *   spread idiom (boolean attrs render as empty strings in JSX).
 *
 * PATCH contract (consumed from Plan 07 `app/api/settings/model/route.ts`):
 *   - Request: PATCH `/api/settings/model`, Bearer session token,
 *     `Content-Type: application/json`, body `{ activeChatModelId: string }`
 *   - Success (200): `{ ok: true, displayName: string }` → toast
 *   - Error (4xx/5xx): `{ error: string }` → inline critical banner with the
 *     error code (D-07 — codes are intentional UX signals, not secrets)
 *
 * Constraints (CLAUDE.md): zero `console.*`, no `(window as any)` casts —
 * the ambient `shopify` global comes from `types/shopify-global.d.ts`.
 */

import { useMemo, useState } from 'react';
import type { CatalogModel } from '@/services/chat/model-catalog';

export interface SettingsFormProps {
  catalog: CatalogModel[];
  activeId: string;
  activeDisplayName?: string;
  saveDisabled?: boolean;
}

type SortKey =
  | 'contextWindow'
  | 'inputPricePerMillion'
  | 'outputPricePerMillion';

interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export function SettingsForm({
  catalog,
  activeId,
  saveDisabled = false,
}: SettingsFormProps) {
  const [selectedId, setSelectedId] = useState(activeId);
  const [sort, setSort] = useState<SortState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCatalog = catalog.some((m) => m.id === activeId);

  const rows = useMemo(() => {
    if (!sort) return catalog;
    const sorted = [...catalog].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      return sort.direction === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [catalog, sort]);

  const dirty = selectedId !== activeId;

  function toggleSort(key: SortKey) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, direction: 'asc' };
      if (cur.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  async function handleSave() {
    if (!dirty || saving || saveDisabled) return;
    setSaving(true);
    setError(null);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/settings/model', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activeChatModelId: selectedId }),
      });
      if (res.ok) {
        const body = (await res.json()) as { ok: boolean; displayName: string };
        shopify.toast.show(`Model updated to ${body.displayName}`);
      } else {
        const body = await res.json().catch(() => ({}) as { error?: string });
        setError(body.error ?? 'save_failed');
      }
    } catch {
      setError('network_error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <s-banner tone="critical">Save failed: {error}</s-banner>
      )}
      {!inCatalog && (
        <s-banner tone="warning">
          Your previously-selected model is no longer available — pick a replacement.
        </s-banner>
      )}
      <s-choice-list name="active-model" value={selectedId}>
        <s-table>
          <thead>
            <tr>
              <th>Model name</th>
              <th>Provider</th>
              <th>
                <button type="button" onClick={() => toggleSort('contextWindow')}>
                  Context window
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('inputPricePerMillion')}
                >
                  $ / M input tokens
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('outputPricePerMillion')}
                >
                  $ / M output tokens
                </button>
              </th>
              <th>Best for</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} data-row-id={m.id}>
                <td>{m.displayName}</td>
                <td>{m.provider}</td>
                <td>{m.contextWindow.toLocaleString()}</td>
                <td>${m.inputPricePerMillion.toFixed(2)}</td>
                <td>${m.outputPricePerMillion.toFixed(2)}</td>
                <td>{m.bestFor}</td>
                <td>
                  <s-choice
                    value={m.id}
                    aria-label={`Select ${m.displayName}`}
                    {...(selectedId === m.id ? { selected: '' } : {})}
                    onClick={() => setSelectedId(m.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </s-table>
      </s-choice-list>
      {dirty && !saveDisabled && (
        <ui-save-bar id="settings-save-bar" discardConfirmation="">
          <button
            type="button"
            onClick={handleSave}
            {...(saving ? { loading: '' } : {})}
          >
            Save
          </button>
          <button type="button" onClick={() => setSelectedId(activeId)}>
            Discard
          </button>
        </ui-save-bar>
      )}
    </>
  );
}
