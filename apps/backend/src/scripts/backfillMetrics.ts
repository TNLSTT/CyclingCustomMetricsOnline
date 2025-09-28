import { prisma } from '../prisma.js';
import { runMetrics } from '../metrics/runner.js';

async function main() {
  const activities = await prisma.activity.findMany({
    orderBy: { startTime: 'asc' },
  });

  const total = activities.length;
  console.log(`Computing metrics for ${total} activities...`);

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index];
    const count = index + 1;

    try {
      await runMetrics(activity.id);
      console.log(`[${count}/${total}] computed for ${activity.id}`);
    } catch (error) {
      console.error(`[${count}/${total}] failed for ${activity.id}`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error('Failed to backfill metrics', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
