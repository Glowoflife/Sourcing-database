// MUST be the very first import — loads DATABASE_URL and REDIS_URL before singletons initialize
import { config } from "dotenv";
config({ path: ".env.local" });

// All other imports AFTER dotenv
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { acquisitionQueue } from "@/workers/queues";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  const newLeads = await db
    .select({ id: leads.id, url: leads.url })
    .from(leads)
    .where(eq(leads.status, "New"));

  if (newLeads.length === 0) {
    logger.info({ stage: "acquire", status: "ok", message: "No New leads to enqueue" });
    await acquisitionQueue.close();
    return;
  }

  // addBulk is atomic — all jobs added or none (prevents partial enqueue on Redis error)
  await acquisitionQueue.addBulk(
    newLeads.map((lead) => ({
      name: "acquire",
      data: { leadId: lead.id, url: lead.url },
    })),
  );

  logger.info({
    stage: "acquire",
    status: "ok",
    message: `Enqueued ${newLeads.length} acquisition jobs`,
  });

  // REQUIRED: close the Redis connection so the process exits cleanly
  await acquisitionQueue.close();
}

main().catch((err) => {
  logger.error({ stage: "acquire", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
