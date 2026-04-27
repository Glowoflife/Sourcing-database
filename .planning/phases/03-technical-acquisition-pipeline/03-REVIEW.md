---
phase: 03-technical-acquisition-pipeline
reviewed: 2026-04-27T11:43:54Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - package.json
  - src/db/schema.ts
  - src/lib/redis.ts
  - src/workers/queues.ts
  - src/acquisition/html-to-markdown.ts
  - src/types/turndown-plugin-gfm.d.ts
  - src/acquisition/types.ts
  - src/acquisition/page-writer.ts
  - src/acquisition/site-crawler.ts
  - src/acquisition/index.ts
  - src/workers/acquisition.worker.ts
  - src/workers/index.ts
  - src/acquisition/run.ts
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-27T11:43:54Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The acquisition pipeline implements a reasonable overall architecture: Crawlee-based multi-page crawling, Readability + Turndown for HTML-to-Markdown conversion, BullMQ for job queuing, and Drizzle/Postgres for persistence. The core happy path is coherent. However, there are four critical defects that will cause incorrect behavior or data corruption in production: a nullable URL field that reaches the worker unvalidated, missing Zod validation on worker job data, a duplicate-row bug on job retry, and a shared Redis connection between Queue and Worker that violates BullMQ's connection model. Five additional warnings address error-masking in the catch block, a regex correctness issue, an incorrect atomicity claim, stalled-job recovery, and an `updateLeadStatus` throw that loses the original error.

---

## Critical Issues

### CR-01: Nullable `leads.url` reaches the worker as `null` — no guard or validation

**File:** `src/db/schema.ts:11` and `src/acquisition/run.ts:14`

**Issue:** The `url` column on the `leads` table has no `.notNull()` constraint (`url: text("url").unique()`), making it `string | null` in the inferred TypeScript type `Lead`. In `run.ts`, the select projection is `{ id: leads.id, url: leads.url }`, so `lead.url` is typed `string | null`. This `null` is passed directly into `acquisitionQueue.addBulk(...)` as the `url` field of the job data with no null check. In `acquisition.worker.ts`, the job data is read with `job.data as { leadId: number; url: string }` — a cast that does not validate. `runAcquisitionJob` then calls `crawlManufacturerSite(null)`, which will pass `null` to Playwright's `crawler.run([{ url: null }])`, causing an unhandled runtime crash deep inside Crawlee with an opaque error message.

**Fix:** Either add `.notNull()` to the `url` column in the schema (the correct long-term fix, if a lead without a URL is semantically invalid) or add an explicit null filter before enqueuing:

```typescript
// src/acquisition/run.ts — filter out leads with no URL before enqueue
const validLeads = newLeads.filter((lead): lead is { id: number; url: string } => lead.url !== null);

if (validLeads.length === 0) {
  logger.info({ stage: "acquire", status: "ok", message: "No New leads with valid URLs to enqueue" });
  await acquisitionQueue.close();
  return;
}

await acquisitionQueue.addBulk(
  validLeads.map((lead) => ({
    name: "acquire",
    data: { leadId: lead.id, url: lead.url },
  })),
);
```

If leads without a URL should never exist, add `.notNull()` to the column definition in `src/db/schema.ts`:
```typescript
url: text("url").notNull().unique(),
```

---

### CR-02: Job data cast bypasses Zod validation in the worker — malformed jobs execute silently

**File:** `src/workers/acquisition.worker.ts:10`

**Issue:** `AcquisitionJobSchema` is defined in `src/acquisition/types.ts` for exactly this purpose but is never used in the worker. Instead, `job.data` is extracted with an unsafe cast: `job.data as { leadId: number; url: string }`. If a job was enqueued with missing fields, wrong types, or a non-URL string in `url`, the cast succeeds at runtime (TypeScript casts are erased) and the invalid data flows into `runAcquisitionJob` unchecked. This can produce confusing downstream failures (Playwright errors, DB constraint violations) with no indication that the job data itself was malformed.

**Fix:** Parse and validate job data through the existing schema before use:

```typescript
// src/workers/acquisition.worker.ts
import { AcquisitionJobSchema } from "@/acquisition/types";

export const acquisitionWorker = new Worker(
  "acquisition",
  async (job: Job) => {
    const parsed = AcquisitionJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new Error(`Invalid job data for job ${job.id}: ${parsed.error.message}`);
    }
    await runAcquisitionJob(parsed.data);
  },
  { connection: redis, concurrency: 3 },
);
```

Throwing on invalid data causes BullMQ to mark the job as failed immediately (no retries wasted) and records the validation error clearly in the job's failure reason.

---

### CR-03: Duplicate `manufacturer_pages` rows inserted on BullMQ job retry

**File:** `src/acquisition/page-writer.ts:7` and `src/db/schema.ts:46`

**Issue:** `writePage` executes a plain `INSERT` with no `ON CONFLICT` handling. The `manufacturer_pages` table has no `UNIQUE` constraint on `(lead_id, url)`. When BullMQ retries a failed job (e.g., after a transient DB error mid-crawl, or after `updateLeadStatus("Crawled")` itself throws), `writePage` is called again for each page and inserts duplicate rows. With `maxRequestRetries: 3` in the crawler and BullMQ's own retry policy, a single lead can accumulate 4× or more duplicate page rows, corrupting Phase 4 extraction.

**Fix — two-part:**

1. Add a unique constraint in the schema:
```typescript
// src/db/schema.ts
import { integer, pgEnum, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const manufacturerPages = pgTable("manufacturer_pages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  url: text("url").notNull(),
  pageType: pageTypeEnum("page_type").notNull(),
  markdownContent: text("markdown_content").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
}, (t) => [unique().on(t.leadId, t.url)]);
```

2. Use an upsert in `page-writer.ts`:
```typescript
// src/acquisition/page-writer.ts
import { sql } from "drizzle-orm";

await db.insert(manufacturerPages).values({
  leadId,
  url: page.url,
  pageType: page.pageType,
  markdownContent: page.markdown,
  crawledAt: new Date(),
}).onConflictDoUpdate({
  target: [manufacturerPages.leadId, manufacturerPages.url],
  set: {
    pageType: page.pageType,
    markdownContent: page.markdown,
    crawledAt: new Date(),
  },
});
```

---

### CR-04: Shared `IORedis` instance used for both Queue and Worker violates BullMQ's connection model

**File:** `src/lib/redis.ts:11`, `src/workers/queues.ts:5`, `src/workers/acquisition.worker.ts:7`

**Issue:** A single `redis` singleton from `src/lib/redis.ts` is imported by both `acquisitionQueue` (Queue) and `acquisitionWorker` (Worker). BullMQ's documentation explicitly requires that each Queue and Worker use a **separate** IORedis connection. Workers use `SUBSCRIBE`/`BLPOP` commands that put the connection into blocking or subscriber mode; a connection in subscriber mode cannot issue normal Redis commands. Using the same connection object means the Queue's `addBulk`, `getJob`, and `close` calls will intermittently fail with "ERR Command not allowed in subscriber mode" once the Worker's blocking commands activate. Under `concurrency: 3`, this will manifest as unpredictable job stalls or Redis errors. When `run.ts` (which imports `acquisitionQueue`) is run in the same process as the worker, the shared connection will conflict immediately.

Note: `run.ts` and `workers/index.ts` are separate processes (`acquire` vs `worker` npm scripts), which reduces the blast radius, but BullMQ still requires each Worker to have its own connection even in isolation.

**Fix:** Create separate connection factories and never share an IORedis instance:

```typescript
// src/lib/redis.ts
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

export function createRedisConnection(): IORedis {
  return new IORedis(redisUrl!, { maxRetriesPerRequest: null });
}
```

Then in each consumer:
```typescript
// src/workers/queues.ts
import { createRedisConnection } from "@/lib/redis";
export const acquisitionQueue = new Queue("acquisition", { connection: createRedisConnection() });

// src/workers/acquisition.worker.ts
import { createRedisConnection } from "@/lib/redis";
export const acquisitionWorker = new Worker("acquisition", handler, {
  connection: createRedisConnection(),
  concurrency: 3,
});
```

---

## Warnings

### WR-01: `updateLeadStatus("Errored")` in catch block can throw, masking the original error

**File:** `src/acquisition/index.ts:53`

**Issue:** The catch block in `runAcquisitionJob` calls `await updateLeadStatus(leadId, "Errored")` before re-throwing. If the database is unavailable (which is a plausible reason the crawl job failed), this `await` will throw a new DB connection error. That new error propagates up instead of the original `err`, and the `throw err` on line 63 is never reached. BullMQ records the wrong failure reason; the lead may not be marked `Errored` at all; and debugging becomes difficult because the logged error does not reflect what actually went wrong.

**Fix:** Wrap the status update in its own try/catch:

```typescript
} catch (err) {
  try {
    await updateLeadStatus(leadId, "Errored");
  } catch (statusErr) {
    logger.error({
      stage: "acquire",
      status: "fail",
      leadId,
      message: `Failed to mark lead as Errored: ${String(statusErr)}`,
    });
  }

  logger.error({
    stage: "acquire",
    status: "fail",
    leadId,
    message: `Errored: ${String(err)}`,
  });

  throw err; // always re-throw the original error
}
```

---

### WR-02: Regex wildcard in `KEYWORD_PATTERN` — `.` matches any character, not a literal period

**File:** `src/acquisition/site-crawler.ts:6`

**Issue:** `const KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i` — the `.` in `our.products` is an unescaped regex metacharacter that matches any single character (e.g., "ourXproducts", "our/products", "our products"). While this is unlikely to cause false-positive link enqueues in practice, it is a defect: the intent (per the comment referencing CONTEXT.md) is to match the literal phrase "our products" or "our-products". If a URL coincidentally matches `ourXproducts`, it will be enqueued and consume one of the 4 available inner-page slots.

**Fix:**
```typescript
const KEYWORD_PATTERN = /product|about|company|catalogue|our[.\-\s]?products/i;
```
Or if only a literal dot and hyphen are intended:
```typescript
const KEYWORD_PATTERN = /product|about|company|catalogue|our[-.]products/i;
```

---

### WR-03: `addBulk` comment incorrectly claims atomicity

**File:** `src/acquisition/run.ts:25`

**Issue:** The comment reads `// addBulk is atomic — all jobs added or none (prevents partial enqueue on Redis error)`. This is false. BullMQ's `addBulk` uses a Redis pipeline (batched commands), not a transaction. A pipeline sends commands in a batch for efficiency but does NOT guarantee all-or-none atomicity. If Redis encounters an error mid-pipeline, some jobs will have been added and others will not. The code relying on this incorrect assumption may not have alternative handling, but operators reading this comment will have a false sense of safety.

**Fix:** Correct the comment to reflect actual behavior:
```typescript
// addBulk uses a Redis pipeline — commands are batched for efficiency but NOT atomic.
// A partial failure will leave some jobs enqueued and others missing.
await acquisitionQueue.addBulk(...)
```

---

### WR-04: Leads stuck in `"Processing"` status have no recovery path

**File:** `src/acquisition/run.ts:16`, `src/acquisition/index.ts:15`

**Issue:** When a worker process is killed mid-job (SIGKILL, OOM, host restart), the lead is left in `"Processing"` status indefinitely. `run.ts` only enqueues leads with `status = "New"`, so stalled `"Processing"` leads are never re-enqueued. Over time, any infrastructure instability will cause leads to accumulate in `"Processing"` permanently with no automated recovery. BullMQ's built-in stalled-job detection handles the queue side (re-queues the BullMQ job), but if the lead's DB status was already updated to `"Processing"` (line 15 in `index.ts`) before the crash, the DB state and BullMQ state diverge.

**Fix:** Add a startup reconciliation step in `run.ts` that re-enqueues leads that have been in `"Processing"` status for longer than a threshold (e.g., 10 minutes), or use BullMQ's job stalledInterval in combination with a DB reconciliation query:

```typescript
// Reconcile leads stuck in Processing for > 10 minutes back to New
const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
await db.update(leads)
  .set({ status: "New" })
  .where(and(eq(leads.status, "Processing"), lt(leads.updatedAt, staleThreshold)));
```

---

### WR-05: `logger.error` writes to `stdout` instead of `stderr`

**File:** `src/lib/logger.ts:20`

**Issue:** All log levels — including `error` — are emitted via `console.log(JSON.stringify(entry))`, which writes to `stdout`. Standard Unix convention (and most log aggregator integrations) expect errors on `stderr`. This means error logs will be mixed with informational logs when piping stdout, and error monitoring tools that tail stderr will miss error-level events.

**Fix:**
```typescript
function emit(level: LogLevel, ctx: LeadLogContext): void {
  const entry = { level, ts: new Date().toISOString(), ...ctx };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
```

---

## Info

### IN-01: `@types/turndown` is a dev dependency but `turndown` is used at runtime

**File:** `package.json:52`

**Issue:** `@types/turndown` is correctly in `devDependencies`. This is fine. However, `turndown-plugin-gfm` has a hand-written type declaration in `src/types/turndown-plugin-gfm.d.ts` (instead of using the package's own types or `@types/turndown-plugin-gfm`). The hand-written declaration declares only the named exports (`gfm`, `tables`, `strikethrough`, `taskListItems`) without a default export, which matches the actual package API. This is acceptable, but it should be noted that if `turndown-plugin-gfm` updates its exports, this declaration file will silently go stale.

**Fix:** Check whether `@types/turndown-plugin-gfm` exists on npm before the next dependency update; if it does, replace the manual declaration with the official types package.

---

### IN-02: `crawledAt: new Date()` in `page-writer.ts` is redundant with the schema default

**File:** `src/acquisition/page-writer.ts:13`

**Issue:** The `manufacturerPages` table schema defines `crawledAt: timestamp("crawled_at").notNull().defaultNow()`. The insert in `page-writer.ts` also explicitly sets `crawledAt: new Date()`, which is redundant. This creates two sources of truth for the timestamp and may cause slight clock skew if the DB server and application server have different system times (DB `NOW()` vs Node `new Date()`).

**Fix:** Remove the explicit `crawledAt` from the insert and rely on the schema default, which uses the DB server's clock (more consistent):

```typescript
await db.insert(manufacturerPages).values({
  leadId,
  url: page.url,
  pageType: page.pageType,
  markdownContent: page.markdown,
  // crawledAt omitted — uses defaultNow() from schema
});
```

---

_Reviewed: 2026-04-27T11:43:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
