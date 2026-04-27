# Phase 3: Technical Acquisition Pipeline - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 10 new/modified files
**Analogs found:** 9 / 10 (1 file has no codebase analog — TypeScript declaration file)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (self — modify existing) | exact |
| `src/lib/redis.ts` | config/singleton | request-response | `src/db/index.ts` | role-match (env-guard singleton export) |
| `src/acquisition/types.ts` | model/validation | transform | `src/discovery/types.ts` | exact |
| `src/acquisition/html-to-markdown.ts` | utility | transform | `src/discovery/types.ts` (pure function pattern) | partial |
| `src/acquisition/site-crawler.ts` | service | event-driven | `src/discovery/crawler.ts` | exact |
| `src/acquisition/page-writer.ts` | service | CRUD | `src/discovery/lead-writer.ts` | exact |
| `src/acquisition/run.ts` | controller/CLI | request-response | `src/discovery/run.ts` | exact |
| `src/workers/queues.ts` | config | request-response | `src/db/index.ts` | role-match (singleton export) |
| `src/workers/acquisition.worker.ts` | service | event-driven | `src/discovery/crawler.ts` | role-match |
| `src/types/turndown-plugin-gfm.d.ts` | config | — | none | no analog |

---

## Pattern Assignments

### `src/db/schema.ts` (model, CRUD — modify existing)

**Analog:** `src/db/schema.ts` (self)

**Current imports pattern** (lines 1):
```typescript
import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
```

**Existing enum pattern** (lines 3-8):
```typescript
export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);
```

**Existing table definition pattern** (lines 10-17):
```typescript
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

**Existing type export pattern** (lines 29-35):
```typescript
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
```

**What to add for Phase 3** — append after existing tables, following the same patterns exactly:
```typescript
// ADD to imports line 1: no new imports needed — `integer` already imported
// If `integer` is not already destructured, add it

export const pageTypeEnum = pgEnum("page_type", [
  "homepage",
  "products",
  "about",
  "other",
]);

export const manufacturerPages = pgTable("manufacturer_pages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  url: text("url").notNull(),
  pageType: pageTypeEnum("page_type").notNull(),
  markdownContent: text("markdown_content").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
});

export type ManufacturerPage = typeof manufacturerPages.$inferSelect;
export type NewManufacturerPage = typeof manufacturerPages.$inferInsert;
export type PageType = (typeof pageTypeEnum.enumValues)[number];
```

**Critical:** `integer` is already imported on line 1 — do not duplicate the import. Just append the enum and table after `scraperRuns`.

---

### `src/lib/redis.ts` (config/singleton, request-response)

**Analog:** `src/db/index.ts` (env-guard + singleton export pattern)

**Analog's env-guard pattern** (`src/db/index.ts` lines 4-8):
```typescript
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new Pool({ connectionString });
```

**Analog's singleton export pattern** (`src/db/index.ts` line 11):
```typescript
export const db = drizzle({ client: pool, schema });
```

**Target pattern for `src/lib/redis.ts`** — mirror the env-guard and named export convention:
```typescript
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

// maxRetriesPerRequest: null is mandatory for BullMQ workers — do not remove
export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
```

**Note:** The env-guard throw pattern (not a conditional default) is the established project convention from `src/db/index.ts`. Replicate it exactly.

---

### `src/acquisition/types.ts` (model/validation, transform)

**Analog:** `src/discovery/types.ts` (lines 1-8 — complete file)

**Analog pattern:**
```typescript
import { z } from "zod";

export const ExtractedMemberSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL").nullable(),
});

export type ExtractedMember = z.infer<typeof ExtractedMemberSchema>;
```

**Target pattern for `src/acquisition/types.ts`** — same Zod schema + inferred type pattern:
```typescript
import { z } from "zod";

export const AcquisitionJobSchema = z.object({
  leadId: z.number().int().positive(),
  url: z.string().url("url must be a valid URL"),
});

export type AcquisitionJob = z.infer<typeof AcquisitionJobSchema>;

export const CrawledPageSchema = z.object({
  url: z.string().url(),
  pageType: z.enum(["homepage", "products", "about", "other"]),
  markdown: z.string(),
});

export type CrawledPage = z.infer<typeof CrawledPageSchema>;
```

**Pattern rules:** One file per domain (job types, page types). Named schema + `z.infer<typeof ...>` exported together. No default exports.

---

### `src/acquisition/html-to-markdown.ts` (utility, transform)

**No direct analog in codebase** — pure utility function with no database interaction. Closest structural reference is the single-export function style used throughout the discovery module.

**Function signature convention** — match the named export pattern from `src/discovery/lead-writer.ts` (lines 18-20):
```typescript
export async function writeLead(
  member: ExtractedMember & { url: string },
  counters: RunCounters,
): Promise<void> {
```

**Target pattern for `src/acquisition/html-to-markdown.ts`:**
```typescript
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// Singleton — TurndownService is stateless between calls; create once at module level
const turndown = new TurndownService({ headingStyle: "atx" });
turndown.use(gfm);

export function htmlToMarkdown(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    // Fallback: Readability could not extract readable content (SPA, thin page, etc.)
    return turndown.turndown(html);
  }

  // CRITICAL: use article.content (cleaned HTML), NOT article.textContent (plain text)
  // article.textContent strips all tags — tables become flat whitespace, violating D-04
  return turndown.turndown(article.content);
}
```

**Import style:** Double quotes (matching `src/discovery/types.ts` and `src/lib/logger.ts`). `@/` alias not needed for this file's own imports since all are npm packages.

---

### `src/acquisition/site-crawler.ts` (service, event-driven)

**Analog:** `src/discovery/crawler.ts` (complete file, 147 lines)

**Analog imports pattern** (lines 1-5):
```typescript
import { PlaywrightCrawler } from "crawlee";
import { writeErroredLead, writeLead } from "@/discovery/lead-writer";
import { ExtractedMemberSchema } from "@/discovery/types";
import { logger } from "@/lib/logger";
import type { RunCounters } from "@/discovery/lead-writer";
```

**Analog PlaywrightCrawler constructor pattern** (lines 8-17):
```typescript
const crawler = new PlaywrightCrawler({
  minConcurrency: 1,
  maxConcurrency: 1,
  maxRequestsPerMinute: 20,
  maxRequestRetries: 3,
  requestHandlerTimeoutSecs: 120,
  launchContext: {
    launchOptions: { headless: true },
  },
  // ...
});
```

**Analog failedRequestHandler pattern** (lines 137-139):
```typescript
failedRequestHandler({ request, log }) {
  log.error(`Request failed permanently: ${request.url}`);
},
```

**Analog crawler.run() call pattern** (line 145):
```typescript
await crawler.run(["https://chemexcil.in/members"]);
```

**Target pattern for `src/acquisition/site-crawler.ts`** — one crawler per job call, bounded multi-page:
```typescript
import { PlaywrightCrawler } from "crawlee";
import { htmlToMarkdown } from "@/acquisition/html-to-markdown";
import type { CrawledPage } from "@/acquisition/types";

const KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i;

export async function crawlManufacturerSite(homepageUrl: string): Promise<CrawledPage[]> {
  const results: CrawledPage[] = [];

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 5,         // D-01: cap at 5 pages total
    maxRequestRetries: 3,            // D-02: 3 Crawlee-level retries per page
    requestHandlerTimeoutSecs: 60,
    launchContext: {
      launchOptions: { headless: true },
    },

    async requestHandler({ page, request, enqueueLinks }) {
      const html = await page.content();
      const url = request.loadedUrl ?? request.url;
      const label = (request.label ?? "HOMEPAGE") as string;

      const pageType = inferPageType(url, label);
      const markdown = htmlToMarkdown(html, url);
      results.push({ url, pageType, markdown });

      if (label === "HOMEPAGE") {
        await enqueueLinks({
          selector: "a[href]",
          label: "PAGE",
          transformRequestFunction(req) {
            if (KEYWORD_PATTERN.test(req.url)) return req;
            return false;
          },
        });
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request failed permanently: ${request.url}`);
    },
  });

  await crawler.run([{ url: homepageUrl, label: "HOMEPAGE" }]);
  return results;
}

function inferPageType(url: string, label: string): CrawledPage["pageType"] {
  if (label === "HOMEPAGE") return "homepage";
  if (/product|catalogue/i.test(url)) return "products";
  if (/about|company/i.test(url)) return "about";
  return "other";
}
```

**Key difference from Phase 2 crawler:** Phase 2 has one global crawler instance. Phase 3 creates a fresh `PlaywrightCrawler` per `crawlManufacturerSite()` call — one per BullMQ job — to avoid RequestQueue state pollution across concurrent workers.

---

### `src/acquisition/page-writer.ts` (service, CRUD)

**Analog:** `src/discovery/lead-writer.ts` (complete file, 75 lines)

**Analog imports pattern** (lines 1-4):
```typescript
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { ExtractedMember } from "@/discovery/types";
```

**Analog Drizzle insert pattern** (lines 23-27):
```typescript
const result = await db
  .insert(leads)
  .values({ name: member.name, url: member.url, status: "New" })
  .onConflictDoNothing({ target: leads.url })
  .returning({ id: leads.id });
```

**Analog Drizzle update pattern** (from `src/discovery/run.ts` lines 55-63):
```typescript
await db
  .update(scraperRuns)
  .set({
    finishedAt: new Date(),
    leadsFound: counters.found,
  })
  .where(eq(scraperRuns.id, runId));
```

**Analog logger structured log pattern** (lines 31-35):
```typescript
logger.info({
  leadId: result[0].id,
  stage: "discovery",
  status: "ok",
  message: `written name=${member.name}`,
});
```

**Target pattern for `src/acquisition/page-writer.ts`:**
```typescript
import { db } from "@/db/index";
import { leads, manufacturerPages } from "@/db/schema";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import type { CrawledPage } from "@/acquisition/types";

export async function writePage(
  leadId: number,
  page: CrawledPage,
): Promise<void> {
  await db.insert(manufacturerPages).values({
    leadId,
    url: page.url,
    pageType: page.pageType,
    markdownContent: page.markdown,
    crawledAt: new Date(),
  });

  logger.info({
    leadId,
    stage: "acquire",
    status: "ok",
    message: `written page url=${page.url} type=${page.pageType}`,
  });
}

export async function updateLeadStatus(
  leadId: number,
  status: "Processing" | "Crawled" | "Errored",
): Promise<void> {
  await db
    .update(leads)
    .set({ status })
    .where(eq(leads.id, leadId));
}
```

---

### `src/acquisition/run.ts` (controller/CLI, request-response)

**Analog:** `src/discovery/run.ts` (complete file, 78 lines)

**Analog dotenv-first pattern** (lines 1-3 — CRITICAL):
```typescript
// MUST be the very first import — loads DATABASE_URL before db singleton initializes (Pitfall 5)
import { config } from "dotenv";
config({ path: ".env.local" });
```

**Analog imports-after-dotenv pattern** (lines 6-11):
```typescript
import { db } from "@/db/index";
import { scraperRuns } from "@/db/schema";
import { runCrawler } from "@/discovery/crawler";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import type { RunCounters } from "@/discovery/lead-writer";
```

**Analog main() function pattern** (lines 36-72):
```typescript
async function main(): Promise<void> {
  const startedAt = Date.now();
  logger.info({ stage: "run", status: "start", message: "Discovery run starting" });
  // ... do work ...
  logger.info({
    stage: "run",
    status: "ok",
    durationMs,
    message: `Run complete. found=... written=... skipped=... errored=...`,
  });
}
```

**Analog top-level error handler pattern** (lines 74-77):
```typescript
main().catch((err) => {
  logger.error({ stage: "run", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
```

**Target pattern for `src/acquisition/run.ts`** — same structure, reads leads, enqueues BullMQ jobs, exits:
```typescript
// MUST be the very first import — loads REDIS_URL and DATABASE_URL before singletons init
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { acquisitionQueue } from "@/workers/queues";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  const newLeads = await db
    .select({ id: leads.id, url: leads.url })
    .from(leads)
    .where(eq(leads.status, "New"));

  if (newLeads.length === 0) {
    logger.info({ stage: "acquire", status: "ok", message: "No New leads to enqueue" });
    await acquisitionQueue.close();
    return;
  }

  await acquisitionQueue.addBulk(
    newLeads.map((lead) => ({
      name: "acquire",
      data: { leadId: lead.id, url: lead.url },
    }))
  );

  logger.info({
    stage: "acquire",
    status: "ok",
    message: `Enqueued ${newLeads.length} acquisition jobs`,
  });

  await acquisitionQueue.close(); // REQUIRED — prevents process from hanging
}

main().catch((err) => {
  logger.error({ stage: "acquire", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
```

**Critical ordering rule:** `dotenv` config call MUST precede all `@/` imports. The `db` singleton reads `process.env.DATABASE_URL` at module load time; the `redis` singleton reads `process.env.REDIS_URL` at module load time. Both throw if env is undefined. Dotenv must load first.

---

### `src/workers/queues.ts` (config, request-response)

**Analog:** `src/db/index.ts` (singleton export pattern, lines 1-11)

**Analog singleton export pattern:**
```typescript
const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
```

**Target pattern for `src/workers/queues.ts`** — named Queue export using the redis singleton:
```typescript
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const acquisitionQueue = new Queue("acquisition", {
  connection: redis,
});
```

**Note:** No dotenv import needed here — this module is imported by `run.ts` (which handles dotenv) and by `acquisition.worker.ts` (which is started via a separate entry point that also handles dotenv).

---

### `src/workers/acquisition.worker.ts` (service, event-driven)

**Analog:** `src/discovery/crawler.ts` (event-driven processor pattern)

**Analog async handler with structured logging** (lines 19-73 in `src/discovery/crawler.ts`):
```typescript
async requestHandler({ page, log }) {
  // ... process ...
  logger.info({
    stage: "discovery",
    status: "ok",
    message: `page=${pageNum} extracted=...`,
  });
}
```

**Analog failedRequestHandler** (lines 137-139):
```typescript
failedRequestHandler({ request, log }) {
  log.error(`Request failed permanently: ${request.url}`);
},
```

**Target pattern for `src/workers/acquisition.worker.ts`** — BullMQ Worker with `concurrency: 3`:
```typescript
import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { redis } from "@/lib/redis";
import { runAcquisitionJob } from "@/acquisition/index";
import { logger } from "@/lib/logger";

export const acquisitionWorker = new Worker(
  "acquisition",
  async (job: Job) => {
    const { leadId, url } = job.data as { leadId: number; url: string };
    await runAcquisitionJob({ leadId, url });
  },
  {
    connection: redis,
    concurrency: 3, // D-06: 3 concurrent Playwright workers
  }
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
```

---

### `src/types/turndown-plugin-gfm.d.ts` (config — TypeScript declaration)

**No analog in codebase** — no existing `.d.ts` declaration files. This is a one-off to satisfy TypeScript strict mode because `turndown-plugin-gfm` ships no bundled types and has no `@types/` package on npm.

**Target pattern** (minimal declaration, verified against turndown-plugin-gfm v1.0.2 exports):
```typescript
declare module "turndown-plugin-gfm" {
  import TurndownService from "turndown";
  export const gfm: (service: TurndownService) => void;
  export const tables: (service: TurndownService) => void;
  export const strikethrough: (service: TurndownService) => void;
  export const taskListItems: (service: TurndownService) => void;
}
```

---

## Shared Patterns

### Dotenv-First Import (CLI entry points only)
**Source:** `src/discovery/run.ts` lines 1-3
**Apply to:** `src/acquisition/run.ts`, `src/workers/index.ts` (worker entry point)
```typescript
// MUST be the very first import — loads DATABASE_URL before db singleton initializes
import { config } from "dotenv";
config({ path: ".env.local" });
```
**Rule:** No `@/` path imports may appear before this block. The db singleton and redis singleton both throw at module load if their env var is missing.

### Structured Logger Pattern
**Source:** `src/lib/logger.ts` (LeadLogContext interface, lines 3-10)
**Apply to:** All new files that call `logger.info`, `logger.warn`, `logger.error`
```typescript
// LeadLogContext shape — all fields except stage and status are optional
{
  leadId?: number;    // include when operating on a specific lead
  stage: string;      // e.g., "acquire", "worker", "crawl"
  status: "ok" | "skip" | "fail" | "start";
  durationMs?: number;
  message?: string;
}
```
**Usage pattern from** `src/discovery/lead-writer.ts` lines 31-35:
```typescript
logger.info({
  leadId: result[0].id,
  stage: "discovery",
  status: "ok",
  message: `written name=${member.name}`,
});
```

### Drizzle DB Update Pattern
**Source:** `src/discovery/run.ts` lines 55-63
**Apply to:** `src/acquisition/page-writer.ts` (status transitions)
```typescript
await db
  .update(leads)
  .set({ status: "Processing" })
  .where(eq(leads.id, leadId));
```
Import `eq` from `"drizzle-orm"` — consistent across all existing files.

### Drizzle Insert Pattern
**Source:** `src/discovery/lead-writer.ts` lines 23-27
**Apply to:** `src/acquisition/page-writer.ts` (manufacturer_pages inserts)
```typescript
await db
  .insert(leads)
  .values({ name: member.name, url: member.url, status: "New" })
  .onConflictDoNothing({ target: leads.url })
  .returning({ id: leads.id });
```
For `manufacturer_pages`, no conflict target is needed (no unique constraint on url) — omit `.onConflictDoNothing()`.

### Env-Guard Singleton Pattern
**Source:** `src/db/index.ts` lines 4-8
**Apply to:** `src/lib/redis.ts`
```typescript
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
```
Throw immediately on missing env — never use a fallback default for connection strings.

### Main() + Catch Pattern
**Source:** `src/discovery/run.ts` lines 74-77
**Apply to:** `src/acquisition/run.ts`, `src/workers/index.ts`
```typescript
main().catch((err) => {
  logger.error({ stage: "run", status: "fail", message: `Fatal: ${String(err)}` });
  process.exit(1);
});
```

### Zod Schema + Inferred Type Pattern
**Source:** `src/discovery/types.ts` lines 1-8
**Apply to:** `src/acquisition/types.ts`
```typescript
import { z } from "zod";

export const SomeSchema = z.object({ ... });
export type SomeThing = z.infer<typeof SomeSchema>;
```
Schema and type exported together. No default exports. Named exports only.

### @/ Path Alias
**Source:** All existing files in `src/`
**Apply to:** All new files
```
@/db/index      → src/db/index.ts
@/db/schema     → src/db/schema.ts
@/lib/logger    → src/lib/logger.ts
@/lib/redis     → src/lib/redis.ts (new)
@/workers/queues → src/workers/queues.ts (new)
@/acquisition/* → src/acquisition/*.ts (new)
```
Never use relative imports (`../`, `./`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/types/turndown-plugin-gfm.d.ts` | config/declaration | — | No existing `.d.ts` declaration files in codebase; this is a one-off TypeScript fix |

---

## Additional Notes for Planner

### New File Not Listed in Pattern Mapping Context

`src/acquisition/index.ts` — the BullMQ job handler that orchestrates status transitions + site crawl + DB writes. This was described in RESEARCH.md Pattern 7. Its analog is `src/discovery/run.ts` (orchestration pattern) combined with `src/discovery/lead-writer.ts` (Drizzle update pattern). The file:
- Imports from `@/db/index`, `@/db/schema`, `@/acquisition/site-crawler`, `@/acquisition/page-writer`, `@/lib/logger`
- Follows the try/catch/re-throw pattern for BullMQ job failure recording
- Uses `updateLeadStatus()` from `page-writer.ts` for state transitions

`src/workers/index.ts` — worker process entry point. Imports `src/workers/acquisition.worker.ts` and handles graceful shutdown. Follows the same dotenv-first pattern as `src/acquisition/run.ts`. Analog: `src/discovery/run.ts` structure (dotenv first, main(), catch block).

### drizzle-kit push Command
When executing the schema migration task, use explicit env injection (known deviation in `drizzle.config.ts`):
```bash
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-) npx drizzle-kit push
```

### Redis Setup (Wave 0 prerequisite)
Redis is not installed. Must be resolved before any BullMQ code can be smoke-tested:
```bash
brew install redis && brew services start redis
# Then add to .env.local:
# REDIS_URL=redis://localhost:6379
```

### package.json Scripts to Add
```json
{
  "scripts": {
    "acquire": "tsx src/acquisition/run.ts",
    "worker": "tsx src/workers/index.ts"
  }
}
```

---

## Metadata

**Analog search scope:** `src/discovery/`, `src/db/`, `src/lib/`
**Files scanned:** 6 existing files read in full
**Pattern extraction date:** 2026-04-27
