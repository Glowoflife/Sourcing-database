import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

// Queue name "acquisition" — must match the Worker name in src/workers/acquisition.worker.ts
export const acquisitionQueue = new Queue("acquisition", {
  connection: redis,
});
