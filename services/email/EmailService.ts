/**
 * EmailService — thin, typed wrapper over `resend.emails.send` used by the
 * onboarding sync Inngest function (Phase 8, plans 08-11 / 08-12) to deliver
 * "Catalog sync complete" and "Catalog sync failed" notifications.
 *
 * Contract anchors (Phase 8):
 *  - NOT-04: `from` is read from `process.env.RESEND_FROM_ADDRESS` at module
 *            load time — never from caller args. This guarantees envelope
 *            sender stays env-scoped (one verified domain per environment),
 *            never per-shop.
 *  - D-04 idempotency: the idempotency key MUST live in the SECOND-ARG
 *            options bag (`{ idempotencyKey }`), NOT in the headers field.
 *            Resend dedupes on the options-bag form; the headers form is
 *            silently ignored. Key shape: `sync-{success|failure}/{syncRunId}`.
 *  - Assumption A4: Failures must bubble. When `result.error` is truthy we
 *            throw `Error('Resend send failed: ...')` so the calling
 *            `inngest.step.run` sees a rejection and retries. Swallowing the
 *            error would silently drop emails.
 *  - CLAUDE.md + Pitfall 6: Zero `console.*` in this file. Never log
 *            `args.to`, `args.errorMessage`, or the `RESEND_API_KEY`.
 *
 * Initialization choices:
 *  - `new Resend(process.env.RESEND_API_KEY!)` at module scope so unit tests
 *    can `vi.mock('resend', ...)` and intercept the singleton's `.emails.send`.
 *  - `FROM` resolved once at module load — deploy-time misconfiguration
 *    (missing env var) surfaces loudly via `!` rather than silently sending
 *    from `undefined`.
 */
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { SyncSuccessEmail } from '@/lib/email/templates/SyncSuccessEmail';
import { SyncFailureEmail } from '@/lib/email/templates/SyncFailureEmail';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_ADDRESS!;

export interface SendSyncSuccessArgs {
  to: string;
  shop: string;
  productCount: number;
  adminUrl: string;
  /** Suffix for the Resend idempotency key (D-04: `sync-success/${syncRunId}`). */
  syncRunId: string;
}

export async function sendSyncSuccess(args: SendSyncSuccessArgs): Promise<void> {
  const html = await render(
    SyncSuccessEmail({
      shop: args.shop,
      productCount: args.productCount,
      adminUrl: args.adminUrl,
    }),
  );
  const result = await resend.emails.send(
    {
      from: FROM,
      to: args.to,
      subject: `Catalog sync complete — ${args.productCount} products`,
      html,
    },
    { idempotencyKey: `sync-success/${args.syncRunId}` },
  );
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message ?? 'unknown'}`);
  }
}

export interface SendSyncFailureArgs {
  to: string;
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string;
}

export async function sendSyncFailure(args: SendSyncFailureArgs): Promise<void> {
  const html = await render(
    SyncFailureEmail({
      shop: args.shop,
      syncRunId: args.syncRunId,
      errorMessage: args.errorMessage,
      retryUrl: args.retryUrl,
    }),
  );
  const result = await resend.emails.send(
    {
      from: FROM,
      to: args.to,
      subject: 'Catalog sync failed',
      html,
    },
    { idempotencyKey: `sync-failure/${args.syncRunId}` },
  );
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message ?? 'unknown'}`);
  }
}
