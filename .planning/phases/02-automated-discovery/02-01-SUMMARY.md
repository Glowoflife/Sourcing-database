---
phase: "02"
plan: "02-01"
subsystem: "data-layer"
tags: ["schema-migration", "dependencies", "drizzle", "crawlee", "playwright"]
dependency_graph:
  requires: ["01-lead-foundation-import"]
  provides: ["nullable-leads-url", "scraper-runs-table", "crawlee-playwright-deps"]
  affects: ["src/db/schema.ts", "package.json"]
tech_stack:
  added: ["crawlee@3.16.0", "playwright@1.59.1", "tsx@4.21.0", "dotenv@16.x"]
  patterns: ["drizzle nullable column", "drizzle pgTable with integer columns"]
key_files:
  created: []
  modified:
    - "src/db/schema.ts"
    - "package.json"
    - "package-lock.json"
decisions:
  - "Made leads.url nullable (Option A) — allows Errored records for URL-less Chemexcil members (D-07)"
  - "Added scraper_runs table with 7 columns covering run-level metrics (D-02)"
  - "crawlee is a runtime dep (not devDep) — invoked by discover CLI in production-like processes"
metrics:
  duration: "~30 minutes"
  completed: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 2 Plan 1: Schema Migration + Dependency Baseline Summary

**One-liner:** Made leads.url nullable and added scraper_runs table in schema.ts; installed crawlee@3.16.0, playwright@1.59.1, tsx, and dotenv; registered `npm run discover` script.

## What Was Built

This plan prepared the data layer and dependency baseline required before Plan 02-02 can implement the Chemexcil discovery crawler.

**Task 1 — Schema changes (src/db/schema.ts):**
- Extended drizzle-orm/pg-core import to include `integer`
- Removed `.notNull()` from `leads.url` column — column remains `.unique()` so duplicate non-null URLs are still prevented; PostgreSQL treats NULL as distinct from other NULLs, so multiple null-url rows are allowed (needed for D-07 Errored records)
- Added `scraper_runs` pgTable with 7 columns: id, started_at, finished_at, leads_found, leads_written, leads_skipped, leads_errored
- Added `ScraperRun` and `NewScraperRun` type exports
- All pre-existing exports (Lead, NewLead, LeadStatus) preserved

**Task 2 — Dependencies and script (package.json):**
- Added `"discover": "tsx src/discovery/run.ts"` to scripts
- Added `crawlee: "3.16.0"` and `playwright: "^1.44.0"` to dependencies
- Added `tsx: "^4.21.0"` and `dotenv: "^16.4.7"` to devDependencies
- Ran `npm install` — all packages resolved
- Ran `npx playwright install chromium` — Chromium binary installed

**Task 3 — drizzle-kit push (checkpoint — completed):**
- drizzle-kit push applied to live Neon PostgreSQL database
- `scraper_runs` table created with 7 columns
- `leads.url` NOT NULL constraint dropped — url column is now nullable
- Root cause of initial failure: `drizzle.config.ts` uses `import "dotenv/config"` which loads `.env` not `.env.local`; DATABASE_URL must be injected via shell (see Deviations section)

## Installed Versions

| Package | Requested | Installed |
|---------|-----------|-----------|
| crawlee | 3.16.0 | 3.16.0 |
| playwright | ^1.44.0 | 1.59.1 |
| tsx | ^4.21.0 | (from lockfile) |
| dotenv | ^16.4.7 | (from lockfile) |

## Playwright Chromium Binary

- **Install location:** `/Users/jeevanprakash/Library/Caches/ms-playwright/chromium-1217`
- **Chrome version:** 147.0.7727.15 (playwright chromium v1217)
- **Platform:** mac-arm64

## Live Database Verification Output

drizzle-kit push applied successfully. Live DB confirmed via `information_schema` queries:

```
scraper_runs table: scraper_runs
leads.url is_nullable: YES
scraper_runs column count: 7
scraper_runs columns: id, started_at, finished_at, leads_found, leads_written, leads_skipped, leads_errored
```

**drizzle-kit push prompts:** No interactive confirmation prompts were shown — drizzle-kit printed `[✓] Changes applied` and exited 0 without requiring manual confirmation for the NOT NULL constraint drop.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 6ff6a49 | feat(02-01): make leads.url nullable and add scraperRuns table |
| Task 2 | 7b2fe51 | feat(02-01): add discover script and install crawlee + playwright deps |
| Task 3 | 88abbb1 | chore(02-01): apply schema migration to live database via drizzle-kit push |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] drizzle-kit push failed silently due to .env.local not being auto-loaded**
- **Found during:** Task 3 (live DB verification after user-reported push)
- **Issue:** `drizzle.config.ts` uses `import "dotenv/config"` which loads `.env` not `.env.local`. The project stores DATABASE_URL only in `.env.local`. When the user ran `npx drizzle-kit push`, the env var was not set and the command exited with error code 1. The user reported "approved" based on the terminal output at the checkpoint, but post-verification queries showed no schema changes had been applied.
- **Fix:** Re-ran drizzle-kit push with DATABASE_URL injected via shell: `DATABASE_URL=$(node -e "require('dotenv').config({path:'.env.local'}); process.stdout.write(process.env.DATABASE_URL)") npx drizzle-kit push`
- **Files modified:** None (behavioral fix — no source changes)
- **Verification:** `information_schema` queries confirmed `scraper_runs table: scraper_runs` and `leads.url is_nullable: YES`
- **Committed in:** 88abbb1

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Essential fix to complete the plan's primary deliverable. No scope creep. Future drizzle-kit push operations must use the same shell injection pattern until DATABASE_URL is added to `.env` or a wrapper script is created.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| No new threats | — | schema.ts changes are additive only; no new network endpoints or auth paths introduced |

## Next Phase Readiness

Plan 02-02 (Chemexcil discovery implementation) is fully unblocked:
- `scraperRuns` table exists in live DB (7 columns)
- `leads.url` is nullable — Errored lead records can be written without a URL
- `crawlee` 3.16.0 and `playwright` 1.59.1 installed
- Playwright Chromium binary present at `~/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/`
- `npm run discover` resolves to `tsx src/discovery/run.ts`

**Known friction point for future drizzle-kit push operations:** DATABASE_URL must be injected via shell since `.env.local` is not auto-loaded by `dotenv/config`. Use: `DATABASE_URL=$(node -e "require('dotenv').config({path:'.env.local'}); process.stdout.write(process.env.DATABASE_URL)") npx drizzle-kit push`

## Self-Check: PASSED

- `src/db/schema.ts` exists and compiles (`npx tsc --noEmit` exits 0)
- `grep -c "scraperRuns" src/db/schema.ts` returns 3
- `grep "url:" src/db/schema.ts` shows `text("url").unique()` with no `.notNull()`
- `node_modules/crawlee/package.json` exists
- `node_modules/playwright/package.json` exists
- `node_modules/.bin/tsx` exists
- Live DB: `scraper_runs table: scraper_runs` (verified)
- Live DB: `leads.url is_nullable: YES` (verified)
- Playwright Chromium binary at `~/Library/Caches/ms-playwright/chromium-1217/`
- Commits 6ff6a49, 7b2fe51, and 88abbb1 verified in git log
