---
phase: 04-ai-extraction-technical-profiling
plan: "04"
subsystem: workers
tags: [bullmq, redis, worker, cli, anthropic, haiku, runtime-verification]

requires:
  - phase: 04-03
    provides: extraction job handler and prompt execution path
provides:
  - extractionQueue and extractionWorker wiring
  - worker bootstrap that starts both acquisition and extraction workers
  - npm run extract CLI for Crawled leads
  - runtime fixes for clean CLI exit and Anthropic Haiku primary execution
affects:
  - phase-04-verification

key-files:
  created:
    - src/workers/extraction.worker.ts
    - src/extraction/run.ts
  modified:
    - package.json
    - src/discovery/lead-writer.ts
    - src/extraction/extract-profile.ts
    - src/extraction/instructor-client.ts
    - src/workers/index.ts
    - src/workers/queues.ts

completed: 2026-04-27
---

# Phase 04 Plan 04: Worker Wiring and Extraction CLI Summary

**Wired the extraction queue and worker into the existing BullMQ runtime, added the `extract` CLI, and finished the live Anthropic Haiku extraction path end to end against real crawled manufacturer data.**

## Accomplishments

- Created `src/workers/extraction.worker.ts` mirroring the acquisition worker with queue name `extraction`, `ExtractionJobSchema.safeParse()`, `runExtractionJob()`, and `concurrency: 5`
- Extended `src/workers/queues.ts` to export `extractionQueue` with its own Redis connection
- Updated `src/workers/index.ts` to import `extractionWorker`, log startup for both workers, and close both workers during shutdown
- Created `src/extraction/run.ts` to query `status = "Crawled"` leads, enqueue `{ leadId }` jobs, and close the queue
- Added the `extract` npm script using the same `node --env-file=.env.local` launch pattern as the acquisition CLI
- Switched `src/extraction/extract-profile.ts` to prefer Anthropic Haiku model `claude-haiku-4-5-20251001` with `max_tokens: 4096`, falling back to OpenAI only if Anthropic is unavailable

## Runtime Fixes Made During Verification

- `src/extraction/run.ts`: added explicit `process.exit(0)` on successful completion because the short-lived CLI stayed alive after logging the no-data path
- `src/extraction/instructor-client.ts` + `src/extraction/extract-profile.ts`: replaced the brittle Anthropic `instructor` path with native Anthropic tool calls plus local Zod validation/retry after live runs exposed an internal validation-formatting crash
- `src/discovery/lead-writer.ts`: removed the stale `url: null` insert path so the full repo compile gate matches the current non-null `leads.url` schema

## Verification Results

- `npm run typecheck`: PASS
- Live PostgreSQL schema checkpoint from 04-01: PASS
  `lead_status` contains `Extracted`, and `manufacturer_profiles`, `products`, `contacts`, and `locations` exist
- `npm run worker`: PASS
  Both acquisition and extraction workers start and process jobs cleanly using the current `.env.local`
- Live end-to-end run: PASS
  Seeded 3 real leads, acquired 5 `manufacturer_pages`, enqueued 3 extraction jobs, and observed all 3 leads transition to `Extracted`
- Live persistence checkpoint: PASS
  `manufacturer_profiles = 3`, `products = 54`, `contacts = 3`, `locations = 2`

## Self-Check: PASSED

Code wiring, compile gate, worker startup, and the full live extraction pipeline are verified.

---
*Phase: 04-ai-extraction-technical-profiling*
*Completed: 2026-04-27*
