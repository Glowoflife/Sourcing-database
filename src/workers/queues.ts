import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

// Queue name "acquisition" — must match the Worker name in src/workers/acquisition.worker.ts
// Each Queue must have its own IORedis connection (BullMQ requirement — see src/lib/redis.ts).
export const acquisitionQueue = new Queue("acquisition", {
  connection: createRedisConnection(),
});

// Queue name "extraction" — must match the Worker name in src/workers/extraction.worker.ts
// Separate IORedis connection required (BullMQ blocking mode constraint — see src/lib/redis.ts).
export const extractionQueue = new Queue("extraction", {
  connection: createRedisConnection(),
});
