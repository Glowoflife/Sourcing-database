import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { runExtractionJob } from "@/extraction/index";
import { logger } from "@/lib/logger";
import { createRedisConnection } from "@/lib/redis";
import { ExtractionJobSchema } from "@/schemas/extraction";

export const extractionWorker = new Worker(
  "extraction", // must match Queue name in src/workers/queues.ts
  async (job: Job) => {
    const parsed = ExtractionJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new Error(`Invalid job data for job ${job.id}: ${parsed.error.message}`);
    }
    await runExtractionJob(parsed.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5, // IO-bound (waiting for LLM response); GPT-4o-mini Tier 1: 500 RPM / 200,000 TPM
  },
);

extractionWorker.on("completed", (job: Job) => {
  logger.info({
    stage: "worker",
    status: "ok",
    leadId: job.data.leadId,
    message: `Job ${job.id} completed`,
  });
});

extractionWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({
    stage: "worker",
    status: "fail",
    leadId: job?.data?.leadId,
    message: `Job ${job?.id} failed: ${err.message}`,
  });
});
