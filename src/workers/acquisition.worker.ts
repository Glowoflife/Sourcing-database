import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { redis } from "@/lib/redis";
import { runAcquisitionJob } from "@/acquisition/index";
import { logger } from "@/lib/logger";

export const acquisitionWorker = new Worker(
  "acquisition", // D-06: must match Queue name in src/workers/queues.ts
  async (job: Job) => {
    const { leadId, url } = job.data as { leadId: number; url: string };
    await runAcquisitionJob({ leadId, url });
  },
  {
    connection: redis,
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
