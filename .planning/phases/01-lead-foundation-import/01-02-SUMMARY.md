---
plan: "01-02"
phase: "01"
status: complete
completed: 2026-04-27
---

# Plan 01-02 Summary: CSV Import API and Leads List API

## What Was Built

Three artifacts implementing DISC-03 (CSV import) and the data surface for the dashboard:

1. **`src/schemas/import.schema.ts`** — Zod `ImportRowSchema` with `name` (min-length 1) and `url` (valid URL) validation. `ImportRow` type derived via `z.infer<>`.
2. **`src/app/api/leads/import/route.ts`** — `POST /api/leads/import` multipart handler. Accepts `.csv` file, parses with `csv-parse/sync` (BOM-stripped), validates rows with Zod, bulk-inserts with `onConflictDoNothing({target: leads.url})`, returns `{inserted, skipped, errors}`.
3. **`src/app/api/leads/route.ts`** — `GET /api/leads` returning `Lead[]` ordered by `createdAt DESC`.
4. **`test-fixtures/leads-sample.csv`** — 5-row fixture (3 valid, 1 duplicate, 1 invalid URL).

## Endpoint Contract

### POST /api/leads/import
- **Request**: `multipart/form-data` with `file` field (`.csv`, max 10 MB)
- **Response**: `{ inserted: number, skipped: number, errors: Array<{row: number, error: string}> }`
- **Error codes**: 400 (no file / bad multipart), 413 (>10 MB), 415 (non-.csv), 422 (parse failure)

### GET /api/leads
- **Response**: `Lead[]` ordered by `createdAt DESC`

## Smoke-Test Results (test-fixtures/leads-sample.csv)

First run (empty DB):
- `inserted: 3, skipped: 1, errors: [{row: 6, error: "url must be a valid URL"}]`

Re-run (same fixture, 3 rows already in DB):
- `inserted: 0, skipped: 3, errors: [{row: 6, error: "url must be a valid URL"}]`

## Security Mitigations Verified
- T-02-02 (10 MB size guard): `file.size > MAX_FILE_BYTES` → 413
- T-02-03 (extension guard): `.endsWith(".csv")` → 415
- T-02-04 (no stack trace leakage): only structured `{error: string}` returned
- T-02-06 (structured logging): `logger.info({stage:"import", status:"ok", durationMs, errorCount})` on every import

## Self-Check: PASSED
- `npx tsc --noEmit` exits 0
- All 3 tasks committed atomically
