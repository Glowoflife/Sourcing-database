---
phase: 03-technical-acquisition-pipeline
fixed_at: 2026-04-27T12:30:00Z
review_path: .planning/phases/03-technical-acquisition-pipeline/03-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-27T12:30:00Z
**Source review:** .planning/phases/03-technical-acquisition-pipeline/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01 through CR-04, WR-01 through WR-05)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Nullable `leads.url` reaches the worker as `null`

**Files modified:** `src/db/schema.ts`, `src/acquisition/run.ts`
**Commit:** 509911b
**Applied fix:** Added `.notNull()` to the `url` column on the `leads` table so the TypeScript type is `string` (not `string | null`). Added a defensive `.filter()` before `addBulk` in `run.ts` that type-narrows null URLs out of the enqueue set and exits early with a log message if no valid-URL leads remain. Also corrected the false atomicity comment (WR-03 handled in the same commit since it is in the same file edit).

---

### CR-02: Job data cast bypasses Zod validation in the worker

**Files modified:** `src/workers/acquisition.worker.ts`
**Commit:** 43313a5
**Applied fix:** Replaced the unsafe `job.data as { leadId: number; url: string }` cast with `AcquisitionJobSchema.safeParse(job.data)`. On parse failure the worker throws with a clear validation message so BullMQ marks the job as failed immediately with a meaningful failure reason rather than producing an opaque downstream crash.

---

### CR-03: Duplicate `manufacturer_pages` rows inserted on BullMQ job retry

**Files modified:** `src/db/schema.ts`, `src/acquisition/page-writer.ts`
**Commit:** f7918da
**Applied fix:** Added `unique` to the drizzle-orm/pg-core import and appended `(t) => [unique().on(t.leadId, t.url)]` as the table constraint on `manufacturerPages`. Updated `writePage` in `page-writer.ts` to use `.onConflictDoUpdate()` targeting `(leadId, url)` so retried jobs overwrite the existing row instead of inserting duplicates.

---

### CR-04: Shared `IORedis` instance violates BullMQ's connection model

**Files modified:** `src/lib/redis.ts`, `src/workers/queues.ts`, `src/workers/acquisition.worker.ts`
**Commit:** 2e57e59
**Applied fix:** Replaced the exported `redis` singleton with an exported `createRedisConnection()` factory that returns a fresh `IORedis` instance each time. Updated `acquisitionQueue` (queues.ts) and `acquisitionWorker` (acquisition.worker.ts) to each call `createRedisConnection()` so they hold independent connections. Added a comment in redis.ts explaining the BullMQ connection isolation requirement.

---

### WR-01: `updateLeadStatus("Errored")` in catch block can throw, masking the original error

**Files modified:** `src/acquisition/index.ts`
**Commit:** f8e2993
**Applied fix:** Wrapped the `await updateLeadStatus(leadId, "Errored")` call in its own nested try/catch. If the status update throws (e.g., DB unavailable), the error is logged separately and execution falls through to re-throw the original `err`. The original error is now always the one BullMQ records as the job failure reason.

---

### WR-02: Unescaped `.` in `KEYWORD_PATTERN` regex

**Files modified:** `src/acquisition/site-crawler.ts`
**Commit:** 12a8da1
**Applied fix:** Changed `our.products` to `our[-.]products` so the pattern matches only a literal hyphen or dot as the separator between "our" and "products", not any arbitrary character.

---

### WR-03: `addBulk` comment incorrectly claims atomicity

**Files modified:** `src/acquisition/run.ts`
**Commit:** 509911b (included in CR-01 commit — same file)
**Applied fix:** Replaced the comment claiming `addBulk` is atomic with accurate text stating it uses a Redis pipeline (batched for efficiency but not all-or-none). Also updated the enqueue log message to use `validLeads.length` after the null-URL filter.

---

### WR-04: Leads stuck in `"Processing"` status have no recovery path

**Files modified:** `src/acquisition/run.ts`
**Commit:** dd532c0
**Applied fix:** Added a startup reconciliation step at the top of `main()` that issues a Drizzle `UPDATE leads SET status='New' WHERE status='Processing' AND updated_at < NOW() - 10 minutes`. Imported `and` and `lt` from drizzle-orm. The reconciled count is logged so operators can detect infrastructure instability patterns. This runs before the new-leads query so reconciled leads are picked up in the same run.

---

### WR-05: `logger.error` writes to `stdout` instead of `stderr`

**Files modified:** `src/lib/logger.ts`
**Commit:** 507e572
**Applied fix:** Split the `console.log` call in `emit()` into a conditional: `error` and `warn` levels use `console.error()` (writes to stderr); all other levels use `console.log()` (writes to stdout). Both branches retain the `eslint-disable-next-line no-console` suppression comment.

---

## Skipped Issues

None — all 9 in-scope findings were fixed successfully.

---

_Fixed: 2026-04-27T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
