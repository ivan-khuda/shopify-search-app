/**
 * Stub template — replaced by Plan 08-05 with the real React Email component.
 *
 * See SyncSuccessEmail.tsx for rationale: Vite import-analysis requires the
 * file to exist before `vi.mock(...)` can intercept it. 08-05 replaces this
 * stub with the failure-styled React Email layout.
 *
 * Export surface mirrors 08-05's must_haves
 * (`SyncFailureEmail` + `SyncFailureEmailProps`).
 */
export interface SyncFailureEmailProps {
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string;
}

export function SyncFailureEmail(_props: SyncFailureEmailProps): null {
  return null;
}
