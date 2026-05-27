// scripts/cleanup-conversations.ts
//
// D-07 fallback: manual conversation retention sweep.
//
// Mirrors inngest/functions/retention-sweep.ts but runs synchronously
// without Inngest's scheduler. Use cases:
//   - Pre-Inngest-enabled environments (e.g. local dev without inngest dev)
//   - Stuck cron — operator runs this once to drain
//
// The Inngest cron remains the primary mechanism; this script is the
// documented escape hatch.
//
// Invoke via: `bun run script:cleanup-conversations`

import 'dotenv/config';
import { prisma } from '@/lib/db/client';

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  let totalDeleted = 0;

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

  console.log(
    `Deleted ${totalDeleted} conversations older than 180 days (cutoff: ${cutoff.toISOString()})`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
