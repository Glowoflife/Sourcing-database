// MUST be the very first import — loads REDIS_URL and DATABASE_URL before singletons initialize
import { config } from "dotenv";
config({ path: ".env.local" });

// All other imports AFTER dotenv
import { acquisitionWorker } from "@/workers/acquisition.worker";
import { extractionWorker } from "@/workers/extraction.worker";
import { logger } from "@/lib/logger";

logger.info({ stage: "worker", status: "start", message: "Acquisition worker process started (concurrency: 3)" });
logger.info({ stage: "worker", status: "start", message: "Extraction worker process started (concurrency: 5)" });

// Graceful shutdown — allow in-flight jobs to complete before exit
async function shutdown(): Promise<void> {
  logger.info({ stage: "worker", status: "ok", message: "Shutting down worker..." });
  await acquisitionWorker.close();
  await extractionWorker.close();
  logger.info({ stage: "worker", status: "ok", message: "Worker shut down cleanly" });
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });
