---
phase: 03-technical-acquisition-pipeline
verified: 2026-04-27T12:00:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
known_defects:
  - id: CR-01
    severity: critical
    file: src/acquisition/run.ts
    issue: "Nullable leads.url passed to addBulk without null guard — crashes worker with opaque error if a lead has url=null"
  - id: CR-02
    severity: critical
    file: src/workers/acquisition.worker.ts
    issue: "job.data cast bypasses AcquisitionJobSchema Zod validation — malformed jobs execute silently"
  - id: CR-03
    severity: critical
    file: src/acquisition/page-writer.ts + src/db/schema.ts
    issue: "No UNIQUE constraint on (lead_id, url) in manufacturer_pages — duplicate rows inserted on BullMQ job retry"
  - id: CR-04
    severity: critical
    file: src/lib/redis.ts + src/workers/queues.ts + src/workers/acquisition.worker.ts
    issue: "Shared IORedis singleton used for both Queue and Worker — violates BullMQ connection model"
---

# Phase 3: Technical Acquisition Pipeline Verification Report

**Phase Goal:** Prepare manufacturer website content for AI processing.
**Verified:** 2026-04-27T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System can crawl a manufacturer's homepage and follow links to "Products" and "About" pages | VERIFIED | `site-crawler.ts` exports `crawlManufacturerSite()` with `KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i`, `maxRequestsPerCrawl: 5`, `enqueueLinks` with `transformRequestFunction` filtering on keyword pattern, link enqueuing guarded to `label === "HOMEPAGE"` only. Smoke test confirmed `page_type = 'homepage'` and inner-page rows in DB. |
| 2 | Website content is successfully converted to Markdown, reducing token size compared to raw HTML | VERIFIED | `html-to-markdown.ts` uses Readability + jsdom + Turndown with GFM plugin, passes `article.content` (not `article.textContent`), has null guard for both `article` and `article.content`. Smoke test confirmed human-readable Markdown with no raw HTML tags in first 500 chars. |
| 3 | Acquisition jobs are queued and processed asynchronously via BullMQ | VERIFIED | `run.ts` reads `status=New` leads via Drizzle, calls `acquisitionQueue.addBulk()`, calls `acquisitionQueue.close()`, has dotenv-first loading. `acquisition.worker.ts` creates BullMQ Worker named "acquisition" with `concurrency: 3`, calls `runAcquisitionJob`. `workers/index.ts` has dotenv-first loading and SIGTERM/SIGINT graceful shutdown. Smoke test confirmed `npm run acquire` exits immediately and worker processes jobs asynchronously. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | pageTypeEnum, manufacturerPages table, type exports | VERIFIED | Lines 39-60: `pageTypeEnum` with 4 values, `manufacturerPages` with FK to `leads.id`, `markdownContent` column, `ManufacturerPage`, `NewManufacturerPage`, `PageType` exports present |
| `src/lib/redis.ts` | IORedis singleton with maxRetriesPerRequest: null | VERIFIED | Lines 1-13: env-guard throw, `maxRetriesPerRequest: null`, exports named `redis` |
| `src/workers/queues.ts` | BullMQ Queue named "acquisition" | VERIFIED | Lines 1-7: imports `redis` from `@/lib/redis`, creates Queue named "acquisition", exports `acquisitionQueue` |
| `src/acquisition/html-to-markdown.ts` | htmlToMarkdown() using Readability + Turndown + GFM | VERIFIED | Lines 1-34: JSDOM, Readability, TurndownService with GFM plugin, uses `article.content`, has null fallback |
| `src/types/turndown-plugin-gfm.d.ts` | TypeScript module declaration | VERIFIED | File exists (confirmed via glob) |
| `src/acquisition/types.ts` | AcquisitionJobSchema, CrawledPageSchema with Zod | VERIFIED | Lines 1-16: both schemas and inferred types present |
| `src/acquisition/site-crawler.ts` | crawlManufacturerSite() with bounded PlaywrightCrawler | VERIFIED | Lines 1-68: fresh crawler per call, `maxRequestsPerCrawl: 5`, keyword filter, homepage-only link enqueuing, `inferPageType()` |
| `src/acquisition/page-writer.ts` | writePage() and updateLeadStatus() Drizzle helpers | VERIFIED | Lines 1-32: both functions present, Drizzle insert into `manufacturerPages`, `eq`-filtered update on `leads` |
| `src/acquisition/index.ts` | runAcquisitionJob() with status machine | VERIFIED | Lines 1-65: Processing/Crawled/Errored transitions, homepage failure detection, re-throw in catch |
| `src/workers/acquisition.worker.ts` | BullMQ Worker with concurrency: 3 | VERIFIED | Lines 1-35: Worker named "acquisition", `concurrency: 3`, calls `runAcquisitionJob`, completed/failed event handlers |
| `src/workers/index.ts` | Worker entry point with dotenv-first loading | VERIFIED | Lines 1-20: dotenv as first import, imports `acquisitionWorker`, SIGTERM/SIGINT handlers with `void shutdown()` |
| `src/acquisition/run.ts` | CLI enqueue script with dotenv-first loading | VERIFIED | Lines 1-45: dotenv as first import, reads `status=New` leads, `addBulk`, `acquisitionQueue.close()`, error exit |
| `package.json` | acquire and worker npm scripts | VERIFIED | Lines 17-18: `"acquire": "tsx src/acquisition/run.ts"`, `"worker": "tsx src/workers/index.ts"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/workers/queues.ts` | `src/lib/redis.ts` | `import { redis } from '@/lib/redis'` | WIRED | Line 2 of queues.ts confirmed |
| `src/acquisition/html-to-markdown.ts` | `article.content` | `turndown.turndown(article.content)` | WIRED | Line 33 of html-to-markdown.ts confirmed |
| `src/acquisition/site-crawler.ts` | `src/acquisition/html-to-markdown.ts` | `import { htmlToMarkdown } from '@/acquisition/html-to-markdown'` | WIRED | Line 2 of site-crawler.ts confirmed |
| `src/acquisition/index.ts` | `src/acquisition/site-crawler.ts` | `crawlManufacturerSite(url)` called after status set to Processing | WIRED | Line 26 of index.ts confirmed |
| `src/acquisition/index.ts` | `src/acquisition/page-writer.ts` | `writePage()` and `updateLeadStatus()` | WIRED | Lines 2, 37, 41, 53 of index.ts confirmed |
| `src/acquisition/page-writer.ts` | `src/db/schema.ts manufacturerPages` | `db.insert(manufacturerPages).values({...})` | WIRED | Line 8 of page-writer.ts confirmed |
| `src/acquisition/run.ts` | `src/workers/queues.ts acquisitionQueue` | `import { acquisitionQueue } from '@/workers/queues'` | WIRED | Line 8 of run.ts confirmed |
| `src/workers/acquisition.worker.ts` | `src/acquisition/index.ts runAcquisitionJob` | `import { runAcquisitionJob } from '@/acquisition/index'` | WIRED | Line 4 of acquisition.worker.ts confirmed |
| `src/workers/index.ts` | `src/workers/acquisition.worker.ts` | `import { acquisitionWorker } from '@/workers/acquisition.worker'` | WIRED | Line 6 of workers/index.ts confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `site-crawler.ts` | `results: CrawledPage[]` | `page.content()` (Playwright live browser) + `htmlToMarkdown()` | Yes — live HTTP crawl, not static | FLOWING |
| `html-to-markdown.ts` | Markdown string | Readability parse of live HTML + Turndown conversion | Yes — processes real HTML input | FLOWING |
| `page-writer.ts writePage()` | DB insert | `db.insert(manufacturerPages).values({...})` with real crawled data | Yes — Drizzle parameterized insert | FLOWING |
| `run.ts` | `newLeads` | `db.select().from(leads).where(eq(leads.status, "New"))` | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

Runnable spot-checks skipped — this phase requires live Redis, a running Playwright browser, and a real PostgreSQL connection. A human-gated smoke test was completed in Plan 03-04 Task 2 and confirmed all three success criteria end-to-end. The smoke test was marked approved by the human operator.

| Behavior | Check Type | Result |
|----------|------------|--------|
| SC-1: Homepage crawl + inner-page follow | Human smoke test (Plan 03-04 Task 2) | PASS — manufacturer_pages rows with homepage and inner page types confirmed |
| SC-2: HTML to Markdown conversion | Human smoke test (Plan 03-04 Task 2) | PASS — human-readable Markdown confirmed, no raw HTML tags in first 500 chars |
| SC-3: Async BullMQ job queue + worker | Human smoke test (Plan 03-04 Task 2) | PASS — acquire CLI exited immediately, worker processed jobs asynchronously |
| npm scripts present | Static check | PASS — `"acquire"` and `"worker"` scripts confirmed in package.json |
| dotenv-first loading | Static check | PASS — `config({ path: ".env.local" })` is the first executable statement in both `run.ts` (line 3) and `workers/index.ts` (line 3) |
| Status machine complete | Static check | PASS — Processing (line 15), Crawled (line 41), Errored (line 53), re-throw (line 63) all confirmed in index.ts |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXTR-01 | 03-01, 03-02, 03-03, 03-04 | Pipeline to convert manufacturer website HTML to Markdown for token-efficient AI processing | SATISFIED | html-to-markdown.ts converts HTML to Markdown; site-crawler.ts handles multi-page crawl; acquisition pipeline stores Markdown in manufacturer_pages; smoke test confirmed non-empty Markdown in DB |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/acquisition/run.ts` | 14, 27 | `lead.url` (type: `string \| null`) passed to `addBulk` without null guard | Critical (CR-01) | Leads with `url=null` would crash the worker with an opaque Playwright error; not a stub but a type-safety gap from the intentionally nullable `leads.url` column established in Phase 2 |
| `src/workers/acquisition.worker.ts` | 10 | `job.data as { leadId: number; url: string }` — unsafe cast bypasses `AcquisitionJobSchema` | Critical (CR-02) | Malformed job payloads execute silently instead of being rejected with a clear validation error |
| `src/acquisition/page-writer.ts` | 8 | Plain `INSERT` with no `ON CONFLICT` handling | Critical (CR-03) | BullMQ job retries insert duplicate `manufacturer_pages` rows; no UNIQUE constraint on `(lead_id, url)` in schema |
| `src/lib/redis.ts` | 11 | Single `redis` IORedis instance shared by both Queue and Worker | Critical (CR-04) | Violates BullMQ's requirement for separate connections per Queue and Worker; can cause "ERR Command not allowed in subscriber mode" under concurrent load. Mitigated in current architecture by `acquire` and `worker` being separate processes. |
| `src/acquisition/site-crawler.ts` | 6 | `our.products` uses unescaped `.` regex metacharacter | Warning (WR-02) | Matches any character instead of literal `.`, can enqueue unintended URLs consuming inner-page slots |
| `src/acquisition/run.ts` | 24 | Comment falsely claims `addBulk` is atomic | Warning (WR-03) | Misleading comment; BullMQ uses a Redis pipeline, not a transaction; partial failure leaves some jobs missing |
| `src/acquisition/index.ts` | 53 | `updateLeadStatus("Errored")` in catch block can throw and mask the original error | Warning (WR-01) | If DB is unavailable, the status-update throw propagates instead of the original error; original `throw err` at line 63 never reached |
| `src/acquisition/index.ts` | 15 | Leads stuck in "Processing" after SIGKILL have no recovery path | Warning (WR-04) | `run.ts` only enqueues `status=New` leads; DB/BullMQ state diverges after crash during status transition |

### Human Verification Required

None. All three success criteria are satisfied by observable code evidence plus the human-approved smoke test completed in Plan 03-04 Task 2.

---

## Known Defects Requiring Follow-Up

The four critical issues identified in 03-REVIEW.md are real defects that must be addressed before production use. They did not prevent the phase goal from being achieved because:

- CR-01: All leads used in the smoke test had valid URLs; the defect only manifests for leads with `url=null` (valid per the Phase 2 design where Errored leads may have `url=null`).
- CR-02: All smoke test jobs were enqueued with correct data types; the defect only manifests for malformed job payloads.
- CR-03: The smoke test did not exercise job retry paths; duplicate rows accumulate only on retry.
- CR-04: The `acquire` and `worker` scripts run in separate OS processes, so the shared `redis` singleton is not actually shared across a Queue and Worker in the same process in the normal operation flow.

**These defects should be addressed before Phase 4 begins or before the pipeline runs against the full production lead set.** Recommended fix plans:

1. **CR-01**: Add `.notNull()` to `leads.url` in `src/db/schema.ts` (or add a null filter in `run.ts` before `addBulk`). Run `drizzle-kit push` after schema change.
2. **CR-02**: Replace `job.data as { ... }` cast with `AcquisitionJobSchema.safeParse(job.data)` in `acquisition.worker.ts`.
3. **CR-03**: Add `unique().on(t.leadId, t.url)` to `manufacturerPages` table definition in `schema.ts` and change `writePage` to use `.onConflictDoUpdate(...)`. Run `drizzle-kit push`.
4. **CR-04**: Change `src/lib/redis.ts` to export a `createRedisConnection()` factory function instead of a singleton; update `queues.ts` and `acquisition.worker.ts` to each call `createRedisConnection()` independently.

---

## Gaps Summary

No gaps block the phase goal. All three roadmap success criteria are verified by code evidence and human-confirmed smoke test. The phase achieved its stated goal: manufacturer website content is crawled, converted to Markdown, stored in the database, and the pipeline is driven asynchronously by BullMQ.

The 4 critical issues from the code review are documented as follow-up defects (see `03-REVIEW.md`) and should be addressed as a preflight task before Phase 4 begins or as an early task within Phase 4 planning.

---

_Verified: 2026-04-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
