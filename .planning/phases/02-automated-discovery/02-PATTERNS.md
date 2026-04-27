# Phase 2: Automated Discovery - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 6 (4 new, 2 modified)
**Analogs found:** 5 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (itself — additive change) | exact |
| `src/discovery/run.ts` | utility (CLI entry) | batch | `drizzle.config.ts` (CLI process, dotenv pattern) | partial |
| `src/discovery/crawler.ts` | service | batch / event-driven | `src/app/api/leads/import/route.ts` (row-by-row processing loop) | role-match |
| `src/discovery/lead-writer.ts` | service | CRUD | `src/app/api/leads/import/route.ts` (Drizzle insert + onConflictDoNothing) | exact |
| `src/discovery/types.ts` | utility | transform | `src/schemas/import.schema.ts` (Zod type + inferred TypeScript type) | role-match |
| `package.json` | config | — | `package.json` (itself — additive change) | exact |

---

## Pattern Assignments

### `src/db/schema.ts` (model, CRUD — additive)

**Analog:** `src/db/schema.ts` (existing file, lines 1–22)

**Existing import block** (lines 1–1):
```typescript
import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
```
Add `integer` to the import for the counter columns on `scraperRuns`.

**Existing table definition pattern** (lines 10–17):
```typescript
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

**Existing type inference pattern** (lines 19–21):
```typescript
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
```

**New `scraperRuns` table to add** — copy the `leads` table structure, replacing columns:
```typescript
// ADD: import integer from drizzle-orm/pg-core (extend existing import line)
import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const scraperRuns = pgTable("scraper_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),           // null until run completes
  leadsFound: integer("leads_found").notNull().default(0),
  leadsWritten: integer("leads_written").notNull().default(0),
  leadsSkipped: integer("leads_skipped").notNull().default(0),
  leadsErrored: integer("leads_errored").notNull().default(0),
});

export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
```

---

### `src/discovery/run.ts` (utility/CLI entry, batch)

**Analog:** `drizzle.config.ts` (lines 1–10) — only existing CLI-context file; provides the dotenv loading pattern for non-Next.js scripts.

**Dotenv loading pattern** (drizzle.config.ts line 1):
```typescript
import "dotenv/config";
```
Use this import-side-effect form in `run.ts` as the very first line so it is hoisted before the `db` singleton initialises. This matches Assumption A3 from RESEARCH.md — the import side-effect form is safer than `config({ path })` because ESM hoisting can cause `config()` calls to run after module-level imports.

**Adaptation for run.ts:** `drizzle.config.ts` uses `import "dotenv/config"` which loads `.env` by default. Because the project uses `.env.local`, use `import { config } from "dotenv"; config({ path: ".env.local" });` as a dynamic block at the top, OR verify at planning time whether `"dotenv/config"` reads `.env.local` in this repo's dotenv version.

**No analog for retry loop or scraper_runs DB write** — use RESEARCH.md Pattern 5 (exponential backoff) and Pattern for scraper_runs insert/update directly.

**Core structure to follow** (no direct analog — synthesised from RESEARCH.md):
```typescript
// src/discovery/run.ts — MUST be the first statements before any @/db imports
import { config } from "dotenv";
config({ path: ".env.local" });

// DB + crawler imports come AFTER dotenv is loaded
import { db } from "@/db/index";
import { scraperRuns } from "@/db/schema";
import { runCrawler } from "@/discovery/crawler";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

async function runWithRetry(fn: () => Promise<void>, attempts = 3): Promise<void> {
  const delays = [30_000, 60_000, 120_000];
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      logger.warn({
        stage: "discovery",
        status: "fail",
        message: `Attempt ${i + 1}/${attempts} failed. Retrying in ${delays[i] / 1000}s`,
      });
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

// main() pattern — matches import route's startedAt/durationMs pattern
async function main(): Promise<void> {
  const startedAt = Date.now();
  const [run] = await db.insert(scraperRuns).values({}).returning();
  // ... pass run.id to crawler, update at completion
}

main().catch((err) => {
  logger.error({ stage: "discovery", status: "fail", message: String(err) });
  process.exit(1);
});
```

---

### `src/discovery/crawler.ts` (service, batch/event-driven)

**Analog:** `src/app/api/leads/import/route.ts` (lines 80–116)

The import route is the closest analog for the row-processing loop pattern: iterate extracted items, validate each, write to DB, accumulate counters, log summary at the end. The crawler replaces the CSV parse step with `page.$$eval()` extraction.

**Row processing loop pattern** (import/route.ts lines 84–103):
```typescript
// import/route.ts — the per-row validation + DB write + counter accumulation pattern
rows.forEach((row, i) => {
  const result = ImportRowSchema.safeParse(row);
  if (result.success) {
    validRows.push(result.data);
  } else {
    errors.push({ row: i + 2, error: result.error.issues.map((iss) => iss.message).join("; ") });
  }
});

let inserted = 0;
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

**Adaptation for crawler.ts:** Replace the `forEach` + deferred batch insert with an immediate per-member `writeLead()` call (because each member is processed one-at-a-time in the pagination loop). The counter object mirrors the `inserted`/`skipped`/`errors` variables in the import route.

**Logger call pattern** (import/route.ts lines 108–114):
```typescript
logger.info({
  stage: "import",
  status: "ok",
  durationMs,
  errorCount: errors.length,
  message: `inserted=${inserted} skipped=${skipped} totalRows=${rows.length}`,
});
```
Mirror this at the end of each page in `crawler.ts` with `stage: "discovery"` and include `page` number in the message.

**No direct analog for PlaywrightCrawler configuration** — use RESEARCH.md Pattern 1 and Pattern 2 directly.

---

### `src/discovery/lead-writer.ts` (service, CRUD)

**Analog:** `src/app/api/leads/import/route.ts` (lines 95–103) — exact pattern for `onConflictDoNothing()` with `returning()`.

**Core Drizzle insert + deduplication pattern** (import/route.ts lines 95–103):
```typescript
const batchResult = await db
  .insert(leads)
  .values(batch)
  .onConflictDoNothing({ target: leads.url })
  .returning({ id: leads.id });
inserted += batchResult.length;
const skipped = validRows.length - inserted;
```

**Import pattern** (import/route.ts lines 1–4):
```typescript
import { db } from "@/db";
import { leads } from "@/db/schema";
import { ImportRowSchema } from "@/schemas/import.schema";
import { logger } from "@/lib/logger";
```

**Adaptation for lead-writer.ts:**
- Change `@/db` to `@/db/index` (be consistent — both work, but `@/db/index` is more explicit, matching `src/db/index.ts` directly).
- Import `ExtractedMember` from `@/discovery/types` instead of `ImportRowSchema`.
- For parse-failure / null-URL members: write with `status: 'Errored'` and `url` set to a sentinel or omit it. Because `url` is `notNull().unique()` on the `leads` table, the `Errored` record for a member with no URL will need a generated placeholder (e.g., `urn:chemexcil:nourl:<name>`) OR the schema must be updated to allow `url` to be nullable for Errored leads. This is a planning decision — flag for planner.

**`writeLead` function shape:**
```typescript
// Returns 'written' | 'skipped' — matches RESEARCH.md Pattern 4
export async function writeLead(
  member: { name: string; url: string },
  runId: number
): Promise<'written' | 'skipped'> {
  const result = await db
    .insert(leads)
    .values({ name: member.name, url: member.url, status: 'New' })
    .onConflictDoNothing({ target: leads.url })
    .returning({ id: leads.id });
  return result.length > 0 ? 'written' : 'skipped';
}
```

---

### `src/discovery/types.ts` (utility, transform)

**Analog:** `src/schemas/import.schema.ts` (lines 1–7) — exact pattern for Zod schema + inferred TypeScript type.

**Zod schema + type export pattern** (import.schema.ts lines 1–7):
```typescript
import { z } from "zod";

export const ImportRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;
```

**Adaptation for types.ts:**
```typescript
import { z } from "zod";

export const ExtractedMemberSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL").nullable(),
});

export type ExtractedMember = z.infer<typeof ExtractedMemberSchema>;
```
Note: `url` is `nullable()` here (not `.url()`) because members without a website are a valid extraction result. Zod validation in `crawler.ts` should use `ExtractedMemberSchema.safeParse()` before calling `writeLead()` — mirrors how `ImportRowSchema.safeParse()` is used in the import route.

---

### `package.json` (config — additive)

**Analog:** `package.json` itself (lines 8–16).

**Existing scripts block** (lines 8–16):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

**Add discover script** — append after `db:studio`:
```json
"discover": "tsx src/discovery/run.ts"
```

**New dependencies to add to `dependencies`** (crawlee is a runtime dep, not devDep — it runs in production CLI context):
```json
"crawlee": "3.16.0",
"playwright": "^1.0.0"
```
`tsx` is already in `node_modules` (confirmed in RESEARCH.md) but is NOT in `package.json` dependencies or devDependencies — the planner should add `tsx` to `devDependencies` if it is not already listed, or confirm it was installed globally/transiently.

---

## Shared Patterns

### Structured Logging
**Source:** `src/lib/logger.ts` (lines 1–27)
**Apply to:** `src/discovery/run.ts`, `src/discovery/crawler.ts`, `src/discovery/lead-writer.ts`

```typescript
// Import
import { logger } from "@/lib/logger";

// Usage pattern (info)
logger.info({
  stage: "discovery",
  status: "ok",
  durationMs,
  message: `page=${pageNum} found=${members.length}`,
});

// Usage pattern (warn — parse failure per D-07)
logger.warn({
  stage: "discovery",
  status: "fail",
  message: `parse failure: page=${pageNum} name=${name} reason=missing_url`,
});
```

The `LeadLogContext` interface (`src/lib/logger.ts` lines 3–11) is the canonical shape. All log calls in the discovery layer must pass an object matching this interface. The `stage` field should be `"discovery"` for crawler/writer events and `"run"` for the top-level retry loop in `run.ts`.

### Drizzle DB Client Import
**Source:** `src/db/index.ts` (lines 1–11) and `src/app/api/leads/import/route.ts` (line 2)
**Apply to:** `src/discovery/lead-writer.ts`, `src/discovery/run.ts`

```typescript
import { db } from "@/db/index";
```

The `db` singleton throws at import time if `DATABASE_URL` is not set (line 6–8 of `src/db/index.ts`). This is why `dotenv` must be loaded before any `@/db` import in the CLI context — `run.ts` must call `config({ path: '.env.local' })` as its very first statement.

### Drizzle `onConflictDoNothing` Deduplication
**Source:** `src/app/api/leads/import/route.ts` (lines 97–102)
**Apply to:** `src/discovery/lead-writer.ts`

```typescript
const result = await db
  .insert(leads)
  .values({ name, url, status: 'New' })
  .onConflictDoNothing({ target: leads.url })
  .returning({ id: leads.id });
// result.length === 0 means the URL already existed (skipped)
// result.length === 1 means newly inserted (written)
```

### Path Alias Convention
**Source:** `src/app/api/leads/import/route.ts` (lines 2–4)
**Apply to:** All new files in `src/discovery/`

```typescript
import { db } from "@/db/index";
import { leads } from "@/db/schema";
import { logger } from "@/lib/logger";
```

All `src/` imports use `@/` prefix. Never use relative paths (`../../db/index`). This is enforced by project convention (CONTEXT.md: "all `src/` imports use `@/` prefix").

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/discovery/run.ts` (retry loop) | utility | batch | No exponential backoff CLI entry point exists in the codebase; use RESEARCH.md Pattern 5 directly |
| `src/discovery/crawler.ts` (PlaywrightCrawler config) | service | batch | No browser automation exists in the codebase; use RESEARCH.md Patterns 1 and 2 directly |

---

## Planner Flags

These are open questions the planner must resolve before writing action steps:

1. **`url` nullability for Errored leads:** The existing `leads.url` column is `notNull().unique()`. Members with no website (D-07) cannot be inserted without a URL. Options: (a) make `url` nullable in the schema (requires a migration), (b) use a generated sentinel URL like `urn:chemexcil:nourl:<slugified-name>`, (c) skip members with no URL instead of writing Errored (contradicts D-07). The planner must choose and lock this.

2. **`tsx` in package.json:** `tsx` is available in `node_modules` but is not listed in `package.json` dependencies or devDependencies. The `discover` script calls `tsx` directly. The planner should add `tsx` to `devDependencies` to make the dependency explicit.

3. **`dotenv` import form:** `drizzle.config.ts` uses `import "dotenv/config"` which loads `.env` (not `.env.local`). `run.ts` must explicitly load `.env.local`. The planner should confirm whether `import "dotenv/config"` reads `.env.local` in this project's dotenv version, or whether `config({ path: ".env.local" })` is required.

---

## Metadata

**Analog search scope:** `src/` (all TypeScript files), `drizzle.config.ts`, `package.json`
**Files scanned:** 8 source files + drizzle.config.ts + package.json
**Pattern extraction date:** 2026-04-27
