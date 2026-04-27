// MUST be the very first import - loads DATABASE_URL and REDIS_URL before singletons initialize
import { config } from "dotenv";
config({ path: ".env.local" });

// All other imports AFTER dotenv
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { logger } from "@/lib/logger";
import { extractionQueue } from "@/workers/queues";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  // Query all leads with status = "Crawled" - these are ready for AI extraction
  // (No stale-reconciliation needed: extraction does not use an interim Processing state)
  const crawledLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.status, "Crawled"));

  if (crawledLeads.length === 0) {
    logger.info({ stage: "extract", status: "ok", message: "No Crawled leads to enqueue" });
    await extractionQueue.close();
    process.exit(0);
  }

  // addBulk uses a Redis pipeline - commands are batched for efficiency but NOT atomic.
  await extractionQueue.addBulk(
    crawledLeads.map((lead) => ({
      name: "extract",
      data: { leadId: lead.id },
    })),
  );

  logger.info({
    stage: "extract",
    status: "ok",
    message: `Enqueued ${crawledLeads.length} extraction jobs`,
  });

  // REQUIRED: close the Redis connection so the process exits cleanly
  await extractionQueue.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ stage: "extract", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
