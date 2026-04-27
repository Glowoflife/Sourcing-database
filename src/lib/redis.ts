import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

// maxRetriesPerRequest: null is MANDATORY for BullMQ workers.
// Without it, ioredis times out under load and BullMQ jobs stall indefinitely.
// Source: docs.bullmq.io — Worker setup example explicitly requires this option.
export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
