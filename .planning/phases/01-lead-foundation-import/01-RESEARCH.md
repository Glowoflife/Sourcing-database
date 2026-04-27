# Phase 1: Lead Foundation & Import - Research

**Researched:** 2026-04-27
**Domain:** Next.js 14+ App Router, Drizzle ORM, PostgreSQL, CSV parsing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use **Drizzle ORM** as the database client. Schema-first, type-safe queries, TypeScript types auto-inferred from table definitions (`$inferSelect` / `$inferInsert`). Chosen for its Zod-compatible schema-first approach and lightweight SQL-close API.
- **D-02:** Use **drizzle-kit push** for migrations during development (schema diff applied directly, no migration files to track in early phases). Switch to `drizzle-kit generate + migrate` for production deployment when the time comes.

### Claude's Discretion
The following areas were not discussed — Claude has flexibility here:
- CSV import surface (UI upload vs CLI script vs API endpoint) — choose what's most pragmatic for Phase 1
- Lead status list scope — keep it minimal; full dashboard is Phase 5
- Duplicate URL handling strategy — choose a sensible default (skip/log is acceptable)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-02 | Lead lifecycle tracking (New, Processing, Crawled, Errored) | PostgreSQL `pgEnum` for native DB-level type safety; Drizzle `$inferSelect` derives TS type; status column is the pipeline's state machine for all later phases |
| DISC-03 | Support for importing leads from external CSV sources | `csv-parse/sync` parses uploaded buffer; Next.js App Router `request.formData()` receives the file natively without multer; Zod validates each row before DB insert |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete data layer foundation the rest of the project depends on. Three top-level concerns must be resolved in this phase: bootstrapping the Next.js project with its full toolchain (TypeScript, Tailwind 4, shadcn/ui, Drizzle), defining the `leads` PostgreSQL table with a native enum status column, and wiring a CSV upload API route that parses, validates, and bulk-inserts rows with duplicate-skipping.

PostgreSQL is not installed locally on this machine and no Docker runtime is present. The planner must include a step for the user to provision a PostgreSQL instance — the easiest path in 2026 is a free-tier managed database (Neon, Supabase, or Railway), all of which provide a `DATABASE_URL` connection string that works directly with Drizzle and `drizzle-kit push`. No local installation is required.

The Next.js App Router's native `request.formData()` handles file uploads directly without multer or busboy. The `csv-parse/sync` API parses the uploaded buffer synchronously, and Zod validates each row before insert, with `onConflictDoNothing()` on the URL column providing the duplicate-skipping default.

**Primary recommendation:** Use `create-next-app` to scaffold the project, `drizzle-orm` + `pg` for the database layer, `csv-parse` for CSV handling, and a single shadcn/ui `Table` component for the minimal Phase 1 status view. Full TanStack Table setup is deferred to Phase 5.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lead schema definition | Database / Storage | — | Drizzle `schema.ts` is the single source of truth for the `leads` table structure |
| Lead status state machine | Database / Storage | API / Backend | `pgEnum` enforces valid values at DB level; API layer enforces valid transitions |
| CSV upload & parsing | API / Backend | — | File processing is CPU-bound and must not run client-side; Next.js route handler owns this |
| CSV input validation | API / Backend | — | Zod schema validates each row before insert in the route handler |
| Lead list status view | Frontend Server (SSR) | Browser / Client | Server Component fetches leads at request time; minimal client interaction needed |
| Duplicate URL handling | Database / Storage | — | `onConflictDoNothing` on the `url` unique constraint handles deduplication at the DB level |
| DB client singleton | API / Backend | — | `src/db/index.ts` exports the singleton `db` instance used by all route handlers |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | App framework: SSR, API routes, dev server | Locked choice; latest stable as of research date |
| drizzle-orm | 0.45.2 | Database ORM: type-safe queries, schema inference | Locked choice; `latest` tag confirmed |
| drizzle-kit | 0.31.10 | Schema push/generate/migrate CLI | Required companion to drizzle-orm; `latest` tag confirmed |
| pg | 8.20.0 | node-postgres driver for Drizzle | Standard persistent-connection driver for non-serverless Node.js; `latest` confirmed |
| csv-parse | 6.2.1 | CSV buffer parsing in API route | Mature, well-tested; supports sync API for small files; TypeScript-native |
| zod | 4.3.6 | Row validation for CSV import and API payloads | Locked pattern in CONVENTIONS.md; `latest` confirmed |
| typescript | 6.0.3 | Type system | Required by stack |
| tailwindcss | 4.2.4 | Utility CSS | `latest` tag is v4 (not v3-lts); use `tailwindcss@latest` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui CLI | 4.5.0 | Accessible UI component scaffolding | Run `npx shadcn@latest init` to add Table, Button primitives; Phase 1 only needs `Table` |
| @tanstack/react-query | 5.100.5 | Server-state fetching/caching | Phase 1 can use simpler Server Components; full TanStack Query wiring is Phase 5 |
| dotenv | (bundled in Next.js) | `.env.local` loading | Next.js loads `.env.local` automatically; no extra setup needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg` (node-postgres) | `@neondatabase/serverless` | Neon serverless driver is needed only when running in an edge/serverless runtime. Next.js route handlers run in the Node.js runtime by default, so `pg` with a connection pool is correct and simpler. Use Neon serverless only if deploying to Vercel Edge or similar. |
| `csv-parse/sync` | `papaparse` | PapaParse is browser-focused; `csv-parse` is Node.js-native and handles `Buffer` directly from `formData`. Prefer `csv-parse` in a server-only route handler. |
| shadcn/ui `Table` | TanStack Table | TanStack Table is required for Phase 5's high-density grid with virtualization. Phase 1 only needs a simple list view — the shadcn `Table` component is adequate and avoids premature complexity. |

**Installation:**
```bash
npm install drizzle-orm pg csv-parse zod
npm install -D drizzle-kit @types/pg typescript
```

---

## Architecture Patterns

### System Architecture Diagram

```
CSV file (browser)
        │  multipart/form-data POST
        ▼
POST /api/leads/import (Next.js Route Handler)
        │  request.formData() → file.arrayBuffer() → Buffer
        │  csv-parse/sync → rows[]
        │  Zod ImportRowSchema.safeParse(row) per row
        │  db.insert(leads).values(validRows).onConflictDoNothing()
        ▼
PostgreSQL — leads table
  (id, name, url, status=New, created_at, updated_at)
        │
        ▼
GET /api/leads (Next.js Route Handler)
  db.select().from(leads).orderBy(desc(leads.createdAt))
        │
        ▼
/app/(dashboard)/leads/page.tsx (React Server Component)
  fetch from /api/leads → shadcn Table → status badge column
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── leads/
│   │   │   └── page.tsx        # Server Component: leads status list
│   │   └── layout.tsx          # Dashboard shell
│   └── api/
│       └── leads/
│           ├── route.ts        # GET (list all leads)
│           └── import/
│               └── route.ts    # POST (CSV upload)
├── db/
│   ├── schema.ts               # leads table + leadStatusEnum
│   └── index.ts                # db singleton (drizzle + Pool)
├── schemas/
│   └── import.schema.ts        # Zod ImportRowSchema (name + url)
└── components/
    └── ui/                     # shadcn/ui primitives (auto-generated)
```

### Pattern 1: Drizzle Schema with pgEnum

**What:** Define the PostgreSQL native ENUM type for lead status using `pgEnum`, then use it in the table definition. Use `$inferSelect` to derive the TypeScript type — never write a duplicate interface.

**When to use:** Any column with a fixed set of allowed values that must be enforced at the database level.

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/column-types/pg.mdx
import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// TypeScript type derived — never write a duplicate interface
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```

### Pattern 2: Drizzle DB Singleton (Node.js persistent connection)

**What:** Create a single `pg.Pool` and pass it to `drizzle()`. Export as `db` — all route handlers import this singleton.

**When to use:** Always, in the standard Next.js + Node.js runtime (not edge runtime).

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/connect-neon.mdx
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle({ client: pool, schema });
```

### Pattern 3: drizzle.config.ts (project root)

**What:** Config file for `drizzle-kit push`. Points at `src/db/schema.ts` and reads `DATABASE_URL`.

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/drizzle-kit-push.mdx
// drizzle.config.ts (project root, not inside src/)
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Push command:**
```bash
npx drizzle-kit push
```

This applies schema diffs directly to the database with no migration files. Suitable for early development. The CLI will prompt before any destructive change (e.g., dropping a column).

### Pattern 4: CSV Import Route Handler

**What:** Next.js App Router route handler that receives a multipart form upload, parses the CSV buffer, validates rows with Zod, and bulk-inserts with conflict skipping.

**When to use:** Phase 1 CSV import endpoint.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route
// src/app/api/leads/import/route.ts
import { parse } from "csv-parse/sync";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { ImportRowSchema } from "@/schemas/import.schema";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: unknown[];

  try {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // strip UTF-8 BOM from Excel-exported CSVs
    });
  } catch (err) {
    return Response.json({ error: "Invalid CSV format" }, { status: 422 });
  }

  const validRows: { name: string; url: string }[] = [];
  const errors: { row: number; error: string }[] = [];

  rows.forEach((row, i) => {
    const result = ImportRowSchema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
    } else {
      errors.push({ row: i + 2, error: result.error.message }); // +2: 1-indexed + header
    }
  });

  let inserted = 0;
  if (validRows.length > 0) {
    const result = await db
      .insert(leads)
      .values(validRows)
      .onConflictDoNothing({ target: leads.url }) // skip duplicate URLs silently
      .returning({ id: leads.id });
    inserted = result.length;
  }

  return Response.json({ inserted, skipped: validRows.length - inserted, errors });
}
```

### Pattern 5: Zod Import Row Schema

**What:** Validate each CSV row before insert. Enforce URL format and required name field.

```typescript
// src/schemas/import.schema.ts
import { z } from "zod";

export const ImportRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;
```

### Pattern 6: tsconfig.json with @/ path alias

**What:** Configure `@/` to resolve to `src/` so all internal imports use `@/db`, `@/schemas`, etc.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Note:** `drizzle.config.ts` uses filesystem-relative paths (`./src/db/schema.ts`), not `@/` aliases — drizzle-kit does not run through the TypeScript bundler path resolution.

### Anti-Patterns to Avoid

- **Calling `drizzle-kit push` without DATABASE_URL set:** The CLI will fail silently or connect to a wrong DB. Always verify `DATABASE_URL` is set in `.env.local` (loaded by Next.js) before running push. For drizzle-kit CLI outside Next.js, use `dotenv/config` in `drizzle.config.ts`.
- **Using `@/` alias in drizzle.config.ts:** drizzle-kit resolves paths relative to the filesystem, not through Next.js module resolution. Use `./src/db/schema.ts` literal paths in `drizzle.config.ts`.
- **Using `pg.Client` instead of `pg.Pool`:** A single `Client` will exhaust connections under concurrent requests. Always use `Pool` in the DB singleton.
- **Passing raw HTML to an LLM (future phases):** Documented in ARCHITECTURE.md — not applicable to Phase 1 but must not be introduced in data helpers established here.
- **Importing the `db` singleton in Client Components:** `src/db/index.ts` contains `pg` and must only run in server-side code (route handlers, Server Components, or server actions). Never import it in `"use client"` files.
- **Defining TypeScript interfaces that duplicate Drizzle types:** Always derive types via `$inferSelect` and `$inferInsert` — per CONVENTIONS.md, duplicating schema shape is a project anti-pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate URL detection on import | Custom SELECT-before-INSERT check | `onConflictDoNothing({ target: leads.url })` | Single round-trip; atomic; race-condition-free |
| CSV buffer parsing | Manual string split on commas | `csv-parse/sync` | Handles quoted fields, BOM, multi-line values, Windows CRLF, and encoding issues that hand-rolled parsers miss |
| TypeScript types from DB schema | Separate interface definitions | `$inferSelect` / `$inferInsert` | Any schema change automatically propagates to TS types; no drift |
| Schema push/diff | Manually running `ALTER TABLE` | `drizzle-kit push` | Computes the diff, warns before destructive changes, handles enum additions correctly |
| URL validation in CSV rows | Regex on string | `z.string().url()` | Handles protocol normalization, encoding, and edge cases; standard Zod primitive |

**Key insight:** The value of `drizzle-kit push` is that it introspects the live database schema and computes only the diff needed. Running it a second time after no changes is a no-op — it is safe to run on every dev restart.

---

## Common Pitfalls

### Pitfall 1: drizzle-kit push fails on enum changes

**What goes wrong:** After a `pgEnum` is created, adding a new value (e.g., adding `"Pending"` to `lead_status`) with `drizzle-kit push` may require a manual `ALTER TYPE ... ADD VALUE` because PostgreSQL does not allow removing enum values.

**Why it happens:** PostgreSQL native enums are immutable in one direction — values can be added but not removed without dropping the type.

**How to avoid:** Design the Phase 1 enum with all pipeline states upfront: `New`, `Processing`, `Crawled`, `Errored`. These four states cover the full pipeline defined in ARCHITECTURE.md. Do not add more states in Phase 1.

**Warning signs:** drizzle-kit push prints a prompt asking "Are you sure?" before altering an enum — read it carefully.

### Pitfall 2: Excel-exported CSVs have a UTF-8 BOM

**What goes wrong:** The first column header reads as `\ufeffname` instead of `name`, causing Zod validation to fail for every row.

**Why it happens:** Excel adds a Byte Order Mark (BOM) to UTF-8 CSV exports.

**How to avoid:** Always pass `bom: true` to `csv-parse`. This strips the BOM before column header parsing.

**Warning signs:** Import returns 0 inserted rows and all errors reference the first column despite correct data.

### Pitfall 3: Next.js serverless warm/cold connection thrash

**What goes wrong:** Each API invocation creates a new `pg.Pool`, exhausting PostgreSQL connections quickly.

**Why it happens:** Next.js route handlers can be invoked in a long-running Node.js process; the pool singleton in `src/db/index.ts` is created once at module load time. This is correct for standard Node.js. The problem only arises if the `db` singleton is created inside the route handler function (not at module scope).

**How to avoid:** Always export `db` from a module-level singleton (`src/db/index.ts`) and import it in route handlers — never instantiate `new Pool()` inside a handler function.

**Warning signs:** PostgreSQL logs show connection count growing without bound; "too many clients" errors.

### Pitfall 4: `drizzle.config.ts` at wrong location

**What goes wrong:** `npx drizzle-kit push` fails with "no config file found" or resolves the wrong schema path.

**Why it happens:** drizzle-kit looks for `drizzle.config.ts` in the current working directory (project root), not in `src/`.

**How to avoid:** Place `drizzle.config.ts` at the project root (same level as `package.json`). Use literal relative paths (`./src/db/schema.ts`) inside the config, not `@/` aliases.

**Warning signs:** `Error: Cannot find module '@/db/schema'` from drizzle-kit (alias resolution not available).

### Pitfall 5: Tailwind v4 vs v3 configuration differences

**What goes wrong:** Scaffolding with `tailwindcss@latest` installs v4, which has a different config format and no `tailwind.config.js` by default. shadcn/ui components generated against v3 assumptions may need adjustments.

**Why it happens:** `tailwindcss@latest` is 4.2.4 as of research date. v4 uses CSS-first config (`@import "tailwindcss"` in globals.css) rather than `tailwind.config.js`. The shadcn CLI (`npx shadcn@latest`) handles v4 automatically in recent versions.

**How to avoid:** Use `npx shadcn@latest init` — the shadcn CLI detects the Tailwind version and generates the correct config. Do not manually copy v3 config patterns into a v4 project.

**Warning signs:** Classes not applying; missing `tailwind.config.js`; CSS `@layer` directives not resolving.

### Pitfall 6: Node.js v25 is not LTS

**What goes wrong:** The machine currently runs Node.js v25.9.0, which is a current-release (odd version number) not an LTS release. Some tooling may warn about compatibility.

**Why it happens:** Node.js LTS releases use even version numbers. v25 is the current development line; next LTS will be v26.

**How to avoid:** This is not a blocker — v25.9.0 is recent enough to run Next.js 16 and all Phase 1 dependencies. Set `"engines": { "node": ">=20.0.0" }` in `package.json` to document the minimum requirement. No action needed during Phase 1.

**Warning signs:** npm install warnings about peer engine compatibility.

---

## Code Examples

### Complete leads table schema

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/column-types/pg.mdx
// src/db/schema.ts
import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
// LeadStatus = "New" | "Processing" | "Crawled" | "Errored"
```

### GET /api/leads route handler

```typescript
// src/app/api/leads/route.ts
import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.createdAt));

  return Response.json(rows);
}
```

### onConflictDoNothing upsert pattern

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/insert.mdx
await db
  .insert(leads)
  .values([{ name: "Acme Chemicals", url: "https://acme.example.com" }])
  .onConflictDoNothing({ target: leads.url });
// Rows with duplicate `url` values are silently skipped.
```

### shadcn/ui Table for status list (minimal Phase 1 view)

```tsx
// src/app/(dashboard)/leads/page.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function LeadsPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Added</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>{lead.name}</TableCell>
            <TableCell>{lead.url}</TableCell>
            <TableCell>{lead.status}</TableCell>
            <TableCell>{lead.createdAt.toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` (JavaScript config) | CSS-first config via `@import "tailwindcss"` in globals.css | Tailwind v4 (2025) | No `tailwind.config.js` needed for basic setup; shadcn CLI handles this automatically |
| `multer` for file uploads in Express/Next.js | Native `request.formData()` in Next.js App Router Route Handlers | Next.js 13+ App Router | multer is not needed; the Web API `FormData` is built-in |
| Drizzle migration files during dev (`drizzle-kit generate`) | `drizzle-kit push` for dev (direct schema diff) | Drizzle Kit 0.20+ | No SQL migration files to manage during rapid schema iteration |
| `shadcn-ui` npm package (deprecated) | `shadcn` CLI npm package (current) | 2024 | Install shadcn via `npx shadcn@latest init`, not `npm install shadcn-ui` |

**Deprecated/outdated:**
- `shadcn-ui` npm package (v0.9.5): This is the old distributable — **do not install it**. The correct tool is the CLI: `npx shadcn@latest init`.
- `multer` / `busboy` for Next.js App Router file uploads: Not needed. Use `request.formData()` natively.
- Tailwind v3 `@tailwind base/components/utilities` directives: These work in v3; v4 uses `@import "tailwindcss"`. The shadcn CLI sets this up correctly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL is not available locally — user needs to provision a managed DB (Neon/Supabase/Railway) | Environment Availability | If user has a local Postgres running on a non-standard path, the "provision DB" step is unnecessary but harmless |
| A2 | `shadcn@latest` (v4.5.0) CLI handles Tailwind v4 automatically | Standard Stack / Pitfall 5 | If shadcn CLI does not yet support Tailwind v4 fully, the plan will need a manual CSS config step |
| A3 | CSV files to be imported are small enough (<10MB) for synchronous `csv-parse/sync`; no streaming needed | Architecture Patterns | If files are large (thousands of rows is fine; >100k rows may warrant streaming) |

---

## Open Questions

1. **PostgreSQL host choice**
   - What we know: No local PostgreSQL or Docker is installed on the dev machine.
   - What's unclear: Which managed provider the user prefers (Neon free tier, Supabase free tier, Railway, or local Docker on another machine).
   - Recommendation: Plan should include a Wave 0 task that asks the user to set `DATABASE_URL` in `.env.local` before any DB-dependent task runs. Neon is the lowest-friction choice (free tier, HTTP pooling available, instant setup).

2. **CSV column header names**
   - What we know: The import Zod schema expects `name` and `url` columns.
   - What's unclear: Whether the user's actual CSV files use different header names (e.g., `company_name`, `website`).
   - Recommendation: The import route should document the expected CSV format. The planner should add a sample CSV file to the repo as a fixture.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | v25.9.0 (current, not LTS) | — (sufficient for all Phase 1 deps) |
| npm | All | Yes | 11.12.1 | — |
| PostgreSQL | Database layer | No | — | Use free-tier managed service (Neon/Supabase/Railway) |
| Docker | Local DB container | No | — | Use managed service |
| `psql` CLI | Manual DB inspection | No | — | Use managed service web console |

**Missing dependencies with no fallback:**
- None that block execution — PostgreSQL can be provisioned via a managed service without local installation.

**Missing dependencies with fallback:**
- **PostgreSQL (local):** Not installed, no Docker. Fallback: Neon/Supabase/Railway free tier provides `DATABASE_URL` that works identically with Drizzle and `drizzle-kit push`.

---

## Project Constraints (from CLAUDE.md)

The project `CLAUDE.md` defines the following actionable directives:

| Directive | Category | Required Action |
|-----------|----------|-----------------|
| Schema-first: define Zod schemas before functions; derive TS types via `z.infer<>` | Coding convention | `ImportRowSchema` in `src/schemas/import.schema.ts`; DB types via `$inferSelect` |
| Never use `any`; always use `.safeParse()` on external inputs | Coding convention | CSV row parsing must use `ImportRowSchema.safeParse(row)` in the import route |
| File naming: `kebab-case.ts` for modules, `PascalCase.tsx` for React components | Naming | `import.schema.ts`, `index.ts` for DB; `LeadsPage.tsx` or `page.tsx` as Next.js convention |
| Import order: Node builtins → external packages → internal `@/` aliases | Coding convention | Enforce in all new files |
| Structured logging: log `leadId`, `stage`, `status`, `durationMs` | Error handling | Import route should log insert results with this structure |
| Use `@/` path aliases throughout; no relative imports | Module resolution | Enforce in all `src/` files |
| Technical integrity: all extraction schema-validated (Zod) | Data quality | CSV rows validated before insert — already covered by pattern |

---

## Sources

### Primary (HIGH confidence)
- `/drizzle-team/drizzle-orm-docs` (Context7) — topics: `postgresql push schema setup`, `pgEnum`, `connection pool node-postgres`, `onConflictDoNothing`, `$inferSelect`
- `/adaltas/node-csv` (Context7) — topics: `sync parse buffer columns bom`
- `/websites/nextjs` (Context7) — topics: `route handler FormData file upload`, `tsconfig paths alias`, `create-next-app CLI`
- `npm view drizzle-orm version` — confirmed 0.45.2 is `latest` [VERIFIED: npm registry]
- `npm view drizzle-kit version` — confirmed 0.31.10 is `latest` [VERIFIED: npm registry]
- `npm view next version` — confirmed 16.2.4 is `latest` [VERIFIED: npm registry]
- `npm view csv-parse version` — confirmed 6.2.1 is `latest` [VERIFIED: npm registry]
- `npm view pg version` — confirmed 8.20.0 is `latest` [VERIFIED: npm registry]
- `npm view tailwindcss version` — confirmed 4.2.4 is `latest` [VERIFIED: npm registry]
- `npm view shadcn version` — confirmed 4.5.0 is `latest` CLI [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `npm view tailwindcss dist-tags` — confirmed v4.2.4 is `latest`; `v3-lts` is 3.4.19 [VERIFIED: npm registry]
- `npm view drizzle-orm dist-tags` — confirmed v0.45.2 is `latest`; `beta` tag is 1.0.0-beta.22 (unstable) [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- A3 (sync csv-parse for large files): Based on general knowledge of `csv-parse` library design. [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture: HIGH — verified via official Drizzle and Next.js docs
- Pitfalls: HIGH — Tailwind v4 migration confirmed via npm dist-tags; enum limitations are PostgreSQL behavior
- Environment: HIGH — verified via shell commands on target machine

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable libraries; Tailwind v4 config patterns may evolve faster)
