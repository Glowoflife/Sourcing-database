---
phase: 01-lead-foundation-import
fixed_at: 2026-04-27T00:00:00Z
review_path: .planning/phases/01-lead-foundation-import/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-27T00:00:00Z
**Source review:** .planning/phases/01-lead-foundation-import/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (4 Critical + 5 Warning; Info excluded per fix_scope)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: `DATABASE_URL` is silently `undefined` — crashes at query time, not at startup

**Files modified:** `src/db/index.ts`
**Commit:** 47c5163
**Applied fix:** Replaced the TypeScript non-null assertion `process.env.DATABASE_URL!` with an explicit runtime guard that throws `Error("DATABASE_URL environment variable is not set")` at module load time if the variable is absent. The `Pool` is now only constructed with a confirmed non-undefined `connectionString`.

---

### CR-04: `updatedAt` column is never updated on row mutation

**Files modified:** `src/db/schema.ts`
**Commit:** 830ffe6
**Applied fix:** Appended `.$onUpdateFn(() => new Date())` to the `updatedAt` column definition, ensuring Drizzle automatically sets the column to the current timestamp on every `UPDATE` statement.

---

### CR-03: `GET /api/leads` has no error handling — unhandled DB error crashes the route

**Files modified:** `src/app/api/leads/route.ts`
**Commit:** aa22115
**Applied fix:** Wrapped the `db.select()` call in a `try/catch`. On failure, logs a structured error via `logger.error` and returns `{ error: "Failed to fetch leads." }` with HTTP 500. Also added the missing `logger` import.

---

### CR-02: No row-count limit on CSV import — unbounded memory and CPU usage

**Files modified:** `src/app/api/leads/import/route.ts`
**Commit:** 7d782ad
**Applied fix (CR-02):** Added `MAX_ROWS = 5_000` and `BATCH_SIZE = 500` constants. After parsing, a row-count check returns HTTP 422 if the CSV exceeds the limit. The single `db.insert()` call was replaced with a `for` loop that inserts in chunks of 500, accumulating the total `inserted` count.

**Applied fix (WR-01):** Added `ALLOWED_MIME` set containing `text/csv`, `text/plain`, `application/csv`, and `""`. After the extension check, a MIME type guard returns HTTP 415 if `file.type` is present and not in the allowed set.

**Applied fix (WR-02):** Changed `csv-parse` config from `columns: true` to `columns: ["name", "url"]` with `from_line: 2`, preventing prototype-pollution via adversarial header names and skipping the explicit header row.

---

### WR-03: `aria-current="page"` is hardcoded on the Leads nav link — always active regardless of route

**Files modified:** `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/nav-link.tsx`
**Commit:** e99154b
**Applied fix:** Created a new `"use client"` component `NavLink` in `src/app/(dashboard)/nav-link.tsx` that uses `usePathname()` to compute the active state dynamically. `aria-current` is now `"page"` only when the pathname starts with the link's `href`, and the active/inactive CSS classes are applied conditionally. The server layout now imports and renders `<NavLink href="/leads">Leads</NavLink>` instead of a hardcoded `<Link>`.

---

### WR-04: `LeadsPage` DB query is not wrapped in error handling — unhandled rejection crashes the page render

**Files modified:** `src/app/(dashboard)/leads/page.tsx`
**Commit:** 7137117
**Applied fix:** Declared `rows` with an explicit empty-array default (`let rows: (typeof leads.$inferSelect)[] = []`) and wrapped the `db.select()` call in `try/catch`. On error, the error is logged to `console.error` and the component renders with `rows = []`, which shows the existing "No leads yet" empty state to the user rather than crashing.

---

### WR-05: `Intl.DateTimeFormat` is module-level — timezone is fixed at server startup, not per-request

**Files modified:** `src/lib/format-date.ts`
**Commit:** 35eb6ae
**Applied fix:** Added `timeZone: "UTC"` to the `Intl.DateTimeFormat` options so dates are always formatted consistently regardless of server process timezone. Updated the function signature to `formatLeadDate(d: Date | null | undefined): string` and added an early return of `"—"` for falsy inputs to prevent `RangeError` on missing `created_at` values.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-04-27T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
