---
phase: 01-lead-foundation-import
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/leads/page.tsx
  - src/app/api/leads/import/route.ts
  - src/app/api/leads/route.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/leads/csv-import-form.tsx
  - src/components/leads/import-result-feedback.tsx
  - src/components/leads/status-badge.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/button.tsx
  - src/components/ui/table.tsx
  - src/db/index.ts
  - src/db/schema.ts
  - src/lib/format-date.ts
  - src/lib/logger.ts
  - src/schemas/import.schema.ts
  - drizzle.config.ts
  - next.config.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 1 covers the project scaffold, Drizzle schema (`leads` table + `lead_status` enum), CSV import API (`POST /api/leads/import`), leads list API (`GET /api/leads`), and the dashboard UI. The overall structure is clean and follows Next.js App Router conventions well. However, there are four critical issues that must be fixed before this code ships: unvalidated `DATABASE_URL` at startup, an unbounded CSV import attack surface (no row count cap), no error handling on the leads-list API route, and the `updatedAt` column never being updated on write. There are also several warnings around missing MIME type validation, the hardcoded active state in the nav, and a prototype-pollution risk in the CSV parser configuration.

---

## Critical Issues

### CR-01: `DATABASE_URL` is silently `undefined` — crashes at query time, not at startup

**File:** `src/db/index.ts:6`
**Issue:** `process.env.DATABASE_URL!` uses a TypeScript non-null assertion that is erased at runtime. If `DATABASE_URL` is absent, `Pool` receives `connectionString: undefined`, which node-postgres accepts without throwing. The crash surfaces only on the first DB query — as an opaque `Error: connect ECONNREFUSED` — rather than at process startup where the missing variable is obvious. This makes cold-start failures very hard to diagnose in production.
**Fix:**
```ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new Pool({ connectionString });
```

---

### CR-02: No row-count limit on CSV import — unbounded memory and CPU usage

**File:** `src/app/api/leads/import/route.ts:46-61`
**Issue:** The file-size guard (10 MB) exists, but a CSV of many short rows within that budget can contain hundreds of thousands of rows. Every row is validated and then inserted (potentially in one large `INSERT ... VALUES (…)` statement via Drizzle). This has two consequences:
1. The `validRows` array can hold O(100k) objects in heap before the DB call.
2. Drizzle may emit a single statement with tens of thousands of value tuples, which Postgres and node-postgres do not handle gracefully and can blow query-size limits.

There is no cap on the number of rows parsed or inserted.
**Fix:**
```ts
const MAX_ROWS = 5_000; // define near top of file

// After parsing:
if (rows.length > MAX_ROWS) {
  return Response.json(
    { error: `CSV exceeds the ${MAX_ROWS}-row limit.` },
    { status: 422 },
  );
}

// If batching is needed for large imports:
const BATCH_SIZE = 500;
for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
  const batch = validRows.slice(i, i + BATCH_SIZE);
  const batchResult = await db
    .insert(leads)
    .values(batch)
    .onConflictDoNothing({ target: leads.url })
    .returning({ id: leads.id });
  inserted += batchResult.length;
}
```

---

### CR-03: `GET /api/leads` has no error handling — unhandled DB error crashes the route

**File:** `src/app/api/leads/route.ts:5-12`
**Issue:** The `GET` handler performs a DB query with no try/catch. Any database error (connection loss, timeout, schema mismatch) propagates as an unhandled rejection, causing Next.js to return a 500 response with a stack trace potentially visible in development and an opaque failure in production. The import route wraps everything in try/catch; this route should follow the same pattern for consistency and safety.
**Fix:**
```ts
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
    return Response.json(rows);
  } catch (err) {
    logger.error({ stage: "leads-list", status: "fail", message: String(err) });
    return Response.json({ error: "Failed to fetch leads." }, { status: 500 });
  }
}
```

---

### CR-04: `updatedAt` column is never updated on row mutation

**File:** `src/db/schema.ts:15`
**Issue:** The `updatedAt` column is defined with `.defaultNow()` but there is no `$onUpdate` hook (Drizzle's `.$onUpdateFn(() => new Date())`). Any future `UPDATE` statement (e.g., changing `status` from `New` to `Processing`) will leave `updatedAt` permanently equal to `createdAt`. This makes the column misleading and breaks any future logic that relies on it (sync, audit trail, cache invalidation). Because Phase 1 only does inserts, the bug is latent — but the schema is the contract for all future phases and must be correct now.
**Fix:**
```ts
import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

---

## Warnings

### WR-01: No MIME type validation — extension check is insufficient defense in depth

**File:** `src/app/api/leads/import/route.ts:36-42`
**Issue:** Only the filename extension (`.csv`) is validated. The `file.type` property is set by the browser from the `Content-Type` in the multipart part, not from actual file content. A renamed `.csv` file with binary content will pass the extension check and be fed directly to `csv-parse`, which may throw (caught) or silently produce garbage rows. Additionally, `file.type` is not checked at all — a client could send `text/html` with a `.csv` name. While `csv-parse` handles malformed input gracefully, validating the MIME type as a second signal is prudent.
**Fix:**
```ts
const ALLOWED_MIME = new Set(["text/csv", "text/plain", "application/csv", ""]);
// "" covers cases where the browser sends no type
if (file.type && !ALLOWED_MIME.has(file.type)) {
  return Response.json({ error: "File must be a CSV." }, { status: 415 });
}
```

---

### WR-02: `csv-parse` `columns: true` is vulnerable to prototype-pollution via header names

**File:** `src/app/api/leads/import/route.ts:48-53`
**Issue:** When `columns: true`, `csv-parse` uses the first row's values as object keys. If an attacker uploads a CSV whose header row contains `__proto__`, `constructor`, or `toString`, the parsed row objects may have those as keys. The `ImportRowSchema` only picks `name` and `url` via Zod, which partially mitigates this, but the raw parsed objects (`rows`) are typed as `unknown[]` and spread into memory before Zod runs. Depending on the Node.js version and `csv-parse` internals, this can silently mutate `Object.prototype`.
**Fix:** Pass an explicit column list to `csv-parse` instead of using `columns: true`:
```ts
rows = parse(buffer, {
  columns: ["name", "url"],   // only accept these two header names
  from_line: 2,               // skip the header row since we named columns explicitly
  skip_empty_lines: true,
  trim: true,
  bom: true,
});
```
Alternatively, keep `columns: true` but add `relax_column_count: false` and validate headers before iterating.

---

### WR-03: `aria-current="page"` is hardcoded on the Leads nav link — always active regardless of route

**File:** `src/app/(dashboard)/layout.tsx:15`
**Issue:** `aria-current="page"` and the active styling (`border-blue-600 bg-blue-50 text-blue-700`) are hardcoded unconditionally on the Leads link. When additional nav links are added in later phases (e.g., Analytics, Settings), this layout will either need to be restructured or every other link will need the active state suppressed manually. More critically, a screen reader will always announce "Leads" as the current page even when the user navigates to a different section within the dashboard shell.
**Fix:** Use Next.js `usePathname()` (requires `"use client"` on the nav component, or extract just the nav to a client component) to compute the active state dynamically:
```tsx
"use client";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "block rounded-md border-l-2 border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                        : "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"}
    >
      {children}
    </Link>
  );
}
```

---

### WR-04: `LeadsPage` DB query is not wrapped in error handling — unhandled rejection crashes the page render

**File:** `src/app/(dashboard)/leads/page.tsx:19`
**Issue:** `await db.select().from(leads).orderBy(desc(leads.createdAt))` runs with no try/catch inside the Server Component. If the database is unavailable (cold connection, Neon scale-to-zero timeout, network partition), Next.js catches the thrown error and renders the error boundary — but there is no error boundary defined for this route, so the user sees the Next.js default 500 page. More importantly, any error detail may leak to the client in development mode.
**Fix:** Add a try/catch and render a graceful empty state, or create an `error.tsx` boundary adjacent to this page:
```tsx
let rows: typeof leads.$inferSelect[] = [];
try {
  rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
} catch (err) {
  // Log and show empty state — do not rethrow
  console.error("[leads-page] DB error:", err);
}
```

---

### WR-05: `Intl.DateTimeFormat` is module-level — timezone is fixed at server startup, not per-request

**File:** `src/lib/format-date.ts:1-5`
**Issue:** The `Intl.DateTimeFormat` instance is created once at module load time with no `timeZone` option. This defaults to the server process's local timezone (likely UTC in production). If the application is later used across time zones or the server timezone changes, dates will be silently wrong. Furthermore, formatting a `Date` that is `null` or `undefined` (possible if the DB ever returns a row with a missing `created_at`) will throw `RangeError: Invalid time value`.
**Fix:** Specify the timezone explicitly and guard the null case:
```ts
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // or make configurable via env
});

export function formatLeadDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return formatter.format(d);
}
```

---

## Info

### IN-01: `drizzle.config.ts` has no `out` (migrations directory) configured

**File:** `drizzle.config.ts:4-10`
**Issue:** The config uses only `db:push` (schema push) and has no `out` field for migration files. This is acceptable for early development but means that `drizzle-kit generate` (which produces SQL migration files for production deployments) has no output directory and the project has no migration history. When this project moves to a staging or production environment, `db:push` is unsafe because it can drop columns. A `out: "./drizzle"` field and a `db:migrate` script should be added before any production deployment.
**Fix:** Add `out: "./drizzle"` to the config and add `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"` to `package.json` scripts.

---

### IN-02: `ImportResultFeedback` uses `role="status"` and `aria-live="polite"` together redundantly

**File:** `src/components/leads/import-result-feedback.tsx:31`
**Issue:** `role="status"` implicitly carries `aria-live="polite"` per the ARIA spec. Declaring both is redundant but not harmful. It can confuse future maintainers into thinking both are needed separately.
**Fix:** Remove the explicit `aria-live="polite"` attribute; `role="status"` is sufficient.

---

### IN-03: `logger.ts` uses `console.log` for all log levels including `error`

**File:** `src/lib/logger.ts:20`
**Issue:** All log levels (info, warn, error) write to `console.log` (stdout). In production Node.js environments, `error`-level messages are conventionally written to `console.error` (stderr) so that log aggregators and process supervisors can distinguish severity and route streams appropriately. The current implementation routes all log output to stdout regardless of level.
**Fix:**
```ts
function emit(level: LogLevel, ctx: LeadLogContext): void {
  const entry = { level, ts: new Date().toISOString(), ...ctx };
  const line = JSON.stringify(entry);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
```

---

_Reviewed: 2026-04-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
