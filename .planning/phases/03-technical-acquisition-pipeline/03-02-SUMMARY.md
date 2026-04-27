---
phase: "03"
plan: "03-02"
subsystem: "infrastructure"
tags: [redis, bullmq, ioredis, readability, jsdom, turndown, html-to-markdown, queue]
dependency_graph:
  requires:
    - bullmq-ioredis-ready
  provides:
    - redis-singleton
    - acquisition-queue
    - html-to-markdown-converter
  affects:
    - "03-03"
    - "03-04"
tech_stack:
  added: []
  patterns:
    - "IORedis singleton with maxRetriesPerRequest: null (BullMQ requirement)"
    - "BullMQ Queue named 'acquisition' connected to IORedis singleton"
    - "Readability + jsdom + Turndown (GFM) html-to-markdown pipeline"
    - "Local module declaration file for untyped npm package (turndown-plugin-gfm)"
key_files:
  created:
    - src/lib/redis.ts
    - src/workers/queues.ts
    - src/acquisition/html-to-markdown.ts
    - src/types/turndown-plugin-gfm.d.ts
  modified: []
decisions:
  - "article.content (not article.textContent) used as Turndown input — preserves HTML table structure per D-04"
  - "TurndownService instance created at module level (singleton) — stateless between calls, no per-call allocation overhead"
  - "turndown-plugin-gfm has no @types package on npm — local .d.ts declaration file is the correct solution"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 3 Plan 02: Infrastructure Singletons + HTML-to-Markdown Summary

**One-liner:** IORedis singleton with BullMQ acquisition queue and Readability+Turndown HTML-to-Markdown pipeline created as shared foundation for the acquisition worker and crawler.

## Tasks Completed

| Task | Name | Commit | Outcome |
|------|------|--------|---------|
| 1 | Create src/lib/redis.ts and src/workers/queues.ts | e86e347 | IORedis singleton with maxRetriesPerRequest: null; BullMQ Queue named 'acquisition' connected to singleton |
| 2 | Create src/acquisition/html-to-markdown.ts and src/types/turndown-plugin-gfm.d.ts | 7382343 | htmlToMarkdown() using Readability + jsdom + Turndown with GFM plugin; TypeScript module declaration for turndown-plugin-gfm |

## Files Created

### src/lib/redis.ts
- Exports named `redis` IORedis singleton
- Env-guard: throws `Error("REDIS_URL environment variable is not set")` if `REDIS_URL` missing
- `maxRetriesPerRequest: null` set as required by BullMQ workers

### src/workers/queues.ts
- Exports named `acquisitionQueue` BullMQ Queue
- Queue name: `"acquisition"` (must match the Worker in Plan 03-04)
- Connected to the redis singleton via `import { redis } from "@/lib/redis"`
- Uses `@/` path alias throughout — no relative imports

### src/acquisition/html-to-markdown.ts
- Exports `htmlToMarkdown(html: string, url: string): string`
- Pipeline: JSDOM parse → Readability extract → Turndown convert
- Uses `article.content` (cleaned HTML) — NOT `article.textContent` (plain text)
- GFM plugin registered: `turndown.use(gfm)` — enables `<table>` → Markdown table output
- Fallback: if Readability returns null or no content, converts raw HTML directly

### src/types/turndown-plugin-gfm.d.ts
- Module declaration for `"turndown-plugin-gfm"` (no `@types/` package exists on npm)
- Exports typed: `gfm`, `tables`, `strikethrough`, `taskListItems` — all `(service: TurndownService) => void`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added null guard for article.content**
- **Found during:** Task 2, TypeScript compile check
- **Issue:** `@mozilla/readability` types `article.content` as `string | null | undefined`. The plan's code passed `article.content` directly to `turndown.turndown()` which expects `string | Node`. TypeScript strict mode rejected this with TS2345.
- **Fix:** Extended the existing null check from `if (!article)` to `if (!article || !article.content)` — the fallback path (raw HTML conversion) is semantically correct when content is absent.
- **Files modified:** src/acquisition/html-to-markdown.ts
- **Commit:** 7382343
- **Impact:** No behavioral change for valid pages; correctly handles the edge case of Readability returning an article object with no content (thin/SPA pages).

None of the other deviations required Rule 4 escalation.

## Plan-Level Verification Results

| Check | Command | Result |
|-------|---------|--------|
| maxRetriesPerRequest present | `grep -c "maxRetriesPerRequest: null" src/lib/redis.ts` | 2 (comment + code) |
| Queue name "acquisition" | `grep -c '"acquisition"' src/workers/queues.ts` | 2 (comment + code) |
| article.content used | `grep -c "article\.content" src/acquisition/html-to-markdown.ts` | 3 |
| article.textContent absent outside comments | `grep -v '#\|//' ... \| grep -c "textContent"` | 0 |
| GFM plugin wired | `grep -c "turndown\.use(gfm)"` | 1 |
| TypeScript clean | `npx tsc --noEmit` | EXIT 0 |

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's threat model covers:
- T-03-04: Adversarial HTML via Readability+jsdom — accepted (output is stored Markdown, no user-facing rendering in Phase 3)
- T-03-05: REDIS_URL error message leakage — accepted (variable name only, not value; developer-visible only)
- T-03-06: Large HTML memory consumption — accepted (manufacturer pages typically small; per-job processing limits exposure)

## Known Stubs

None. This plan creates infrastructure utilities — no UI components or data rendering involved.

## Self-Check

Verifying claims before marking complete.

- src/lib/redis.ts: FOUND
- src/workers/queues.ts: FOUND
- src/acquisition/html-to-markdown.ts: FOUND
- src/types/turndown-plugin-gfm.d.ts: FOUND
- Commit e86e347: FOUND
- Commit 7382343: FOUND
- npx tsc --noEmit: EXIT 0

## Self-Check: PASSED
