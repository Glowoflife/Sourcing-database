import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

// maxRetriesPerRequest: null is MANDATORY for BullMQ workers.
// Without it, ioredis times out under load and BullMQ jobs stall indefinitely.
// Source: docs.bullmq.io — Worker setup example explicitly requires this option.
//
// Each Queue and Worker MUST use a separate IORedis connection — BullMQ workers
// use SUBSCRIBE/BLPOP which puts the connection into blocking mode, making it
// unusable for normal Queue commands. Always call createRedisConnection() rather
// than sharing a single instance.
export function createRedisConnection(): IORedis {
  return new IORedis(redisUrl!, { maxRetriesPerRequest: null });
}
