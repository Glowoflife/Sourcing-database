---
phase: "03"
plan: "03-03"
subsystem: "acquisition"
tags: [crawlee, playwright, bullmq, drizzle, zod, types, page-writer, site-crawler, job-handler]
dependency_graph:
  requires:
    - html-to-markdown-converter
    - redis-singleton
    - acquisition-queue
    - manufacturer-pages-schema
  provides:
    - acquisition-types
    - page-writer-helpers
    - site-crawler
    - bullmq-job-handler
  affects:
    - "03-04"
tech_stack:
  added: []
  patterns:
    - "Zod schema + z.infer<typeof ...> for AcquisitionJob and CrawledPage types"
    - "Fresh PlaywrightCrawler per crawlManufacturerSite() call — no shared crawler across jobs"
    - "maxRequestsPerCrawl: 5 bounding (D-01 homepage + 4 inner pages)"
    - "transformRequestFunction keyword filter for link enqueuing (product|about|company|catalogue)"
    - "Homepage-only link enqueuing guard — inner pages do not cascade"
    - "Status machine: New -> Processing -> Crawled | Errored with re-throw for BullMQ"
    - "Homepage failure detection before DB writes"
key_files:
  created:
    - src/acquisition/types.ts
    - src/acquisition/page-writer.ts
    - src/acquisition/site-crawler.ts
    - src/acquisition/index.ts
  modified: []
decisions:
  - "transformRequestFunction was available in the installed Crawlee version — manual link extraction fallback was NOT needed"
  - "Inline export function syntax used (export async function foo) matching project pattern from lead-writer.ts and discovery/crawler.ts"
  - "Homepage failure detection checks pages.some(p => p.pageType === 'homepage') before any DB writes — ensures partial crawl success (inner pages only) is treated as failure"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 3 Plan 03: Core Acquisition Service Files Summary

**One-liner:** Four acquisition service files implementing Zod contracts, Drizzle DB write helpers, bounded multi-page PlaywrightCrawler, and BullMQ job handler with complete New->Processing->Crawled/Errored status machine.

## Tasks Completed

| Task | Name | Commit | Outcome |
|------|------|--------|---------|
| 1 | Create src/acquisition/types.ts and src/acquisition/page-writer.ts | 6e53b17 | AcquisitionJobSchema + CrawledPageSchema with Zod; writePage() Drizzle insert into manufacturer_pages; updateLeadStatus() Drizzle update on leads |
| 2 | Create src/acquisition/site-crawler.ts and src/acquisition/index.ts | 5cbfddd | crawlManufacturerSite() with fresh PlaywrightCrawler, keyword filter, maxRequestsPerCrawl: 5; runAcquisitionJob() with full status machine and re-throw |

## Files Created

### src/acquisition/types.ts
- Exports `AcquisitionJobSchema` (leadId: positive int, url: valid URL) and `AcquisitionJob` inferred type
- Exports `CrawledPageSchema` (url, pageType enum, markdown string) and `CrawledPage` inferred type
- `pageType` enum values: "homepage" | "products" | "about" | "other" — matches `pageTypeEnum` in schema.ts
- Zod + z.infer pattern matching src/discovery/types.ts exactly

### src/acquisition/page-writer.ts
- Exports `writePage(leadId, page)` — inserts one row into `manufacturerPages` via Drizzle, maps `page.markdown` to `markdownContent` column
- Exports `updateLeadStatus(leadId, status)` — updates `leads.status` with `eq(leads.id, leadId)`
- Structured logger calls with `stage: "acquire"` for all operations
- Imports: `@/db/index`, `@/db/schema`, `@/lib/logger`, `drizzle-orm` eq, `@/acquisition/types`

### src/acquisition/site-crawler.ts
- Exports `crawlManufacturerSite(homepageUrl)` returning `Promise<CrawledPage[]>`
- Creates a fresh `PlaywrightCrawler` per call (no shared state across concurrent BullMQ jobs)
- `maxRequestsPerCrawl: 5` — enforces D-01 (homepage + up to 4 inner pages)
- `maxRequestRetries: 3` — D-02 Crawlee-level retry cap (T-03-09 DoS mitigation)
- `requestHandlerTimeoutSecs: 60` — hard per-page timeout (T-03-09)
- `KEYWORD_PATTERN = /product|about|company|catalogue|our.products/i` — D-01 keyword list
- `transformRequestFunction` used for link filtering — available in installed Crawlee version, no fallback needed
- Link enqueuing guarded by `label === "HOMEPAGE"` — inner pages do not cascade further
- `inferPageType(url, label)` maps label + URL patterns to `"homepage" | "products" | "about" | "other"`

### src/acquisition/index.ts
- Exports `runAcquisitionJob({ leadId, url })` — BullMQ job handler
- Status machine: `updateLeadStatus(leadId, "Processing")` on start, `"Crawled"` on success, `"Errored"` on failure
- Homepage failure detection: `pages.some(p => p.pageType === "homepage")` — throws if homepage not in results
- `for...of` loop writes each crawled page via `writePage()` before marking Crawled
- `catch` block: sets status to Errored, logs structured error, then `throw err` — ensures BullMQ records job as failed (T-03-10 mitigation)
- No direct Drizzle imports — all DB operations delegated to page-writer.ts

## Deviations from Plan

### transformRequestFunction Availability

`transformRequestFunction` was available in the installed Crawlee version. The fallback code path (manual `page.$$eval` link extraction + `crawler.addRequests()`) was NOT needed.

### Inline Export Syntax

Both files use `export async function foo()` (inline export) rather than `export { foo }` at file bottom. This matches the established project pattern (discovery/crawler.ts, discovery/lead-writer.ts). The plan's acceptance criteria noted counts "at least 2 (function def + export)" — in practice inline export produces 1 grep match per function name. The code is functionally correct per project conventions.

Otherwise: "None - plan executed exactly as written."

## Plan-Level Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Crawler bounded | `grep -c "maxRequestsPerCrawl: 5" src/acquisition/site-crawler.ts` | 2 (comment + code) |
| Keyword pattern present | `grep -c "product\|about\|company\|catalogue" src/acquisition/site-crawler.ts` | 1 |
| Status - Processing | `grep -c "updateLeadStatus.*Processing" src/acquisition/index.ts` | 1 |
| Status - Crawled | `grep -c "updateLeadStatus.*Crawled" src/acquisition/index.ts` | 1 |
| Status - Errored | `grep -c "updateLeadStatus.*Errored" src/acquisition/index.ts` | 1 |
| Re-throw present | `grep -c "throw err" src/acquisition/index.ts` | 1 |
| DB column markdownContent | `grep -c "markdownContent" src/acquisition/page-writer.ts` | 1 |
| TypeScript clean | `npx tsc --noEmit` | EXIT 0 |

## Status Machine Confirmation

All four transitions implemented:
- `updateLeadStatus(leadId, "Processing")` — called before crawl starts (job start)
- `updateLeadStatus(leadId, "Crawled")` — called after all pages written (success path)
- `updateLeadStatus(leadId, "Errored")` — called in catch block (failure path)
- `throw err` — re-thrown in catch so BullMQ records job as failed (T-03-10)

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model:
- T-03-07: leadId validated as positive int by AcquisitionJobSchema (Zod); Drizzle uses parameterized queries — no SQL injection vector
- T-03-08: Same-hostname enforcement by Crawlee's default enqueueLinks strategy — inner pages stay on manufacturer domain
- T-03-09: requestHandlerTimeoutSecs: 60 + maxRequestRetries: 3 implemented — DoS protection in place
- T-03-10: re-throw in catch block implemented — repudiation threat mitigated

## Known Stubs

None. This plan creates service logic with no UI components or rendering.

## Self-Check

Verifying claims before marking complete.

- src/acquisition/types.ts: FOUND
- src/acquisition/page-writer.ts: FOUND
- src/acquisition/site-crawler.ts: FOUND
- src/acquisition/index.ts: FOUND
- Commit 6e53b17: FOUND
- Commit 5cbfddd: FOUND
- npx tsc --noEmit: EXIT 0

## Self-Check: PASSED
