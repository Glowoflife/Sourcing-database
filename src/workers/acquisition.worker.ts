import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { runAcquisitionJob } from "@/acquisition/index";
import { AcquisitionJobSchema } from "@/acquisition/types";
import { logger } from "@/lib/logger";

export const acquisitionWorker = new Worker(
  "acquisition", // D-06: must match Queue name in src/workers/queues.ts
  async (job: Job) => {
    const parsed = AcquisitionJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new Error(`Invalid job data for job ${job.id}: ${parsed.error.message}`);
    }
    await runAcquisitionJob(parsed.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: 3, // D-06: 3 concurrent Playwright workers
  },
);

acquisitionWorker.on("completed", (job: Job) => {
  logger.info({
    stage: "worker",
    status: "ok",
    leadId: job.data.leadId,
    message: `Job ${job.id} completed`,
  });
});

acquisitionWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({
    stage: "worker",
    status: "fail",
    leadId: job?.data?.leadId,
    message: `Job ${job?.id} failed: ${err.message}`,
  });
});
