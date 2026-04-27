// MUST be the very first import — loads DATABASE_URL before db singleton initializes (Pitfall 5)
import { config } from "dotenv";
config({ path: ".env.local" });

// All other imports come AFTER dotenv is configured
import { db } from "@/db/index";
import { scraperRuns } from "@/db/schema";
import { runCrawler } from "@/discovery/crawler";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import type { RunCounters } from "@/discovery/lead-writer";

/**
 * Exponential backoff retry wrapper — D-08.
 * Attempts: 3 total. Delays: 30s -> 60s -> 120s.
 */
async function runWithRetry(fn: () => Promise<void>, attempts = 3): Promise<void> {
  const delays = [30_000, 60_000, 120_000];
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      const waitSecs = delays[i] / 1000;
      logger.warn({
        stage: "run",
        status: "fail",
        message: `Attempt ${i + 1}/${attempts} failed. Retrying in ${waitSecs}s. Error: ${String(err)}`,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  logger.info({ stage: "run", status: "start", message: "Discovery run starting" });

  // Create the scraper_runs row at start — D-02
  const [run] = await db.insert(scraperRuns).values({}).returning();
  const runId = run.id;

  const counters: RunCounters = { found: 0, written: 0, skipped: 0, errored: 0 };

  try {
    await runWithRetry(async () => {
      await runCrawler(counters);
    });
  } finally {
    // Always update scraper_runs on exit — even on crash (D-02 anti-pattern mitigation)
    const durationMs = Date.now() - startedAt;
    await db
      .update(scraperRuns)
      .set({
        finishedAt: new Date(),
        leadsFound: counters.found,
        leadsWritten: counters.written,
        leadsSkipped: counters.skipped,
        leadsErrored: counters.errored,
      })
      .where(eq(scraperRuns.id, runId));

    logger.info({
      stage: "run",
      status: "ok",
      durationMs,
      message: `Run complete. found=${counters.found} written=${counters.written} skipped=${counters.skipped} errored=${counters.errored}`,
    });
  }
}

main().catch((err) => {
  logger.error({ stage: "run", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
