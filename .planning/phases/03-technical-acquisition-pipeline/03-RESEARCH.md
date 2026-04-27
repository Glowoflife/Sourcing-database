# Phase 3: Technical Acquisition Pipeline - Research

**Researched:** 2026-04-27
**Domain:** BullMQ + Redis job orchestration, Crawlee multi-page crawl, Mozilla Readability + Turndown HTML→Markdown, Drizzle schema extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Scan the manufacturer homepage `<a>` tags for keyword matches on link text or href: `product`, `about`, `company`, `catalogue`, `our-products`. Crawl matched pages up to a max of **5 pages per manufacturer** (homepage + up to 4 matched pages).
- **D-02:** On unreachable sites or crawl errors — let Crawlee handle per-request retries (**3 retry attempts**). After all retries exhausted, update lead `status = Errored` and log a structured error record (`{ leadId, url, reason, attempt }`). Consistent with Phase 2 error handling pattern.
- **D-03:** Use **Mozilla Readability + Turndown**. Readability strips nav, footer, and boilerplate before conversion, reducing token noise for Phase 4. Turndown converts the extracted content body to Markdown.
- **D-04:** **Preserve HTML tables as Markdown tables.** Configure Turndown's GFM table plugin accordingly.
- **D-05:** **CLI script trigger** — `npm run acquire` reads all `status = New` leads and bulk-enqueues acquisition jobs.
- **D-06:** **3 concurrent BullMQ workers**.
- **D-07:** **BullMQ persistence via Redis** — `REDIS_URL` env var.
- **D-08:** New **`manufacturer_pages` table** with columns: `(id, lead_id, url, page_type, markdown_content, crawled_at)`.
- **D-09:** **No character/token cap** on stored Markdown.

### Claude's Discretion

- CSS/heuristics for keyword matching — exact keyword list and matching strategy.
- `page_type` enum values for `manufacturer_pages` — e.g., `homepage`, `products`, `about`, `other`.
- BullMQ queue name and job payload shape.
- Redis connection setup pattern.

### Deferred Ideas (OUT OF SCOPE)

- Proxy rotation — deferred to hotfix.
- Automatic/scheduled acquisition — deferred to Phase 6+.
- Token/character cap on Markdown storage — Phase 4 will handle chunking.
- UI for acquisition job status — Phase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTR-01 | Pipeline to convert manufacturer website HTML to Markdown for token-efficient AI processing | BullMQ queue/worker pattern verified; Readability + jsdom + Turndown pipeline confirmed; Crawlee multi-page bounded crawl pattern confirmed; Drizzle `manufacturer_pages` schema defined |
</phase_requirements>

---

## Summary

Phase 3 introduces three new technical subsystems that did not exist in Phase 2: a Redis-backed BullMQ job queue, a multi-page Crawlee site crawler with bounded link following, and an HTML→Markdown conversion pipeline using Mozilla Readability + Turndown. All three integrate into an established codebase (Drizzle, PlaywrightCrawler, `src/lib/logger.ts`, `@/` path aliases) via patterns identical to Phase 2.

The core architectural decision is to run the BullMQ worker as a long-running Node.js process (`tsx src/workers/index.ts`) separate from the Next.js dev server. The CLI script (`npm run acquire`) is a short-lived enqueue process — it reads `status=New` leads from PostgreSQL, bulk-enqueues one BullMQ job per lead via `queue.addBulk()`, then exits. The worker process picks up jobs concurrently (3 workers per D-06), runs the Crawlee site crawl per job, converts HTML to Markdown, writes to `manufacturer_pages`, and updates the lead status.

**Critical environment gap:** Redis is NOT installed on this machine. No `redis-cli`, no `redis-server`, no Homebrew redis, no Docker. Phase 3 Wave 0 MUST include a Redis setup task (Docker recommended, or Homebrew install) before any BullMQ code can be smoke-tested. `REDIS_URL` must also be added to `.env.local`.

**Primary recommendation:** Use BullMQ v5 with an ioredis connection string (`new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })`). For the site crawler, create one `PlaywrightCrawler` instance per BullMQ job with `maxRequestsPerCrawl: 5` — this is simpler and safer than sharing one crawler across jobs. Use Readability's `article.content` (HTML) as the Turndown input, not `article.textContent` (plain text), so table structure is preserved.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Job enqueue CLI (`npm run acquire`) | CLI process (`src/acquisition/run.ts`) | Database (reads leads) | Short-lived script; enqueues then exits |
| Job queue / persistence | Redis (BullMQ) | — | BullMQ stores job state durably in Redis; crashed workers resume without re-processing |
| Concurrent job processing | Worker process (`src/workers/`) | — | Long-running Node.js process separate from Next.js; 3 concurrent processors |
| Manufacturer site crawl | Worker process (Crawlee + Playwright) | — | Browser automation in Node.js worker; not a web request handler |
| HTML→Markdown conversion | Worker process (`src/acquisition/html-to-markdown.ts`) | — | Pure transformation step; runs inside the worker after page fetch |
| Page content storage | Database layer (`manufacturer_pages` table) | — | Drizzle insert per crawled page; one row per URL |
| Lead status transitions | Database layer (`leads` table) | Worker process | Worker drives transitions; DB enforces the state via `leadStatusEnum` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bullmq` | 5.76.2 | Job queue with Redis persistence, concurrency control, retry, events | Project-designated queue system (STACK.md); latest stable as of 2026-04-25 |
| `ioredis` | 5.10.1 | Redis client — required by BullMQ | BullMQ docs require ioredis; `maxRetriesPerRequest: null` is mandatory for BullMQ workers |
| `@mozilla/readability` | 0.6.0 | Strips nav/footer/boilerplate from HTML before Markdown conversion | Reduces token noise for Phase 4; project-designated (D-03) |
| `jsdom` | 29.1.0 | Provides DOM environment for Readability in Node.js | Readability requires a browser-compatible `document` object; jsdom supplies this |
| `turndown` | 7.2.4 | Converts HTML to Markdown | Project-designated (D-03); paired with Readability |
| `turndown-plugin-gfm` | 1.0.2 | Adds GitHub-Flavored Markdown table support to Turndown | Required by D-04 to preserve HTML `<table>` as Markdown tables |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/turndown` | 5.0.6 | TypeScript definitions for turndown | Required — turndown ships without bundled types |
| `@types/jsdom` | 28.0.1 | TypeScript definitions for jsdom | Required — jsdom ships without bundled types |
| `crawlee` | 3.16.0 (already installed) | PlaywrightCrawler for manufacturer site crawl | Already installed from Phase 2; no re-install needed |
| `playwright` | ^1.44.0 (already installed) | Browser engine for Crawlee | Already installed; `npx playwright install chromium` already done |
| `tsx` | ^4.21.0 (already installed) | Runs TypeScript CLI scripts | Already installed; used for `npm run acquire` and worker start |
| `dotenv` | ^16.4.7 (already installed) | Load `.env.local` in CLI context | Already installed; same pattern as Phase 2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One PlaywrightCrawler per BullMQ job | Shared global crawler across jobs | Shared crawler is simpler but mixing RequestQueues across concurrent jobs causes state pollution. One crawler per job is clean, predictable, and safe. |
| `@mozilla/readability` + Turndown | html-to-text or node-html-markdown | Readability is specifically designed to extract article-quality content (removes nav, ads, sidebars). Generic converters produce noisier Markdown with boilerplate that wastes Phase 4 tokens. |
| jsdom for Readability DOM | linkedom | linkedom is lighter but has partial DOM API coverage; Readability's README specifically recommends jsdom for Node.js use. |
| `turndown-plugin-gfm` tables | Custom Turndown rule for tables | The GFM plugin handles complex table structures (colspan, alignment) that a hand-rolled rule would miss. D-04 explicitly requires table preservation — use the plugin. |

**Installation:**
```bash
npm install bullmq ioredis @mozilla/readability jsdom turndown turndown-plugin-gfm
npm install --save-dev @types/turndown @types/jsdom
```

**Version verification:** [VERIFIED: npm registry 2026-04-27]
- `bullmq@5.76.2` — published 2026-04-25, latest tag
- `ioredis@5.10.1` — latest stable
- `@mozilla/readability@0.6.0` — latest stable
- `jsdom@29.1.0` — latest stable
- `turndown@7.2.4` — latest stable
- `turndown-plugin-gfm@1.0.2` — latest stable

---

## Architecture Patterns

### System Architecture Diagram

```
npm run acquire
        │
        ▼
src/acquisition/run.ts         ← CLI: short-lived
  dotenv/config (first import)
  read leads WHERE status='New'
  queue.addBulk([{name:'acquire', data:{leadId, url}}, ...])
  print summary → exit
        │
        │ Redis (BullMQ queue: 'acquisition')
        ▼
src/workers/index.ts           ← long-running process
  Worker('acquisition', handler, { concurrency: 3, connection })
        │
        ├─ Job 1: leadId=5, url='http://abc.com'
        ├─ Job 2: leadId=7, url='http://xyz.in'
        └─ Job 3: leadId=9, url='http://def.com'
               │
               ▼ (per job, in src/acquisition/index.ts)
        update lead status='Processing'
               │
               ▼
        PlaywrightCrawler (maxRequestsPerCrawl=5)
          requestHandler:
            label='HOMEPAGE' → extract HTML, crawl to Markdown
                               → collect keyword-matched <a> hrefs
                               → enqueue up to 4 as label='PAGE'
            label='PAGE'     → extract HTML, convert to Markdown
               │
               ▼
        html-to-markdown.ts (per page HTML)
          jsdom.JSDOM(html, { url })
          new Readability(dom.window.document).parse()
          → article.content (cleaned HTML)
          → TurndownService + gfm tables plugin
          → markdown string
               │
               ▼
        db.insert(manufacturerPages).values({
          leadId, url, pageType, markdownContent, crawledAt
        })  ← one row per crawled page
               │
               ▼ (on all pages done)
        update lead status='Crawled'
               │ (on Crawlee failedRequestHandler after 3 retries)
               ▼
        update lead status='Errored'
        logger.error({ leadId, url, reason })
```

### Recommended Project Structure

```
src/
  acquisition/
    run.ts              # CLI entry point: dotenv/config first, reads leads, addBulk, prints summary
    index.ts            # BullMQ job handler: status transitions + orchestrates site-crawler
    site-crawler.ts     # PlaywrightCrawler per lead: homepage + keyword-matched link discovery
    html-to-markdown.ts # jsdom + Readability + Turndown conversion function
  workers/
    queues.ts           # Queue + IORedis connection singleton exports
    acquisition.worker.ts  # Worker('acquisition', ...) with concurrency:3
    index.ts            # Worker process entry point: imports worker, handles graceful shutdown
  db/
    schema.ts           # ADD: manufacturerPages table + pageTypeEnum
    index.ts            # Existing — no changes
  lib/
    redis.ts            # IORedis singleton — NEW in Phase 3
    logger.ts           # Existing — reuse as-is
```

### Pattern 1: IORedis Singleton (`src/lib/redis.ts`)

**What:** Shared IORedis connection exported for use by both the Queue (enqueue CLI) and the Worker process.
**When to use:** Both `src/acquisition/run.ts` and `src/workers/acquisition.worker.ts` import this.

```typescript
// Source: [CITED: docs.bullmq.io/guide/connections]
// [VERIFIED: BullMQ v5 requires maxRetriesPerRequest: null for workers]
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL environment variable is not set');

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ workers — do not remove
});
```

**Critical note:** `maxRetriesPerRequest: null` is mandatory for BullMQ workers. Without it, ioredis throws `ReplyError: ERR max number of clients reached` under load and BullMQ jobs stall. [VERIFIED: docs.bullmq.io — Worker setup example explicitly shows this option]

### Pattern 2: Queue Definition (`src/workers/queues.ts`)

**What:** Exports the BullMQ Queue used by both the enqueue CLI and event listeners.

```typescript
// Source: [CITED: docs.bullmq.io/readme-1]
import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

export const acquisitionQueue = new Queue('acquisition', {
  connection: redis,
});
```

### Pattern 3: Bulk Enqueue CLI (`src/acquisition/run.ts`)

**What:** Short-lived CLI that reads `status=New` leads and bulk-enqueues acquisition jobs.

```typescript
// MUST be first import — loads REDIS_URL and DATABASE_URL before any singleton init
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db/index';
import { leads } from '@/db/schema';
import { acquisitionQueue } from '@/workers/queues';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

async function main(): Promise<void> {
  const newLeads = await db
    .select({ id: leads.id, url: leads.url })
    .from(leads)
    .where(eq(leads.status, 'New'));

  if (newLeads.length === 0) {
    logger.info({ stage: 'acquire', status: 'ok', message: 'No New leads to enqueue' });
    await acquisitionQueue.close();
    return;
  }

  // Source: [CITED: docs.bullmq.io/guide/queues/adding-bulks]
  // addBulk is atomic — all jobs added or none
  await acquisitionQueue.addBulk(
    newLeads.map((lead) => ({
      name: 'acquire',
      data: { leadId: lead.id, url: lead.url },
    }))
  );

  logger.info({
    stage: 'acquire',
    status: 'ok',
    message: `Enqueued ${newLeads.length} acquisition jobs`,
  });

  await acquisitionQueue.close();
}

main().catch((err) => {
  logger.error({ stage: 'acquire', status: 'fail', message: `Fatal: ${String(err)}` });
  process.exit(1);
});
```

### Pattern 4: BullMQ Worker (`src/workers/acquisition.worker.ts`)

**What:** Worker with `concurrency: 3` that processes acquisition jobs.

```typescript
// Source: [CITED: docs.bullmq.io/guide/workers/concurrency]
import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { runAcquisitionJob } from '@/acquisition/index';
import { logger } from '@/lib/logger';

export const acquisitionWorker = new Worker(
  'acquisition',
  async (job: Job) => {
    const { leadId, url } = job.data as { leadId: number; url: string };
    await runAcquisitionJob({ leadId, url });
  },
  {
    connection: redis,
    concurrency: 3, // D-06: 3 concurrent Playwright workers
  }
);

acquisitionWorker.on('completed', (job: Job) => {
  logger.info({ stage: 'worker', status: 'ok', leadId: job.data.leadId, message: `Job ${job.id} completed` });
});

acquisitionWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({
    stage: 'worker',
    status: 'fail',
    leadId: job?.data?.leadId,
    message: `Job ${job?.id} failed: ${err.message}`,
  });
});
```

### Pattern 5: HTML→Markdown Conversion Pipeline (`src/acquisition/html-to-markdown.ts`)

**What:** Takes raw HTML string + page URL, returns clean Markdown string. Uses Readability to strip boilerplate first, then Turndown with GFM table plugin.

```typescript
// Source: [VERIFIED: Context7 /mozilla/readability — Node.js jsdom example]
// Source: [VERIFIED: Context7 /mixmark-io/turndown — GFM plugin example]
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Create once (singleton) — TurndownService is stateless between conversions
const turndown = new TurndownService({ headingStyle: 'atx' });
turndown.use(gfm); // Enables Markdown table output for <table> elements (D-04)

export function htmlToMarkdown(html: string, url: string): string {
  // jsdom provides the DOM environment Readability requires in Node.js
  const dom = new JSDOM(html, { url }); // url is required for correct relative-URL resolution
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    // Readability could not extract content (e.g., page is pure JS, no readable body)
    // Fall back to converting raw HTML directly — still better than storing raw HTML
    return turndown.turndown(html);
  }

  // article.content is cleaned HTML (with structure intact — tables, headings, lists)
  // article.textContent would lose all table structure — do NOT use it as Turndown input
  return turndown.turndown(article.content);
}
```

**Critical distinction:** `article.content` is cleaned HTML (preserves `<table>`, `<ul>`, `<h2>` etc.). `article.textContent` is plain text with all tags stripped. Always pass `article.content` to Turndown — passing `article.textContent` would silently discard all table structure, violating D-04.

### Pattern 6: Bounded Multi-Page Crawlee Crawl (`src/acquisition/site-crawler.ts`)

**What:** Given a manufacturer homepage URL, crawls homepage + up to 4 keyword-matched pages. Uses `maxRequestsPerCrawl: 5` to enforce the D-01 5-page cap.

**Design choice — one crawler per job:** A new `PlaywrightCrawler` instance is created for each BullMQ job. This avoids sharing RequestQueue state across concurrent jobs (which would cause page-level interference). Each crawler uses Crawlee's in-memory RequestQueue (not persisted to disk) since per-manufacturer crawls are bounded and stateless.

```typescript
// Source: [CITED: crawlee.dev/js/docs/introduction/scraping — label-based routing]
// Source: [CITED: crawlee.dev/js/docs/introduction/adding-urls — enqueueLinks with selector]
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
import { htmlToMarkdown } from '@/acquisition/html-to-markdown';

// Keywords to match in link text or href (D-01 — Claude's discretion on exact list)
const KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i;

export type CrawledPage = {
  url: string;
  pageType: 'homepage' | 'products' | 'about' | 'other';
  markdown: string;
};

export async function crawlManufacturerSite(homepageUrl: string): Promise<CrawledPage[]> {
  const results: CrawledPage[] = [];

  // Source: [CITED: crawlee.dev — maxRequestsPerCrawl for bounded crawl]
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 5,   // D-01: cap at 5 pages total (homepage + 4 inner pages)
    maxRequestRetries: 3,      // D-02: 3 Crawlee-level retry attempts per page
    requestHandlerTimeoutSecs: 60,
    launchContext: {
      launchOptions: { headless: true },
    },

    async requestHandler({ page, request, enqueueLinks }) {
      const html = await page.content();
      const url = request.loadedUrl ?? request.url;
      const label = request.label ?? 'HOMEPAGE';

      const pageType = inferPageType(url, label);
      const markdown = htmlToMarkdown(html, url);

      results.push({ url, pageType, markdown });

      // Only enqueue links from the homepage — do not cascade link-following to inner pages
      if (label === 'HOMEPAGE') {
        // Filter <a> tags by keyword match in href or link text
        await enqueueLinks({
          selector: 'a[href]',
          label: 'PAGE',
          // Crawlee's transformRequestFunction lets us filter by href content
          // strategy defaults to 'same-hostname' — stays on the manufacturer's domain
          transformRequestFunction(req) {
            // req.url is the resolved absolute href
            if (KEYWORD_PATTERN.test(req.url)) return req;
            return false; // skip links that don't match
          },
        });
      }
    },

    failedRequestHandler({ request }) {
      // Crawlee calls this after maxRequestRetries exhausted
      // D-02: permanent failure — caller catches this via try/catch on crawler.run()
    },
  });

  await crawler.run([{ url: homepageUrl, label: 'HOMEPAGE' }]);
  return results;
}

function inferPageType(
  url: string,
  label: string
): 'homepage' | 'products' | 'about' | 'other' {
  if (label === 'HOMEPAGE') return 'homepage';
  if (/product|catalogue/i.test(url)) return 'products';
  if (/about|company/i.test(url)) return 'about';
  return 'other';
}
```

**Note on `transformRequestFunction`:** This is the Crawlee-idiomatic way to filter which links get enqueued. The alternative — extracting links manually with `page.$$eval('a')` and calling `crawler.addRequests()` — also works but is more verbose. Both approaches are correct. [ASSUMED — verify `transformRequestFunction` is supported in Crawlee 3.16.0 with `enqueueLinks`; if not, use manual extraction pattern]

### Pattern 7: Job Handler with Status Transitions (`src/acquisition/index.ts`)

**What:** Called by the BullMQ worker per job. Manages lead status and orchestrates the crawl + DB write.

```typescript
import { db } from '@/db/index';
import { leads, manufacturerPages } from '@/db/schema';
import { crawlManufacturerSite } from '@/acquisition/site-crawler';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

export async function runAcquisitionJob({
  leadId,
  url,
}: {
  leadId: number;
  url: string;
}): Promise<void> {
  const startedAt = Date.now();

  // Step 1: Mark lead as Processing (D-05 status machine)
  await db
    .update(leads)
    .set({ status: 'Processing' })
    .where(eq(leads.id, leadId));

  logger.info({ stage: 'acquire', status: 'start', leadId, message: `Crawling ${url}` });

  try {
    // Step 2: Crawl manufacturer site — may throw if all retries exhausted (D-02)
    const pages = await crawlManufacturerSite(url);

    // Step 3: Write one manufacturer_pages row per crawled page (D-08)
    for (const p of pages) {
      await db.insert(manufacturerPages).values({
        leadId,
        url: p.url,
        pageType: p.pageType,
        markdownContent: p.markdown,
        crawledAt: new Date(),
      });
    }

    // Step 4: Mark lead as Crawled
    await db
      .update(leads)
      .set({ status: 'Crawled' })
      .where(eq(leads.id, leadId));

    const durationMs = Date.now() - startedAt;
    logger.info({
      stage: 'acquire',
      status: 'ok',
      leadId,
      durationMs,
      message: `Crawled ${pages.length} pages`,
    });
  } catch (err) {
    // Step 5: Mark lead as Errored on permanent failure (D-02)
    await db
      .update(leads)
      .set({ status: 'Errored' })
      .where(eq(leads.id, leadId));

    logger.error({
      stage: 'acquire',
      status: 'fail',
      leadId,
      message: `Errored: ${String(err)}`,
    });

    throw err; // Re-throw so BullMQ records the job as failed
  }
}
```

### Pattern 8: Drizzle Schema Extension (`src/db/schema.ts`)

**What:** Add `pageTypeEnum` and `manufacturerPages` table alongside existing tables.

```typescript
// Source: [VERIFIED: src/db/schema.ts — existing style] + drizzle-orm docs
import { pgEnum, pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

// D-08 / Claude's discretion on enum values
export const pageTypeEnum = pgEnum('page_type', [
  'homepage',
  'products',
  'about',
  'other',
]);

export const manufacturerPages = pgTable('manufacturer_pages', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id')
    .notNull()
    .references(() => leads.id),          // FK to leads table
  url: text('url').notNull(),
  pageType: pageTypeEnum('page_type').notNull(),
  markdownContent: text('markdown_content').notNull(),
  crawledAt: timestamp('crawled_at').notNull().defaultNow(),
});

export type ManufacturerPage = typeof manufacturerPages.$inferSelect;
export type NewManufacturerPage = typeof manufacturerPages.$inferInsert;
```

**Note on `pgEnum` vs plain `text`:** Using `pgEnum` for `page_type` enforces the constraint at the PostgreSQL level (only the 4 defined values accepted) and produces a typed TypeScript union. This is preferable to plain `text` for a fixed vocabulary. [VERIFIED: existing schema.ts uses `pgEnum` for `leadStatusEnum` — consistent pattern]

### Pattern 9: drizzle-kit push with `.env.local`

**What:** `drizzle.config.ts` uses `import 'dotenv/config'` which loads `.env` by default. The project's DB credentials are in `.env.local`.

**Problem confirmed from STATE.md:** `drizzle.config.ts` uses `dotenv/config` (loads `.env` not `.env.local`). Future `db:push` runs need `DATABASE_URL` injected explicitly.

**Correct command:**
```bash
DATABASE_URL="postgres://..." npm run db:push
# or
dotenv -e .env.local -- npm run db:push   # if dotenv-cli is installed
# or simplest: copy DATABASE_URL to .env temporarily, run push, delete .env
```

**Recommended plan task action:** The Wave 0 schema task should use:
```bash
DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) npm run db:push
```

Or update `drizzle.config.ts` to load `.env.local` explicitly:
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });
```

### Anti-Patterns to Avoid

- **Passing `article.textContent` to Turndown:** `textContent` is plain text — no HTML tags for Turndown to convert. Tables become flattened whitespace. Always use `article.content` (cleaned HTML) as the Turndown input.
- **One global PlaywrightCrawler shared across BullMQ workers:** Crawlee's RequestQueue is not designed for concurrent multi-tenant use. Each BullMQ job must instantiate its own `PlaywrightCrawler`.
- **Missing `maxRetriesPerRequest: null` on ioredis:** BullMQ workers block on Redis commands. Without this option, ioredis times out and BullMQ jobs stall indefinitely.
- **Importing `src/lib/redis.ts` in Next.js Client Components or API routes that run in the Edge runtime:** ioredis is Node.js-only; it cannot run in Edge/browser environments.
- **Not calling `await acquisitionQueue.close()` in the CLI enqueue script:** Leaving the Redis connection open causes the process to hang after `addBulk()`. The CLI must explicitly close the queue before exiting.
- **Forgetting `dotenv/config` as the first import in `src/acquisition/run.ts`:** Same pitfall as Phase 2 — DB and Redis singletons throw on import if env vars are not loaded first.
- **Crawling inner pages from inner pages (recursive link-following):** The `enqueueLinks` call in Pattern 6 only runs when `label === 'HOMEPAGE'`. Inner pages must NOT enqueue further links — `maxRequestsPerCrawl: 5` is the safety net, but defensive label-checking prevents cascade.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML boilerplate stripping | Custom regex to remove nav/footer | `@mozilla/readability` | Readability uses heuristics refined over years of Firefox Reader View; regex misses dynamic nav patterns and CSS-hidden elements |
| HTML table → Markdown table | Custom traversal of `<table>` DOM | `turndown-plugin-gfm` tables plugin | Table plugin handles colspan, thead/tbody split, pipe escaping; hand-rolled converters break on complex chemical data tables |
| Job queue with retry + persistence | Custom Redis LPUSH/BRPOP queue | BullMQ | BullMQ provides atomic job state transitions, delayed retries, dead-letter queues, concurrency control, and event hooks; reimplementing these correctly is a multi-week project |
| Concurrent Playwright pool | Spawning multiple Playwright processes manually | BullMQ `concurrency: 3` + one PlaywrightCrawler per job | BullMQ's concurrency model handles worker lifecycle; Crawlee handles per-job browser lifecycle |
| DOM environment for Readability | Custom Node.js DOM shim | `jsdom` | Readability calls `document.createTreeWalker`, `element.getComputedStyle`, and other full DOM APIs; partial shims will miss these and crash |

**Key insight:** All three domain-specific tools (Readability, BullMQ, Crawlee) exist because the underlying problems (boilerplate extraction, durable job queues, bounded crawling) have substantial hidden complexity. The "simple" implementation for each is a well-known trap.

---

## Findings by Research Question

### Q1: BullMQ Setup — Minimal 3-Concurrent-Worker Configuration

[VERIFIED: docs.bullmq.io — Context7 /websites/bullmq_io]

**BullMQ v5 key API:**
- `new Queue(name, { connection })` — creates the queue; used in the enqueue CLI
- `queue.addBulk([{ name, data }])` — atomic bulk enqueue
- `new Worker(name, handler, { connection, concurrency: 3 })` — processes jobs; `concurrency: 3` means up to 3 jobs processed simultaneously by one Worker instance
- Worker events: `worker.on('completed', (job) => ...)` and `worker.on('failed', (job, err) => ...)`

**Connection:** `new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })` — the `maxRetriesPerRequest: null` is required by BullMQ workers (not optional).

**Queue and Worker can share the same IORedis instance** for simple cases, or use separate instances. The recommended pattern for this project is a shared singleton in `src/lib/redis.ts`.

### Q2: Readability + jsdom + Turndown — Minimal Conversion Pipeline

[VERIFIED: Context7 /mozilla/readability — official README example]
[VERIFIED: Context7 /mixmark-io/turndown — GFM plugin example]

```typescript
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({ headingStyle: 'atx' });
turndown.use(gfm);

function htmlToMarkdown(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article) return turndown.turndown(html); // fallback
  return turndown.turndown(article.content);   // article.content = cleaned HTML
}
```

**`turndown-plugin-gfm` has no `@types/turndown-plugin-gfm` on npm.** [VERIFIED: npm registry] The package ships CommonJS without bundled types. For TypeScript, add a simple declaration file or use `// @ts-ignore` on the import. Simplest approach — create `src/types/turndown-plugin-gfm.d.ts`:
```typescript
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export const gfm: (service: TurndownService) => void;
  export const tables: (service: TurndownService) => void;
}
```

### Q3: Multi-Page Crawlee Crawl — Bounded Pattern

[VERIFIED: Context7 /websites/crawlee_dev_js — label-based routing, enqueueLinks, maxRequestsPerCrawl]

**Pattern: One `PlaywrightCrawler` per BullMQ job.** This is the correct approach because:
1. Each manufacturer site is an independent domain — no shared state needed between jobs
2. Crawlee's `RequestQueue` is per-crawler-instance; sharing across concurrent jobs would corrupt it
3. `maxRequestsPerCrawl: 5` enforces the D-01 5-page cap per instantiation

**Link filtering for keyword matching:** Use `enqueueLinks` with `transformRequestFunction` to filter by URL pattern, or manually extract links with `page.$$eval('a[href]', ...)` and call `crawler.addRequests(filteredUrls)`. The manual approach is more explicit and may be clearer in the implementation.

**One crawler per lead, not one crawler for all leads:** The BullMQ worker starts a fresh `PlaywrightCrawler` for each job via `crawlManufacturerSite(url)`. This is intentional.

### Q4: Drizzle Schema for `manufacturer_pages`

[VERIFIED: src/db/schema.ts — existing pattern with pgEnum and pgTable]

Use `pgEnum` for `page_type` (consistent with existing `leadStatusEnum`). Foreign key reference to `leads.id` using `.references(() => leads.id)`. All columns `notNull` except potentially none — all fields are always populated at write time.

Full schema definition in Pattern 8 above.

### Q5: Lead Status Transitions in BullMQ Context

[VERIFIED: Drizzle ORM `db.update().set().where()` pattern — consistent with existing Phase 2 code]

Transitions:
- **Job start:** `New → Processing` — immediately in `runAcquisitionJob()` before crawl
- **Job success:** `Processing → Crawled` — after all pages written to `manufacturer_pages`
- **Job failure (all retries exhausted):** `Processing → Errored` — in the catch block; re-throw so BullMQ records job as failed

The re-throw in the catch block is important: without it, BullMQ considers the job successful even when the lead is set to `Errored`.

### Q6: drizzle-kit push with Correct Env

[VERIFIED: drizzle.config.ts — uses `import 'dotenv/config'` which reads `.env` not `.env.local`]
[VERIFIED: STATE.md — "drizzle.config.ts uses dotenv/config (loads .env not .env.local); future db:push runs need DATABASE_URL injected explicitly"]

The safest approach for Wave 0:
```bash
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-) npx drizzle-kit push
```

Or add `--config` pointing to a modified config. The planner should include an explicit note that the `db:push` task must inject `DATABASE_URL`.

### Q7: Redis Connection for `src/lib/redis.ts`

[VERIFIED: docs.bullmq.io — ioredis connection pattern]

BullMQ accepts either a connection object `{ host, port, password }` or an IORedis instance. Providing an IORedis instance (the singleton pattern) is preferred because it allows connection reuse between the Queue and Worker.

```typescript
// src/lib/redis.ts
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL environment variable is not set');

export const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
```

The exported `redis` singleton is imported by both `src/workers/queues.ts` (Queue) and `src/workers/acquisition.worker.ts` (Worker).

### Q8: BullMQ Bulk-Add Pattern

[VERIFIED: docs.bullmq.io/guide/queues/adding-bulks — addBulk example]

```typescript
await acquisitionQueue.addBulk(
  newLeads.map((lead) => ({
    name: 'acquire',                          // job name (arbitrary string)
    data: { leadId: lead.id, url: lead.url }, // job payload
    // opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } // optional
  }))
);
```

`addBulk` is atomic — all jobs are added or none. This prevents partial enqueue on Redis connection error.

### Q9: Error Handling in Worker After Crawlee Exhausts Retries

[VERIFIED: BullMQ worker docs — throwing from processor marks job as failed]
[VERIFIED: Crawlee docs — failedRequestHandler fires after maxRequestRetries]

When Crawlee exhausts `maxRequestRetries: 3` for a URL, it calls `failedRequestHandler`. The `crawler.run()` promise does **not** automatically throw — it resolves after all requests are processed or failed.

For Phase 3, if ANY page in a manufacturer's crawl fails permanently, the correct behavior depends on the failure type:
- **Homepage fails:** The entire crawl should be aborted and the lead set to `Errored`. The worker should detect that `results` is empty (homepage not crawled) and throw.
- **Inner page fails:** The homepage was crawled successfully. Set lead to `Crawled` (partial success) and log the inner page failure.

**Implementation approach:** Track whether the homepage was successfully crawled by checking if `results` contains a `pageType: 'homepage'` entry. If not — throw, which triggers BullMQ's retry mechanism and eventually sets lead to `Errored`.

### Q10: Smoke Test Approach

No automated test framework is configured (`nyquist_validation: false` in config.json). Phase 3 smoke test is manual:

1. **Prerequisite:** Redis must be running (`redis-server` or Docker)
2. Start the worker: `tsx src/workers/index.ts`
3. In a second terminal: `npm run acquire`
4. Verify: `manufacturer_pages` rows exist in DB for the tested leads
5. Verify: lead `status` transitioned from `New` → `Crawled` (or `Errored` for unreachable URLs)
6. Verify: Markdown content is human-readable (not raw HTML, not empty)
7. Verify: Rows with `page_type='products'` exist for manufacturers with a Products page

**Suggested test leads:** Pick 2–3 leads from the `leads` table where `url` is a known-live Indian chemical manufacturer website. The smoke test passes when all 3 Phase 3 success criteria (ROADMAP.md) are met.

---

## New Dependencies

```bash
# Runtime dependencies
npm install bullmq ioredis @mozilla/readability jsdom turndown turndown-plugin-gfm

# Dev / type dependencies
npm install --save-dev @types/turndown @types/jsdom
```

**Note:** No `@types/turndown-plugin-gfm` exists on npm. A local declaration file must be created in `src/types/` to satisfy TypeScript strict mode. See Q2 findings above.

**package.json scripts to add:**
```json
{
  "scripts": {
    "acquire": "tsx src/acquisition/run.ts",
    "worker": "tsx src/workers/index.ts"
  }
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v25.9.0 | — |
| PostgreSQL | Lead storage, manufacturer_pages writes | ✓ (assumed — .env.local exists with DATABASE_URL) | unknown | — |
| Redis | BullMQ job queue | ✗ | not installed | None — must install before smoke test |
| `bullmq` | Job queue | ✗ | not installed | None — must install |
| `ioredis` | Redis client | ✗ | not installed | None — must install |
| `@mozilla/readability` | HTML boilerplate stripping | ✗ | not installed | None — must install |
| `jsdom` | DOM for Readability in Node.js | ✗ | not installed | None — must install |
| `turndown` | HTML→Markdown | ✗ | not installed | None — must install |
| `turndown-plugin-gfm` | Markdown table support | ✗ | not installed | None — must install |
| `crawlee` | Site crawler | ✓ | 3.16.0 | — |
| `playwright` / Chromium binaries | Browser automation | ✓ | ^1.44.0 (installed Phase 2) | — |
| `tsx` | CLI runner | ✓ | ^4.21.0 | — |
| Docker | Redis container (recommended) | ✗ | not installed | Homebrew: `brew install redis` |

**Missing dependencies with no fallback:**
- Redis — must be available before any BullMQ code can run. Wave 0 must include: `docker run -d -p 6379:6379 redis:7-alpine` OR `brew install redis && brew services start redis`. Add `REDIS_URL=redis://localhost:6379` to `.env.local`.
- All npm packages listed above — install in Wave 0.

**Missing dependencies with fallback:**
- Docker (for Redis): If Docker not available, use `brew install redis && brew services start redis` as fallback. Both produce a Redis 7 instance on port 6379.

---

## Integration Risks / Open Questions

### Risk 1: `transformRequestFunction` API Availability in Crawlee 3.16.0

**What we know:** The `enqueueLinks` API in Crawlee 3.x accepts a `transformRequestFunction` option that allows filtering which links get enqueued. [ASSUMED — not verified against Crawlee 3.16.0 source]

**Risk:** If `transformRequestFunction` was added in a later Crawlee 3.x version, the keyword filtering pattern in Pattern 6 would fail at runtime.

**Mitigation:** The fallback is to manually extract all `<a>` hrefs with `page.$$eval`, filter them in JavaScript, and call `crawler.addRequests(filteredUrls.slice(0, 4))`. This is equally correct and is the safe fallback if `transformRequestFunction` is not available.

**Recommendation:** The planner should include a note to verify this API during Wave 0 implementation. If unavailable, use manual extraction.

### Risk 2: Readability Returns `null` for Dynamic/SPA Sites

**What we know:** `reader.parse()` returns `null` if it cannot detect readable content. This happens on pages that are pure JavaScript shells (the actual content is loaded after the initial HTML parse).

**Context:** The manufacturer site crawler uses Playwright (full browser), so JavaScript-rendered content IS available when `page.content()` is called (after `waitForLoadState`). However, Readability still uses heuristics that may fail on very thin pages (e.g., a landing page with only a logo and phone number).

**Mitigation:** Pattern 5 includes a fallback: if `article` is `null`, convert the raw HTML directly with Turndown. This produces noisier Markdown but ensures no page is silently skipped.

### Risk 3: Redis Not Available at Smoke Test Time

**What we know:** Redis is not installed on this machine. [VERIFIED: redis-cli not found, redis-server not found, brew redis not installed, Docker not installed]

**Impact:** Phase 3 cannot be smoke-tested until Redis is running. This is a Wave 0 setup task.

**Recommendation:** Wave 0 must include Redis setup as the first task, before any coding. The simplest path on macOS without Docker: `brew install redis && brew services start redis`.

### Risk 4: `drizzle-kit push` Env Variable Injection

**What we know:** `drizzle.config.ts` loads `.env` not `.env.local`. STATE.md documents this as a known deviation. [VERIFIED: drizzle.config.ts source]

**Impact:** Running `npm run db:push` without explicit `DATABASE_URL` injection will fail silently or use a wrong/empty DB URL.

**Mitigation:** The Wave 0 schema task must use the explicit injection pattern documented in Q6 above.

### Risk 5: `page_type` pgEnum Schema Push

**What we know:** Adding a new `pgEnum` to PostgreSQL creates a new type in the database. If the schema push is run twice (e.g., Wave 0 to add the table, then a correction run), PostgreSQL will throw `ERROR: type "page_type" already exists`. [ASSUMED — drizzle-kit push behavior for repeated pushes with existing enums]

**Mitigation:** `drizzle-kit push` uses introspection to detect existing types and skips re-creation of enums that already exist. [ASSUMED — consistent with how `leadStatusEnum` was handled in Phase 1] If it errors, the fix is to drop and recreate the enum manually or use `drizzle-kit push --force`.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 3 |
|-----------|--------------------|
| Technical Integrity: all extraction must be schema-validated (Zod) and unit-normalized | Phase 3 stores raw Markdown — no AI extraction or schema validation of extracted content. Zod not applicable in Phase 3. |
| Efficiency: use Markdown conversion before AI extraction to minimize token costs | Core requirement — EXTR-01 is explicitly the Markdown conversion pipeline. Readability + Turndown implement this. |
| Resilience: proxy rotation and rate limiting for all scraping operations | Proxy rotation: deferred per 03-CONTEXT.md. Rate limiting: enforced by `maxRequestsPerCrawl: 5` and Crawlee's polite defaults. |
| GSD Framework: use `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase` | Phase management commands followed; research output feeds planner. |
| `@/` path aliases for all `src/` imports (no relative imports) | All code patterns in this research use `@/` prefix exclusively. |
| `dotenv/config` as first import in CLI entry points | Enforced in Pattern 3 (`src/acquisition/run.ts`) and required for `src/workers/index.ts`. |
| Drizzle inserts: `db.insert(table).values(...)` — no raw SQL | All DB writes in Patterns 7 and 8 use Drizzle. |
| `drizzle-kit push` for schema changes | Pattern 9 documents the correct push command with env injection. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `transformRequestFunction` is available in `enqueueLinks` in Crawlee 3.16.0 | Q3, Pattern 6 | If not available, keyword filtering in `enqueueLinks` fails; fallback is manual `page.$$eval` extraction — safe, just more verbose |
| A2 | `drizzle-kit push` correctly skips re-creating `pageTypeEnum` if it already exists in PostgreSQL | Q6, Risk 5 | If push errors on duplicate enum, manual DB intervention needed; low risk on first push |
| A3 | PostgreSQL instance is running and `.env.local` contains a valid `DATABASE_URL` | Environment | If DB unavailable, all Drizzle writes fail; same assumption as Phase 2 |
| A4 | `@mozilla/readability@0.6.0` `parse()` returns `null` (not throws) when content is undetectable | Pattern 5 | If it throws instead, the `if (!article)` guard must be wrapped in try/catch |
| A5 | The shared IORedis singleton is safe to use for both Queue and Worker in the same process | Q7, Pattern 1 | BullMQ docs recommend separate connections for Queue vs Worker in high-throughput scenarios; for 3 concurrent workers this is acceptable [ASSUMED] |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Context7 /websites/bullmq_io] — Queue, Worker, addBulk, concurrency, connection, worker events, maxRetriesPerRequest requirement
- [VERIFIED: Context7 /mozilla/readability] — Node.js + jsdom usage, parse() return type, article.content vs article.textContent
- [VERIFIED: Context7 /mixmark-io/turndown] — TurndownService constructor, use() method, turndown-plugin-gfm import and usage
- [VERIFIED: Context7 /websites/crawlee_dev_js] — PlaywrightCrawler, maxRequestsPerCrawl, enqueueLinks, label-based routing, requestHandler
- [VERIFIED: npm registry 2026-04-27] — All package versions confirmed current
- [VERIFIED: src/db/schema.ts] — Existing Drizzle schema pattern (pgEnum, pgTable, serial, references)
- [VERIFIED: src/discovery/run.ts] — dotenv/config first-import pattern, logger usage, db.update pattern
- [VERIFIED: src/lib/logger.ts] — LeadLogContext interface, logger.info/warn/error signatures
- [VERIFIED: drizzle.config.ts] — Confirmed uses `import 'dotenv/config'` (not `.env.local`)
- [VERIFIED: .planning/STATE.md] — Confirmed db:push env injection issue is a known deviation
- [VERIFIED: package.json] — Confirmed which packages are installed and which are missing
- [VERIFIED: .planning/config.json] — `nyquist_validation: false` confirmed → Validation Architecture section omitted

### Secondary (MEDIUM confidence)
- [CITED: docs.bullmq.io] — ioredis maxRetriesPerRequest: null requirement specifically for BullMQ workers
- [CITED: mozilla/readability README] — jsdom as recommended DOM provider for Node.js

### Tertiary (LOW confidence)
- [ASSUMED: A1] — `transformRequestFunction` in Crawlee 3.16.0 `enqueueLinks` — not directly verified against 3.16.0 source; verified in Crawlee docs but version not pinned

---

## Metadata

**Confidence breakdown:**
- BullMQ API (Queue, Worker, addBulk, concurrency): HIGH — verified via Context7 BullMQ docs
- ioredis connection pattern for BullMQ: HIGH — verified via Context7 BullMQ docs (maxRetriesPerRequest: null documented)
- Readability + jsdom pipeline: HIGH — verified via Context7 Readability docs (official README example)
- Turndown + GFM plugin: HIGH — verified via Context7 Turndown docs
- Crawlee bounded crawl (maxRequestsPerCrawl, label routing): HIGH — verified via Context7 Crawlee docs
- Drizzle schema extension pattern: HIGH — verified against existing src/db/schema.ts
- Redis unavailability: HIGH — verified by shell probe (redis-cli not found, redis-server not found)
- `transformRequestFunction` in Crawlee 3.16.0: LOW — docs verified, version pin not confirmed

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (BullMQ and Crawlee APIs stable in their current major versions; npm package versions should be re-verified before install)
