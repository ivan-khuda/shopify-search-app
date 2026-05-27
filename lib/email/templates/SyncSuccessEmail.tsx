/**
 * Stub template — replaced by Plan 08-05 with the real React Email component.
 *
 * Plan 08-04 lands the EmailService wrapper, which imports this module by
 * path. Vite's import-analysis transform pre-resolves the import at file
 * load time, BEFORE `vi.mock('@/lib/email/templates/SyncSuccessEmail', ...)`
 * intercepts it — so the file must exist on disk even though tests never
 * call into it. 08-05 replaces this file with the full React Email layout.
 *
 * Keep the export surface aligned with 08-05's must_haves
 * (`SyncSuccessEmail` + `SyncSuccessEmailProps`) so the type-check passes.
 */
export interface SyncSuccessEmailProps {
  shop: string;
  productCount: number;
  adminUrl: string;
}

export function SyncSuccessEmail(_props: SyncSuccessEmailProps): null {
  return null;
}
