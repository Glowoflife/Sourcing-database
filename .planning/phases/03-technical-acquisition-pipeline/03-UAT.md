---
status: complete
phase: 03-technical-acquisition-pipeline
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-04-27T12:35:00Z
updated: 2026-04-27T12:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running worker process. Ensure Redis is running (brew services list | grep redis).
  Run: npm run acquire
  Expected: Process starts, loads .env.local, queries DB for status=New leads, prints
  "Enqueued N acquisition jobs" (or "No New leads with valid URLs to enqueue"), then exits 0.
  No REDIS_URL errors, no DATABASE_URL errors, no crash at startup.
result: pass

### 2. Acquire Script Enqueues and Exits Cleanly
expected: |
  After running `npm run acquire`, the process exits on its own (does not hang).
  The log output contains a structured JSON line with stage="acquire" and the job count.
  The process does not stay alive waiting for Redis connections.
result: pass

### 3. Worker Starts and Picks Up Jobs
expected: |
  In a separate terminal, run: npm run worker
  Worker starts with no errors, prints a startup log, and begins processing any queued jobs.
  If jobs are in the queue, you should see structured log lines with stage="acquire" and leadId fields
  as each job is processed. Worker stays resident (does not exit on its own).
result: pass

### 4. Multi-Page Crawl with Keyword Filter
expected: |
  After a successful crawl run, query the DB:
    SELECT lead_id, url, page_type FROM manufacturer_pages WHERE lead_id = <any_crawled_lead_id>;
  Expected: Multiple rows per lead — at least 1 row with page_type='homepage', and ideally
  additional rows with page_type='products', 'about', or 'other' (if those links exist on the site).
  Maximum 5 rows per lead (homepage + up to 4 inner pages matching keyword filter).
result: pass

### 5. Markdown Content Quality
expected: |
  From the DB query above, look at the markdown_content for any row.
  Expected: Human-readable Markdown text — headings, paragraphs, maybe table syntax.
  Should NOT contain raw HTML tags like <div>, <nav>, <script>, <head>, or <body> in the first 500 characters.
  Content should reflect actual page text (product names, company description, etc.).
result: pass

### 6. Lead Status Machine
expected: |
  After a successful worker run, query:
    SELECT id, status FROM leads WHERE status IN ('Crawled', 'Errored', 'Processing');
  Expected: Leads that were crawled show status='Crawled'. No leads should be stuck in
  status='Processing' indefinitely. Errored leads (if any) show status='Errored'.
result: pass

### 7. Worker Graceful Shutdown
expected: |
  With npm run worker running and actively processing, press Ctrl+C.
  Expected: Worker completes any in-flight job (or abandons cleanly), prints a log line
  containing "shut down" or similar, and the process exits 0. No orphaned Playwright
  processes remain (check with: ps aux | grep playwright).
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
