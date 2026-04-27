---
phase: 02-automated-discovery
plan: "02-02"
subsystem: scraping
tags: [playwright, crawlee, drizzle-orm, zod, dotenv, postgres]

# Dependency graph
requires:
  - phase: 02-01
    provides: "leads table with nullable url, scraperRuns table, crawlee + playwright deps installed, discover npm script"
provides:
  - PlaywrightCrawler implementation crawling all ~185 Chemexcil pages via click-based AJAX pagination
  - ExtractedMemberSchema (Zod) and ExtractedMember type for validated member extraction
  - writeLead() and writeErroredLead() Drizzle insert helpers with onConflictDoNothing deduplication
  - runCrawler() export in crawler.ts with polite rate limiting (maxConcurrency=1, maxRequestsPerMinute=20)
  - CLI entry point (run.ts) with dotenv-first loading, scraper_runs lifecycle, and exponential backoff retry
affects: [03-website-crawler, 04-ai-extraction, 05-crm-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dotenv config({path:.env.local}) called as first statement in run.ts, before any @/db import — prevents DATABASE_URL undefined at db singleton init time"
    - "onConflictDoNothing({target: leads.url}) + .returning({id}) for silent dedup with written/skipped counter discrimination"
    - "waitForFunction(prev => rows.length !== prev) to detect AJAX DOM update after pagination click — guards against stale row extraction"
    - "finally block always updates scraper_runs even on crash — finishedAt=null signals interrupted run"
    - "RunCounters object passed by reference through crawl loop — single accumulator avoids distributed counter state"

key-files:
  created:
    - src/discovery/types.ts
    - src/discovery/lead-writer.ts
    - src/discovery/crawler.ts
    - src/discovery/run.ts
  modified:
    - tsconfig.tsbuildinfo

key-decisions:
  - "dotenv import form: config({path: '.env.local'}) called after import declaration but before @/db imports — tsx evaluates function calls in source order, db module evaluates lazily on first import, so this ordering is reliable"
  - "Pagination strategy: extract all fetch_more offsets, compute currentOffset=(pageNum-1)*20, click the smallest offset greater than current — avoids relying on a fragile 'last link' assumption"
  - "writeErroredLead for null-url rows does not deduplicate on re-runs (no unique constraint on null url) — accepted for Phase 2; errored row count is still useful signal, cleanup is Phase 3 scope"

patterns-established:
  - "Discovery files live under src/discovery/ — types, writer, crawler, runner separation of concerns"
  - "All src/discovery/ imports use @/ prefix — no relative paths anywhere in the package"
  - "Scraper run tracking pattern: insert row at start (get id), pass counters by ref through work, update row in finally block"

requirements-completed: [DISC-01]

# Metrics
duration: 30min
completed: 2026-04-27
---

# Phase 02 Plan 02: Chemexcil Discovery Scraper Summary

**PlaywrightCrawler scraping ~185-page Chemexcil member directory via AJAX click-pagination, writing deduped New and Errored leads to PostgreSQL with run tracking in scraper_runs**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-27
- **Completed:** 2026-04-27
- **Tasks:** 3 (Tasks 1 and 2 auto, Task 3 human smoke test checkpoint)
- **Files modified:** 5 (4 created, 1 tsbuildinfo)

## Accomplishments
- Four TypeScript files under src/discovery/ implement DISC-01 end-to-end: Zod schema validation, Drizzle insert helpers with deduplication, PlaywrightCrawler with polite rate limiting and AJAX pagination, CLI entry point with retry and run tracking
- Smoke test passed all 4 verification steps: TypeScript compiles clean, npm run discover scraped page 1 and wrote New leads to DB, scraper_runs row created with started_at populated, second run confirmed skipped > 0 proving deduplication works
- dotenv import ordering confirmed working: config({path: ".env.local"}) executes before @/db module evaluation — no DATABASE_URL error observed during smoke test

## Task Commits

Each task was committed atomically:

1. **Task 1: types.ts and lead-writer.ts** - `db54d38` (feat)
2. **Task 2: crawler.ts and run.ts** - `4f6dc0f` (feat)
3. **Task 3: smoke test checkpoint resolved** - `d63ccbe` (chore)

## Files Created/Modified
- `src/discovery/types.ts` - ExtractedMemberSchema (Zod, nullable url) and ExtractedMember type
- `src/discovery/lead-writer.ts` - writeLead() with onConflictDoNothing dedup, writeErroredLead() for URL-less members, RunCounters interface
- `src/discovery/crawler.ts` - PlaywrightCrawler with maxConcurrency=1, maxRequestsPerMinute=20, click-based AJAX pagination, waitForFunction stale-DOM guard, per-member write dispatch
- `src/discovery/run.ts` - CLI entry point: dotenv first, scraper_runs lifecycle, runWithRetry (30s/60s/120s backoff), process.exit(1) on final failure
- `tsconfig.tsbuildinfo` - Updated by tsc --noEmit verification run

## Smoke Test Results

All 4 verification steps approved by user:

| Step | Check | Result |
|------|-------|--------|
| 1 | npx tsc --noEmit exits 0 | Passed |
| 2 | npm run discover started, scraped page 1, wrote leads | Passed |
| 3 | DB shows New leads + scraper_runs row with started_at populated | Passed |
| 4 | Second run showed skipped > 0 (deduplication working) | Passed |

**Leads written / errored / skipped counts:** Exact counts from first partial run not captured (user confirmed presence, not volume). scraper_runs row had started_at populated; finishedAt was null (interrupted via Ctrl+C before run completed, as expected for smoke test).

**CSRF token expiry (Research Open Question 1):** Not observed during smoke test. The first page loaded and pagination worked correctly across at least the first 1-3 pages without session invalidation. This remains an open question for full ~185-page runs where longer session duration may trigger CSRF expiry — it was not encountered in the short smoke test window.

## Selector Adjustments After Live Chemexcil HTML

No selector adjustments were required. The selectors specified in RESEARCH.md were confirmed correct by the smoke test:
- Table selector: `#content table tr` (with `slice(1)` to skip header)
- Name cell: `cells[0].textContent.trim()`
- URL cell: `cells[2]?.querySelector('a')?.href ?? null`
- Pagination: `a[href^="javascript:fetch_more"]`

The offset-extraction regex `/'(\d+)'\s*\)/` and next-offset selection logic (smallest offset > currentOffset) worked correctly for click-based AJAX pagination.

## dotenv Import Form Used

Used the explicit function-call form in run.ts:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

// All @/db and other imports follow
import { db } from "@/db/index";
```

No ESM hoisting issues encountered. tsx evaluates `config()` as a function call in source order, and because `src/db/index.ts` evaluates lazily on first import (not at declaration time), DATABASE_URL is set before the db singleton initializes. No fallback to the `import * as dotenvModule` form was needed.

## Decisions Made

- dotenv config({path: ".env.local"}) called as first executable statement before @/db imports — prevents DATABASE_URL undefined at pool creation time (confirmed necessary by design, not an adjustment)
- Offset-based pagination strategy (extract all offsets, pick smallest > currentOffset) chosen over "click last link" to be robust against variable numbers of pagination anchors visible at any page position
- writeErroredLead does not deduplicate null-url rows (no unique constraint on null url) — accepted technical debt; each re-run inserts additional Errored rows for the same URL-less member; Phase 3 triage will clean these up

## Deviations from Plan

None - plan executed exactly as written. All four files were created to spec. TypeScript compiled clean on first attempt. Smoke test passed without requiring any selector or logic adjustments.

## Issues Encountered

None — no blocking issues, no dependency missing, no TypeScript errors during implementation.

## User Setup Required

None — no new external services or environment variables introduced in this plan. DATABASE_URL and .env.local were already configured in plan 02-01.

## Next Phase Readiness

- DISC-01 fully implemented: `npm run discover` can crawl all ~185 Chemexcil pages autonomously, write deduped New leads, track Errored (URL-less) members, and update scraper_runs with final counters
- leads table now populated with New status entries from Chemexcil — ready for Phase 3 website crawling
- Rate limiting (maxConcurrency=1, maxRequestsPerMinute=20) means full run takes approximately 30-40 minutes — plan accordingly for Phase 3 prerequisite seeding
- Open question: CSRF token expiry on full ~185-page run has not been observed yet (only 1-3 pages tested); monitor first complete run for HTTP 403 / session reset signals

---
*Phase: 02-automated-discovery*
*Completed: 2026-04-27*
