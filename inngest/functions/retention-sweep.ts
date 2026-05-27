/**
 * Weekly conversation retention sweep (D-07).
 *
 * Deletes Conversation rows older than 180 days. Runs every Sunday at
 * 03:00 UTC via Inngest cron. Bounded at 100 batches per invocation
 * (100k rows max) — if the dataset exceeds that in one week, the next
 * week's cron picks up the rest (acceptable per D-07).
 *
 * Pitfall 6: `DELETE … WHERE id IN (...)` is naturally idempotent —
 * already-deleted rows just delete 0; no explicit lock needed across
 * Inngest's at-least-once retries.
 *
 * No console.* logging. The function returns { totalDeleted, cutoff }
 * which Inngest persists in step memoization — that is sufficient
 * observability without leaking row identifiers.
 */
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';

export const retentionSweepFunction = inngest.createFunction(
  {
    id: 'conversation-retention-sweep',
    triggers: [{ cron: '0 3 * * 0' }],
    retries: 2,
  },
  async () => {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    // We deliberately do not wrap the loop in step.run — InngestTestEngine
    // treats nested step.run as deferred work, returning before the second
    // batch can drain. DELETE … WHERE id IN (...) is naturally idempotent
    // (Pitfall 6), so Inngest's at-least-once retries replay the whole
    // function safely: previously-deleted rows just delete 0 the second time.
    for (let i = 0; i < 100; i++) {
      const rows = await prisma.conversation.findMany({
        where: { lastMessageAt: { lt: cutoff } },
        select: { id: true },
        take: 1000,
      });
      if (rows.length === 0) break;
      const result = await prisma.conversation.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      totalDeleted += result.count;
      if (result.count < 1000) break;
    }

    return { totalDeleted, cutoff: cutoff.toISOString() };
  }
);
