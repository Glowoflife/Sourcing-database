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
  duration: "~10 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
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

**Task 3 — CHECKPOINT (blocking):**
- drizzle-kit push to live database NOT yet applied — awaiting human verification

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

## Live Database Status

Task 3 (drizzle-kit push) is a BLOCKING checkpoint — the live database changes have NOT yet been applied. The schema file is ready; the push requires human confirmation of the interactive drizzle-kit prompts about dropping the NOT NULL constraint on leads.url.

**Expected verification output after push:**
```
scraper_runs table: scraper_runs
leads.url is_nullable: YES
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 6ff6a49 | feat(02-01): make leads.url nullable and add scraperRuns table |
| Task 2 | 7b2fe51 | feat(02-01): add discover script and install crawlee + playwright deps |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| No new threats | — | schema.ts changes are additive only; no new network endpoints or auth paths introduced |

## Self-Check: PASSED

- `src/db/schema.ts` exists and compiles (`npx tsc --noEmit` exits 0)
- `grep -c "scraperRuns" src/db/schema.ts` returns 3
- `grep "url:" src/db/schema.ts` shows `text("url").unique()` with no `.notNull()`
- `node_modules/crawlee/package.json` exists
- `node_modules/playwright/package.json` exists
- `node_modules/.bin/tsx` exists
- Commits 6ff6a49 and 7b2fe51 verified in git log
