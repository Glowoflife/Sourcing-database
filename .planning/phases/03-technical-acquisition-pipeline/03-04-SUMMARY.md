---
phase: 03-technical-acquisition-pipeline
plan: "03-04"
subsystem: acquisition
tags: [bullmq, playwright, crawlee, ioredis, drizzle, tsx, dotenv, graceful-shutdown]

# Dependency graph
requires:
  - phase: 03-03
    provides: runAcquisitionJob handler, AcquisitionJobSchema, site-crawler, page-writer
  - phase: 03-02
    provides: acquisitionQueue (BullMQ Queue), redis singleton (IORedis), htmlToMarkdown converter
  - phase: 03-01
    provides: manufacturer_pages schema, Redis installation, BullMQ/Crawlee deps

provides:
  - BullMQ Worker with concurrency 3 (src/workers/acquisition.worker.ts)
  - Worker process entry point with dotenv-first loading and graceful shutdown (src/workers/index.ts)
  - CLI enqueue script that bulk-adds status=New leads as BullMQ jobs (src/acquisition/run.ts)
  - npm run acquire and npm run worker scripts in package.json
  - Complete Phase 3 acquisition pipeline — enqueue-to-crawl end-to-end

affects:
  - "04" # AI extraction phase reads manufacturer_pages rows created by this pipeline

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dotenv config() as first import in all process entry points — before any @/ imports"
    - "acquisitionQueue.close() required after addBulk to prevent process hang"
    - "SIGTERM/SIGINT graceful shutdown via acquisitionWorker.close() in workers/index.ts"
    - "BullMQ Worker name string must match Queue name exactly ('acquisition')"
    - "concurrency: 3 for simultaneous Playwright sessions (D-06)"
    - "void shutdown() idiom for SIGTERM/SIGINT handlers (avoids floating promise)"

key-files:
  created:
    - src/workers/acquisition.worker.ts
    - src/workers/index.ts
    - src/acquisition/run.ts
  modified:
    - package.json

key-decisions:
  - "dotenv config() call must be first import in both run.ts and workers/index.ts — db and redis singletons read env vars at module load time"
  - "acquisitionQueue.close() called after addBulk in run.ts — required to allow Node.js process to exit cleanly"
  - "void shutdown() used for SIGTERM/SIGINT handlers — avoids unawaited floating promise lint error"
  - "Worker concurrency set to 3 per D-06 — limits simultaneous Playwright browser sessions"

patterns-established:
  - "Dotenv-first CLI pattern: import { config } from 'dotenv'; config({ path: '.env.local' }); as the very first import before any @/ aliases"
  - "Worker entry point pattern: dotenv first, import worker module, register SIGTERM/SIGINT with void shutdown(), stay resident"
  - "Queue close pattern: always call queue.close() in short-lived CLI scripts after addBulk to prevent process hang"

requirements-completed:
  - EXTR-01

# Metrics
duration: ~15min
completed: 2026-04-27
---

# Phase 3 Plan 04: BullMQ Worker, Worker Entry Point, CLI Enqueue Script Summary

**BullMQ Worker (concurrency: 3) with SIGTERM/SIGINT graceful shutdown and CLI enqueue script completing the full Phase 3 async acquisition pipeline — all three ROADMAP success criteria verified via smoke test.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27
- **Completed:** 2026-04-27
- **Tasks:** 2 (Task 1: implementation; Task 2: smoke test — human verified)
- **Files modified:** 4

## Accomplishments

- Created BullMQ Worker with `concurrency: 3`, `completed` and `failed` event handlers wired to structured logger
- Created worker process entry point with dotenv-first loading and SIGTERM/SIGINT graceful shutdown via `acquisitionWorker.close()`
- Created CLI enqueue script that reads all status=New leads and bulk-enqueues them atomically via `acquisitionQueue.addBulk()`
- Added `acquire` and `worker` npm scripts to package.json
- Full end-to-end smoke test passed: leads enqueued, worker processed them, manufacturer_pages rows written with human-readable Markdown, lead statuses transitioned to Crawled/Errored
- `npx tsc --noEmit` exits 0 — all Phase 3 files compile cleanly
- Worker graceful shutdown confirmed: Ctrl+C triggers SIGINT, `acquisitionWorker.close()` completes in-flight jobs, process exits with "Worker shut down cleanly" log

## Task Commits

Each task was committed atomically:

1. **Task 1: Create acquisition.worker.ts, workers/index.ts, acquisition/run.ts, add npm scripts** - `f3d0380` (feat)
2. **Task 2: Smoke-test full acquisition pipeline end-to-end** - human-verified checkpoint, no code commit needed

## Files Created/Modified

- `src/workers/acquisition.worker.ts` — BullMQ Worker named "acquisition", concurrency: 3, redis singleton connection, calls runAcquisitionJob() per job, completed/failed event handlers with structured logger
- `src/workers/index.ts` — Worker process entry point: dotenv-first loading, imports acquisitionWorker, SIGTERM/SIGINT graceful shutdown, stays resident
- `src/acquisition/run.ts` — CLI enqueue script: dotenv-first loading, reads status=New leads via Drizzle, calls acquisitionQueue.addBulk(), calls acquisitionQueue.close() to allow clean exit
- `package.json` — Added `"acquire": "tsx src/acquisition/run.ts"` and `"worker": "tsx src/workers/index.ts"` to scripts object

## Decisions Made

- `dotenv config()` must be the very first import in both `run.ts` and `workers/index.ts` — the `@/db/index` and `@/lib/redis` singletons read `DATABASE_URL` and `REDIS_URL` at module initialization time; importing them before dotenv loads means they always throw at startup.
- `acquisitionQueue.close()` is called at end of `run.ts` — without this the Node.js event loop stays alive (ioredis keeps a connection open) and the short-lived CLI process never exits.
- `void shutdown()` pattern used for SIGTERM/SIGINT handlers to satisfy `unawaited_futures` lint rule — avoids a floating promise while still calling the async shutdown function.
- Worker name string `"acquisition"` hardcoded in `acquisition.worker.ts` — MUST match the Queue name in `src/workers/queues.ts` (created in 03-02) for BullMQ routing.

## Smoke Test Results

All Phase 3 ROADMAP success criteria verified by human-approved smoke test:

**SC-1: System can crawl a manufacturer's homepage and follow links to "Products" and "About" pages**
- Verified: `manufacturer_pages` rows exist with `page_type = 'homepage'` and inner-page types (`products`, `about`, `other`)
- Code path: `site-crawler.ts` keyword pattern matches → `enqueueLinks` → inner pages crawled up to `maxRequestsPerCrawl: 5`

**SC-2: Website content is successfully converted to Markdown, reducing token size compared to raw HTML**
- Verified: Markdown content spot-check showed human-readable text with headings, paragraphs, and table syntax — no raw HTML tags (`<div>`, `<nav>`, `<script>`) in first 500 chars
- Code path: `html-to-markdown.ts` → Readability strips boilerplate → Turndown converts to Markdown

**SC-3: Acquisition jobs are queued and processed asynchronously via BullMQ**
- Verified: `npm run acquire` exited immediately after printing "Enqueued N acquisition jobs"; worker processed jobs asynchronously in Terminal 1
- Code path: `run.ts` → `acquisitionQueue.addBulk()` → Redis → `acquisition.worker.ts` → `runAcquisitionJob()`

**Additional smoke test confirmations:**
- `npx tsc --noEmit`: exits 0
- `redis-cli ping`: PONG (Redis running)
- `npm run worker` started without REDIS_URL error (dotenv loading correct)
- `npm run acquire` exited 0 with structured log line
- At least 1 lead transitioned to `status = 'Crawled'` (status machine fired correctly)
- Worker graceful shutdown confirmed on Ctrl+C — "Worker shut down cleanly" log appeared

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Phase 3 Complete — All Files Created

All Phase 3 files across all 4 plans:

| File | Plan | Purpose |
|------|------|---------|
| `src/lib/redis.ts` | 03-02 | IORedis singleton with `maxRetriesPerRequest: null` |
| `src/workers/queues.ts` | 03-02 | BullMQ Queue named "acquisition" |
| `src/acquisition/html-to-markdown.ts` | 03-02 | Readability + Turndown HTML → Markdown converter |
| `src/types/turndown-plugin-gfm.d.ts` | 03-02 | TypeScript declaration for turndown-plugin-gfm |
| `src/acquisition/types.ts` | 03-03 | Zod schemas: AcquisitionJobSchema, CrawledPageSchema |
| `src/acquisition/page-writer.ts` | 03-03 | Drizzle write helpers: writePage(), updateLeadStatus() |
| `src/acquisition/site-crawler.ts` | 03-03 | Bounded PlaywrightCrawler (maxRequestsPerCrawl: 5, keyword filter) |
| `src/acquisition/index.ts` | 03-03 | BullMQ job handler with New→Processing→Crawled/Errored status machine |
| `src/workers/acquisition.worker.ts` | 03-04 | BullMQ Worker, concurrency: 3, event handlers |
| `src/workers/index.ts` | 03-04 | Worker process entry point, graceful shutdown |
| `src/acquisition/run.ts` | 03-04 | CLI enqueue script, bulk-enqueues status=New leads |

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model:
- T-03-11 (Tampering — job payload): Redis on localhost, job data originates from Chemexcil scraper, no user-controlled input.
- T-03-12 (DoS — bulk enqueue): `concurrency: 3` limits simultaneous Playwright sessions; `requestHandlerTimeoutSecs: 60` per page.
- T-03-13 (Repudiation — SIGKILL): BullMQ stalled-job detection re-enqueues jobs; accepted for dev.
- T-03-14 (Information Disclosure — log lines): Only lead IDs and public manufacturer URLs logged; no PII.

## Known Stubs

None. This plan creates process entry points and a CLI script with no UI components or rendering.

## Next Phase Readiness

Phase 3 is complete. Phase 4 (AI Extraction & Technical Profiling) can begin immediately:
- `manufacturer_pages` table contains crawled Markdown content ready for LLM extraction
- `leads.status = 'Crawled'` identifies leads with pages available for extraction
- All Phase 3 files compile cleanly (`npx tsc --noEmit` exits 0)
- No blockers identified

Prerequisite for Phase 4: LLM API key configuration and prompt design for chemical unit normalization (tracked in STATE.md todos).

## Self-Check

Verifying claims before marking complete.

- `src/workers/acquisition.worker.ts`: FOUND (committed at f3d0380)
- `src/workers/index.ts`: FOUND (committed at f3d0380)
- `src/acquisition/run.ts`: FOUND (committed at f3d0380)
- `package.json` acquire + worker scripts: FOUND (committed at f3d0380)
- Commit f3d0380: FOUND (verified via git log)
- Smoke test: human-approved — all acceptance criteria passed
- `npx tsc --noEmit`: EXIT 0 (verified in smoke test)

## Self-Check: PASSED

---
*Phase: 03-technical-acquisition-pipeline*
*Completed: 2026-04-27*
